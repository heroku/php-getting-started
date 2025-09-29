import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { stream } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth.js';
import { MeiliEngine } from '../engines/meili.js';
import { generateAnswer, rerank, embed } from '@pixelcoda/llm-adapter';
import { vectorSearch } from '../db.js';
import { askSchema } from '../schemas.js';
import { 
  createJsonApiResponse, 
  createJsonApiError, 
  transformCitationToResource,
  createHttpError 
} from '../utils/jsonapi.js';

export const router = new Hono();
const engine = new MeiliEngine(process.env.MEILI_URL || 'http://localhost:7700', process.env.MEILI_KEY);

// SSE streaming ask endpoint
router.post('/ask/:project/stream', 
  authMiddleware.requireKey('read'), 
  zValidator('json', askSchema), 
  async (c) => {
    const { project } = c.req.param();
    const { q, lang, collections, maxPassages, temperature, includeDebug } = await c.req.json();

    return stream(c, async (stream) => {
      try {
        // Set SSE headers
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');

        // Send initial status
        await stream.write(`data: ${JSON.stringify({
          type: 'status',
          message: 'Suche nach relevanten Inhalten...'
        })}\n\n`);

        // Perform search (same logic as regular ask)
        let passages: any[] = [];
        let useVectorSearch = process.env.ENABLE_VECTOR_SEARCH === 'true';

        if (useVectorSearch) {
          try {
            const queryEmbedding = await embed(q);
            const vectorResults = await vectorSearch(project, queryEmbedding, {
              collections,
              limit: Math.max(maxPassages * 2, 20),
              threshold: 0.5
            });

            passages = vectorResults.map(result => ({
              id: result.id,
              title: result.title || 'Dokument',
              url: result.url,
              text: result.content || '',
              score: result.similarity,
              collection: result.collection,
              source: 'vector'
            }));

            await stream.write(`data: ${JSON.stringify({
              type: 'search_results',
              count: passages.length,
              method: 'vector'
            })}\n\n`);
          } catch (error) {
            useVectorSearch = false;
          }
        }

        if (!useVectorSearch || passages.length === 0) {
          const searchResults = await engine.search(project, {
            q,
            limit: Math.max(maxPassages * 2, 20),
            filters: collections?.length ? { _collection: collections } : undefined
          });
          
          passages = (searchResults.hits || []).map((hit: any) => ({
            id: hit.id,
            title: hit.title || 'Dokument',
            url: hit.url,
            text: hit.content || hit.summary || '',
            score: hit._score || 0,
            collection: hit._collection,
            source: 'keyword'
          }));

          await stream.write(`data: ${JSON.stringify({
            type: 'search_results',
            count: passages.length,
            method: 'keyword'
          })}\n\n`);
        }

        if (passages.length === 0) {
          await stream.write(`data: ${JSON.stringify({
            type: 'error',
            message: 'Keine relevanten Inhalte gefunden.'
          })}\n\n`);
          return;
        }

        // Send citations first
        const validPassages = passages.filter(p => p.text && p.text.length > 0);
        const topPassages = validPassages.slice(0, maxPassages);
        
        const citations = topPassages.map((p, i) => ({
          id: p.id,
          title: p.title,
          url: p.url,
          snippet: p.text.slice(0, 200) + (p.text.length > 200 ? '...' : ''),
          collection: p.collection,
          reference: `[${i + 1}]`
        }));

        await stream.write(`data: ${JSON.stringify({
          type: 'citations',
          citations
        })}\n\n`);

        // Generate answer with streaming
        await stream.write(`data: ${JSON.stringify({
          type: 'status',
          message: 'Generiere KI-Antwort...'
        })}\n\n`);

        const contextText = topPassages
          .map((p, i) => `[${i + 1}] Titel: ${p.title}\nInhalt: ${p.text.slice(0, 800)}`)
          .join('\n\n');

        const prompt = `Beantworte die Frage präzise basierend auf den bereitgestellten Informationen. 
Verwende nur die gegebenen Quellen und zitiere sie mit [1], [2], etc.
Wenn die Informationen nicht ausreichen, sage das ehrlich.

Frage: ${q}

Verfügbare Informationen:
${contextText}

Antwort:`;

        // Stream the answer generation
        const answer = await generateAnswer(prompt);
        
        await stream.write(`data: ${JSON.stringify({
          type: 'answer',
          text: answer,
          final: true
        })}\n\n`);

        await stream.write(`data: ${JSON.stringify({
          type: 'complete',
          message: 'Antwort vollständig generiert.'
        })}\n\n`);

      } catch (error) {
        console.error('SSE Ask error:', error);
        await stream.write(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unbekannter Fehler'
        })}\n\n`);
      }
    });
  }
);

// Regular ask endpoint (non-streaming)
router.post('/ask/:project', 
  authMiddleware.requireKey('read'), 
  zValidator('json', askSchema), 
  async (c) => {
    try {
      const startTime = Date.now();
      const { project } = c.req.param();
      const { q, lang, collections, maxPassages, temperature, includeDebug } = await c.req.json();

      // Step 1: Try vector search first (if pgvector is available)
      let passages: any[] = [];
      let useVectorSearch = process.env.ENABLE_VECTOR_SEARCH === 'true';

      if (useVectorSearch) {
        try {
          // Generate embedding for the query
          const queryEmbedding = await embed(q);
          
          // Vector similarity search
          const vectorResults = await vectorSearch(project, queryEmbedding, {
            collections,
            limit: Math.max(maxPassages * 2, 20),
            threshold: 0.5 // Minimum similarity threshold
          });

          passages = vectorResults.map(result => ({
            id: result.id,
            title: result.title || 'Dokument',
            url: result.url,
            text: result.content || '',
            score: result.similarity,
            collection: result.collection,
            source: 'vector'
          }));

          console.log(`Vector search found ${passages.length} passages for query: "${q}"`);
        } catch (error) {
          console.warn('Vector search failed, falling back to keyword search:', error);
          useVectorSearch = false;
        }
      }

      // Step 2: Fallback to keyword search if vector search failed or is disabled
      if (!useVectorSearch || passages.length === 0) {
        const searchPayload = {
          q,
          limit: Math.max(maxPassages * 2, 20),
          filters: collections?.length ? { _collection: collections } : undefined
        };

        const searchResults = await engine.search(project, searchPayload);
        const hits = searchResults.hits || [];

        passages = hits.map((hit: any) => ({
          id: hit.id,
          title: hit.title || hit.document?.title || 'Dokument',
          url: hit.url || hit.document?.url,
          text: hit.content || hit.document?.content || hit._formatted?.content || hit.summary || '',
          score: hit._score || 0,
          collection: hit._collection || hit.collection,
          source: 'keyword'
        }));

        console.log(`Keyword search found ${passages.length} passages for query: "${q}"`);
      }

      if (passages.length === 0) {
        return c.json({
          answer: 'Entschuldigung, ich konnte keine relevanten Informationen zu Ihrer Frage finden.',
          citations: [],
          meta: {
            passages_found: 0,
            response_time_ms: Date.now() - startTime,
            search_method: useVectorSearch ? 'vector' : 'keyword'
          }
        });
      }

      // Filter out empty passages
      const validPassages = passages.filter(p => p.text && p.text.length > 0);

      // Step 3: Re-rank passages (if enabled)
      let rankedPassages = validPassages;
      if (process.env.ENABLE_RERANKING === 'true' && validPassages.length > 1) {
        try {
          rankedPassages = await rerank(q, validPassages);
        } catch (error) {
          console.warn('Re-ranking failed, using original order:', error);
        }
      }

      // Step 4: Take top passages for context
      const topPassages = rankedPassages.slice(0, maxPassages);

      // Step 5: Generate grounded answer
      const contextText = topPassages
        .map((p, i) => `[${i + 1}] Titel: ${p.title}\nInhalt: ${p.text.slice(0, 800)}`)
        .join('\n\n');

      const prompt = `Beantworte die Frage präzise basierend auf den bereitgestellten Informationen. 
Verwende nur die gegebenen Quellen und zitiere sie mit [1], [2], etc.
Wenn die Informationen nicht ausreichen, sage das ehrlich.

Frage: ${q}

Verfügbare Informationen:
${contextText}

Antwort:`;

      const answer = await generateAnswer(prompt);

      // Step 6: Prepare citations
      const citations = topPassages.map((p, i) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        snippet: p.text.slice(0, 200) + (p.text.length > 200 ? '...' : ''),
        collection: p.collection,
        reference: `[${i + 1}]`
      }));

      const responseTime = Date.now() - startTime;

      // Log metrics (if enabled)
      if (process.env.ENABLE_METRICS === 'true') {
        console.log(`Ask: "${q}" in ${responseTime}ms, ${citations.length} citations`);
      }

      // Create JSON:API answer resource
      const answerResource = {
        type: 'answer',
        id: `answer-${Date.now()}`,
        attributes: {
          text: answer,
          query: q,
          language: lang,
          generated_at: new Date().toISOString(),
          confidence: calculateConfidence(topPassages),
          search_method: useVectorSearch ? 'vector' : 'keyword'
        },
        relationships: {
          citations: {
            data: citations.map((_, index) => ({
              type: 'citation',
              id: `citation-${index}`
            }))
          }
        },
        meta: {
          passages_found: validPassages.length,
          passages_used: topPassages.length,
          response_time_ms: responseTime,
          collections: collections || []
        }
      };

      // Transform citations to JSON:API resources for included section
      const citationResources = citations.map((citation, index) => 
        transformCitationToResource(citation, index)
      );

      // Create meta information
      const meta = {
        query: {
          text: q,
          language: lang,
          collections: collections || [],
          max_passages: maxPassages,
          temperature
        },
        generation: {
          response_time_ms: responseTime,
          search_method: useVectorSearch ? 'vector' : 'keyword',
          passages_found: validPassages.length,
          passages_used: topPassages.length,
          citations_count: citations.length
        }
      };

      // Add debug information if requested
      if (includeDebug) {
        meta.debug = {
          search_method: useVectorSearch ? 'vector' : 'keyword',
          passages_extracted: validPassages.length,
          reranking_enabled: process.env.ENABLE_RERANKING === 'true',
          vector_search_enabled: process.env.ENABLE_VECTOR_SEARCH === 'true',
          passages: topPassages.map(p => ({
            id: p.id,
            title: p.title,
            text_length: p.text?.length || 0,
            score: p.score,
            source: p.source
          }))
        };
      }

      // Return JSON:API 1.0 compliant response
      return c.json(createJsonApiResponse(answerResource, {
        included: citationResources,
        meta
      }));
    } catch (error) {
      console.error('Ask endpoint error:', error);
      
      const jsonApiError = createHttpError(500, 
        error instanceof Error ? error.message : 'Failed to generate answer'
      );
      
      return c.json(createJsonApiError(jsonApiError), 500);
    }
  }
);

// Helper function to calculate answer confidence
function calculateConfidence(passages: any[]): number {
  if (passages.length === 0) return 0;
  
  // Simple confidence calculation based on passage scores and count
  const avgScore = passages.reduce((sum, p) => sum + (p.score || 0), 0) / passages.length;
  const countFactor = Math.min(passages.length / 6, 1); // Normalize to max 6 passages
  
  return Math.round((avgScore * countFactor) * 100) / 100;
}