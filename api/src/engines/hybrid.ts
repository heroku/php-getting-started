import { SearchEngine, SearchDoc } from './base.js';
import { MeiliEngine } from './meili.js';
import { vectorSearch, embed } from '../db.js';

export interface HybridSearchResult {
  hits: any[];
  estimatedTotalHits: number;
  processingTimeMs: number;
  searchMethods: string[];
  fusionScore?: number;
}

export interface RRFConfig {
  k: number; // RRF parameter (typically 60)
  alpha: number; // Weight for BM25 vs Vector (0.5 = equal weight)
  enableReranking: boolean;
  maxCandidates: number; // Max candidates before fusion (e.g., 50)
  finalCount: number; // Final result count after fusion (e.g., 10)
}

export class HybridEngine implements SearchEngine {
  private keywordEngine: MeiliEngine;
  private rrfConfig: RRFConfig;

  constructor(
    keywordEngine: MeiliEngine,
    config: Partial<RRFConfig> = {}
  ) {
    this.keywordEngine = keywordEngine;
    this.rrfConfig = {
      k: 60,
      alpha: 0.5,
      enableReranking: process.env.ENABLE_RERANKING === 'true',
      maxCandidates: 50,
      finalCount: 20,
      ...config
    };
  }

  async upsert(project: string, collection: string, doc: SearchDoc): Promise<void> {
    // Delegate to keyword engine (vector indexing handled in db.ts)
    return this.keywordEngine.upsert(project, collection, doc);
  }

  async remove(project: string, collection: string, id: string): Promise<void> {
    // Delegate to keyword engine (vector cleanup handled in db.ts)
    return this.keywordEngine.remove(project, collection, id);
  }

  async search(project: string, query: any): Promise<HybridSearchResult> {
    const startTime = Date.now();
    const searchMethods: string[] = [];
    
    // Step 1: Parallel BM25 + Vector Search
    const [bm25Results, vectorResults] = await Promise.allSettled([
      this.performBM25Search(project, query),
      this.performVectorSearch(project, query)
    ]);

    let bm25Hits: any[] = [];
    let vectorHits: any[] = [];

    // Process BM25 results
    if (bm25Results.status === 'fulfilled') {
      bm25Hits = bm25Results.value.hits || [];
      searchMethods.push('bm25');
    } else {
      console.warn('BM25 search failed:', bm25Results.reason);
    }

    // Process Vector results
    if (vectorResults.status === 'fulfilled') {
      vectorHits = vectorResults.value;
      if (vectorHits.length > 0) {
        searchMethods.push('vector');
      }
    } else {
      console.warn('Vector search failed:', vectorResults.reason);
    }

    // Step 2: Reciprocal Rank Fusion
    const fusedHits = this.reciprocalRankFusion(
      bm25Hits,
      vectorHits,
      this.rrfConfig
    );

    // Step 3: Optional Cross-Encoder Re-ranking
    let finalHits = fusedHits;
    if (this.rrfConfig.enableReranking && fusedHits.length > 1) {
      try {
        finalHits = await this.crossEncoderRerank(query.q, fusedHits);
        searchMethods.push('reranked');
      } catch (error) {
        console.warn('Cross-encoder reranking failed:', error);
      }
    }

    // Step 4: Apply final limit
    const limitedHits = finalHits.slice(0, query.limit || 10);
    
    const processingTimeMs = Date.now() - startTime;

    return {
      hits: limitedHits,
      estimatedTotalHits: Math.max(bm25Hits.length, vectorHits.length),
      processingTimeMs,
      searchMethods,
      fusionScore: this.calculateFusionQuality(bm25Hits, vectorHits, limitedHits)
    };
  }

  private async performBM25Search(project: string, query: any): Promise<any> {
    // Use existing MeiliSearch for BM25
    const bm25Query = {
      ...query,
      limit: this.rrfConfig.maxCandidates
    };
    return this.keywordEngine.search(project, bm25Query);
  }

