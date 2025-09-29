import type { ExtractedDocument } from './extract.js';
import type { EmbeddedChunk } from './embed.js';

export interface UpsertOptions {
  apiBase?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  upsertChunks?: boolean;
}

export interface UpsertResult {
  document: {
    success: boolean;
    id: string;
    error?: string;
  };
  chunks: {
    successful: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  };
}

export async function upsert(
  project: string, 
  collection: string, 
  doc: ExtractedDocument, 
  chunks: EmbeddedChunk[],
  options: UpsertOptions = {}
): Promise<UpsertResult> {
  const {
    apiBase = process.env.API_BASE || 'http://localhost:8787',
    apiKey = process.env.API_WRITE_KEY || '',
    timeout = 30000,
    retries = 3,
    upsertChunks = true
  } = options;

  if (!apiKey) {
    throw new Error('API_WRITE_KEY is required for upserting documents');
  }

  console.log(`Upserting document: ${doc.id} with ${chunks.length} chunks to ${project}/${collection}`);

  const result: UpsertResult = {
    document: { success: false, id: doc.id },
    chunks: { successful: 0, failed: 0, errors: [] }
  };

  // 1. Upsert the main document to Meilisearch (for keyword search)
  try {
    await upsertDocument(apiBase, apiKey, project, collection, doc, timeout, retries);
    result.document.success = true;
    console.log(`Document upserted successfully: ${doc.id}`);
  } catch (error) {
    result.document.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to upsert document ${doc.id}:`, error);
    // Continue with chunks even if document upsert fails
  }

  // 2. Upsert chunks to database (for vector search)
  if (upsertChunks && chunks.length > 0) {
    console.log(`Upserting ${chunks.length} chunks to vector database`);
    
    for (const chunk of chunks) {
      try {
        await upsertChunk(apiBase, apiKey, project, collection, doc, chunk, timeout, retries);
        result.chunks.successful++;
      } catch (error) {
        result.chunks.failed++;
        result.chunks.errors.push({
          id: chunk.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Failed to upsert chunk ${chunk.id}:`, error);
      }
    }

    console.log(`Chunk upsert completed: ${result.chunks.successful} successful, ${result.chunks.failed} failed`);
  }

  return result;
}

async function upsertDocument(
  apiBase: string,
  apiKey: string,
  project: string,
  collection: string,
  doc: ExtractedDocument,
  timeout: number,
  retries: number
): Promise<void> {
  const payload = {
    documents: [{
      id: doc.id,
      project_id: project,
      collection,
      lang: doc.lang,
      url: doc.url,
      title: doc.title,
      summary: doc.summary,
      content: doc.content,
      facets: {
        wordCount: doc.wordCount,
        headingCount: doc.headings.length,
        contentType: 'webpage',
        ...doc.meta
      },
      boost: 1.0,
      created_at: doc.created_at,
      updated_at: new Date().toISOString()
    }]
  };

  await fetchWithRetry(
    `${apiBase}/v1/index/${project}/${collection}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    },
    timeout,
    retries
  );
}

async function upsertChunk(
  apiBase: string,
  apiKey: string,
  project: string,
  collection: string,
  doc: ExtractedDocument,
  chunk: EmbeddedChunk,
  timeout: number,
  retries: number
): Promise<void> {
  const payload = {
    id: chunk.id,
    project_id: project,
    collection,
    title: doc.title,
    content: chunk.text,
    url: doc.url,
    embedding: chunk.embedding,
    metadata: {
      document_id: doc.id,
      chunk_index: parseInt(chunk.id.split('_chunk_')[1] || '0'),
      word_count: chunk.wordCount,
      sentence_count: chunk.sentenceCount,
      start_index: chunk.startIndex,
      end_index: chunk.endIndex,
      embedding_model: chunk.embeddingModel,
      embedding_dimension: chunk.embeddingDimension
    }
  };

  // Note: This would need a dedicated endpoint for chunk upserts
  // For now, we'll use a mock endpoint or implement direct database insertion
  await fetchWithRetry(
    `${apiBase}/v1/chunks/${project}/${collection}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    },
    timeout,
    retries
  );
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeout: number,
  maxRetries: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown fetch error');
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
        console.warn(`Request attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Request failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

// Utility function to delete document and its chunks
export async function deleteDocument(
  project: string,
  collection: string,
  documentId: string,
  options: UpsertOptions = {}
): Promise<void> {
  const {
    apiBase = process.env.API_BASE || 'http://localhost:8787',
    apiKey = process.env.API_WRITE_KEY || '',
    timeout = 30000,
    retries = 3
  } = options;

  console.log(`Deleting document: ${documentId} from ${project}/${collection}`);

  // Delete from search index
  try {
    await fetchWithRetry(
      `${apiBase}/v1/index/${project}/${collection}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ ids: [documentId] })
      },
      timeout,
      retries
    );
  } catch (error) {
    console.error(`Failed to delete document from search index:`, error);
  }

  // Delete chunks from vector database
  try {
    await fetchWithRetry(
      `${apiBase}/v1/chunks/${project}/${collection}/${documentId}`,
      {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey
        }
      },
      timeout,
      retries
    );
  } catch (error) {
    console.error(`Failed to delete chunks from vector database:`, error);
  }

  console.log(`Document deletion completed: ${documentId}`);
}
