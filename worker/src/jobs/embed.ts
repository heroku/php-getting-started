import { embed } from '@pixelcoda/llm-adapter';
import type { TextChunk } from './chunk.js';

export interface EmbeddedChunk extends TextChunk {
  embedding: number[];
  embeddingModel?: string;
  embeddingDimension?: number;
}

export interface EmbedOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  model?: string;
}

export async function embedJob(
  chunks: TextChunk[], 
  options: EmbedOptions = {}
): Promise<EmbeddedChunk[]> {
  const {
    batchSize = 10,
    maxRetries = 3,
    retryDelay = 1000,
    model = 'default'
  } = options;

  if (!chunks || chunks.length === 0) {
    return [];
  }

  console.log(`Embedding ${chunks.length} chunks with batch size ${batchSize}`);
  
  const results: EmbeddedChunk[] = [];
  const errors: Array<{ chunk: TextChunk; error: Error }> = [];

  // Process chunks in batches to avoid overwhelming the embedding service
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

    const batchPromises = batch.map(async (chunk) => {
      return await embedWithRetry(chunk, maxRetries, retryDelay, model);
    });

    try {
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({
            chunk: batch[index],
            error: new Error(result.reason)
          });
          console.error(`Failed to embed chunk ${batch[index].id}:`, result.reason);
        }
      });

      // Add small delay between batches to be nice to the API
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Batch embedding failed:`, error);
      
      // Add all chunks in this batch to errors
      batch.forEach(chunk => {
        errors.push({
          chunk,
          error: error instanceof Error ? error : new Error('Unknown batch error')
        });
      });
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to embed ${errors.length}/${chunks.length} chunks`);
    
    // Optionally, you could implement fallback strategies here
    // For now, we'll continue with the successful embeddings
  }

  console.log(`Successfully embedded ${results.length}/${chunks.length} chunks`);
  
  return results;
}

async function embedWithRetry(
  chunk: TextChunk, 
  maxRetries: number, 
  retryDelay: number,
  model: string
): Promise<EmbeddedChunk> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const embedding = await embed(chunk.text);
      
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding response: empty or non-array');
      }

      return {
        ...chunk,
        embedding,
        embeddingModel: model,
        embeddingDimension: embedding.length
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown embedding error');
      
      if (attempt < maxRetries) {
        console.warn(`Embedding attempt ${attempt + 1} failed for chunk ${chunk.id}, retrying in ${retryDelay}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt))); // Exponential backoff
      }
    }
  }

  throw new Error(`Failed to embed chunk ${chunk.id} after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

// Utility function to validate embeddings
export function validateEmbedding(embedding: number[]): boolean {
  return Array.isArray(embedding) && 
         embedding.length > 0 && 
         embedding.every(val => typeof val === 'number' && !isNaN(val));
}

// Utility function to calculate embedding statistics
export function getEmbeddingStats(embeddings: number[][]): {
  count: number;
  dimension: number;
  avgMagnitude: number;
  minValue: number;
  maxValue: number;
} {
  if (embeddings.length === 0) {
    return { count: 0, dimension: 0, avgMagnitude: 0, minValue: 0, maxValue: 0 };
  }

  const dimension = embeddings[0].length;
  let totalMagnitude = 0;
  let minValue = Infinity;
  let maxValue = -Infinity;

  embeddings.forEach(embedding => {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    totalMagnitude += magnitude;

    embedding.forEach(val => {
      minValue = Math.min(minValue, val);
      maxValue = Math.max(maxValue, val);
    });
  });

  return {
    count: embeddings.length,
    dimension,
    avgMagnitude: totalMagnitude / embeddings.length,
    minValue,
    maxValue
  };
}