  private async performVectorSearch(project: string, query: any): Promise<any[]> {
    if (!query.q || typeof query.q !== 'string') {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await embed(query.q);
      
      // Vector similarity search
      const vectorResults = await vectorSearch(project, queryEmbedding, {
        collections: query.filters?._collection || query.collections,
        limit: this.rrfConfig.maxCandidates,
        threshold: 0.3 // Minimum similarity threshold
      });

      return vectorResults.map(result => ({
        id: result.id,
        title: result.title || 'Document',
        content: result.content || '',
        url: result.url,
        collection: result.collection,
        _score: result.similarity,
        _vectorScore: result.similarity,
        source: 'vector'
      }));
    } catch (error) {
      console.warn('Vector search failed:', error);
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * Formula: RRF(d) = Σ(1 / (k + rank_i(d))) for all rankings i
   */
  private reciprocalRankFusion(
    bm25Hits: any[], 
    vectorHits: any[], 
    config: RRFConfig
  ): any[] {
    const docScores = new Map<string, {
      doc: any;
      bm25Score: number;
      vectorScore: number;
      bm25Rank?: number;
      vectorRank?: number;
      rrfScore: number;
    }>();

    // Process BM25 results
    bm25Hits.forEach((hit, index) => {
      const docId = hit.id || `${hit.collection}:${hit.uid}`;
      const rank = index + 1;
      const rrfContribution = 1 / (config.k + rank);
      
      docScores.set(docId, {
        doc: { ...hit, source: 'bm25' },
        bm25Score: hit._score || 0,
        vectorScore: 0,
        bm25Rank: rank,
        rrfScore: config.alpha * rrfContribution
      });
    });

    // Process Vector results
    vectorHits.forEach((hit, index) => {
      const docId = hit.id;
      const rank = index + 1;
      const rrfContribution = 1 / (config.k + rank);
      
      if (docScores.has(docId)) {
        // Document exists in both rankings - boost it
        const existing = docScores.get(docId)!;
        existing.vectorScore = hit._vectorScore || 0;
        existing.vectorRank = rank;
        existing.rrfScore += (1 - config.alpha) * rrfContribution;
        existing.doc = { ...existing.doc, ...hit, source: 'hybrid' };
      } else {
        // Document only in vector results
        docScores.set(docId, {
          doc: { ...hit, source: 'vector' },
          bm25Score: 0,
          vectorScore: hit._vectorScore || 0,
          vectorRank: rank,
          rrfScore: (1 - config.alpha) * rrfContribution
        });
      }
    });

    // Sort by RRF score and return documents
    return Array.from(docScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(item => ({
        ...item.doc,
        _score: item.rrfScore,
        _bm25Score: item.bm25Score,
        _vectorScore: item.vectorScore,
        _bm25Rank: item.bm25Rank,
        _vectorRank: item.vectorRank,
        _fusionMethod: 'rrf'
      }));
  }

  /**
   * Cross-Encoder Re-ranking for Top-K results
   */
  private async crossEncoderRerank(query: string, candidates: any[]): Promise<any[]> {
    if (!query || candidates.length <= 1) {
      return candidates;
    }

    try {
      // Use LLM adapter for re-ranking
      const { rerank } = await import('@pixelcoda/llm-adapter');
      
      // Convert to format expected by rerank function
      const passages = candidates.map(hit => ({
        id: hit.id,
        text: hit.content || hit.summary || '',
        title: hit.title || '',
        url: hit.url,
        collection: hit.collection,
        score: hit._score
      }));

      const rerankedPassages = await rerank(query, passages);
      
      // Convert back to hit format
      return rerankedPassages.map((passage, index) => {
        const originalHit = candidates.find(h => h.id === passage.id) || {};
        return {
          ...originalHit,
          _score: passage.score || (1.0 - index * 0.1),
          _rerankScore: passage.score,
          _rerankPosition: index + 1,
          source: originalHit.source ? `${originalHit.source}+reranked` : 'reranked'
        };
      });
    } catch (error) {
      console.warn('Cross-encoder reranking failed:', error);
      return candidates;
    }
  }

  /**
   * Calculate fusion quality metrics
   */
  private calculateFusionQuality(
    bm25Hits: any[], 
    vectorHits: any[], 
    finalHits: any[]
  ): number {
    if (finalHits.length === 0) return 0;

    // Calculate overlap between BM25 and Vector results
    const bm25Ids = new Set(bm25Hits.map(h => h.id || `${h.collection}:${h.uid}`));
    const vectorIds = new Set(vectorHits.map(h => h.id));
    
    const intersection = new Set([...bm25Ids].filter(id => vectorIds.has(id)));
    const union = new Set([...bm25Ids, ...vectorIds]);
    
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    
    // Normalize to 0-1 range (higher = better fusion)
    return Math.min(jaccardSimilarity * 2, 1.0);
  }
}
