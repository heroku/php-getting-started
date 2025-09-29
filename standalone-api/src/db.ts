import { Pool } from 'pg';

// Database connection pool
let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/pixelcoda_search',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

// Vector similarity search
export interface VectorSearchResult {
  id: string;
  project_id: string;
  collection: string;
  title?: string;
  content?: string;
  url?: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export async function vectorSearch(
  project: string,
  embedding: number[],
  options: {
    collections?: string[];
    limit?: number;
    threshold?: number;
  } = {}
): Promise<VectorSearchResult[]> {
  const db = getDb();
  const { collections, limit = 20, threshold = 0.7 } = options;

  let query = `
    SELECT 
      id,
      project_id,
      collection,
      title,
      content,
      url,
      metadata,
      1 - (embedding <=> $2::vector) as similarity
    FROM chunks 
    WHERE project_id = $1
    AND 1 - (embedding <=> $2::vector) > $3
  `;

  const params: any[] = [project, `[${embedding.join(',')}]`, threshold];

  if (collections && collections.length > 0) {
    query += ` AND collection = ANY($${params.length + 1})`;
    params.push(collections);
  }

  query += ` ORDER BY embedding <=> $2::vector LIMIT $${params.length + 1}`;
  params.push(limit);

  try {
    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Vector search error:', error);
    // Fallback to empty results if pgvector is not available
    return [];
  }
}

// Upsert chunk with embedding
export async function upsertChunk(chunk: {
  id: string;
  project_id: string;
  collection: string;
  title?: string;
  content: string;
  url?: string;
  embedding: number[];
  metadata?: Record<string, any>;
}): Promise<void> {
  const db = getDb();
  
  const query = `
    INSERT INTO chunks (id, project_id, collection, title, content, url, embedding, metadata, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      url = EXCLUDED.url,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `;

  const params = [
    chunk.id,
    chunk.project_id,
    chunk.collection,
    chunk.title,
    chunk.content,
    chunk.url,
    `[${chunk.embedding.join(',')}]`,
    JSON.stringify(chunk.metadata || {})
  ];

  try {
    await db.query(query, params);
  } catch (error) {
    console.error('Chunk upsert error:', error);
    throw error;
  }
}

// Delete chunk
export async function deleteChunk(id: string): Promise<void> {
  const db = getDb();
  
  try {
    await db.query('DELETE FROM chunks WHERE id = $1', [id]);
  } catch (error) {
    console.error('Chunk delete error:', error);
    throw error;
  }
}

// Check if database is ready
export async function checkDbHealth(): Promise<boolean> {
  try {
    const db = getDb();
    await db.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Initialize database tables (migration-like functionality)
export async function initDatabase(): Promise<void> {
  const db = getDb();
  
  try {
    // Enable pgvector extension
    await db.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create chunks table for vector storage
    await db.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        url TEXT,
        embedding vector(384), -- Adjust dimension based on your embedding model
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for performance
    await db.query('CREATE INDEX IF NOT EXISTS chunks_project_collection_idx ON chunks(project_id, collection)');
    await db.query('CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops)');
    
    // Create synonyms table
    await db.query(`
      CREATE TABLE IF NOT EXISTS synonyms (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        terms TEXT[] NOT NULL,
        lang TEXT DEFAULT 'de',
        type TEXT DEFAULT 'synonym',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create metrics tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS query_metrics (
        id SERIAL PRIMARY KEY,
        project_id TEXT NOT NULL,
        query TEXT NOT NULL,
        results_count INTEGER,
        response_time_ms INTEGER,
        lang TEXT,
        user_agent TEXT,
        ip_address INET,
        collections TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS click_metrics (
        id SERIAL PRIMARY KEY,
        project_id TEXT NOT NULL,
        query TEXT NOT NULL,
        document_id TEXT NOT NULL,
        position INTEGER,
        url TEXT,
        collection TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for metrics
    await db.query('CREATE INDEX IF NOT EXISTS query_metrics_project_date_idx ON query_metrics(project_id, created_at)');
    await db.query('CREATE INDEX IF NOT EXISTS click_metrics_project_date_idx ON click_metrics(project_id, created_at)');

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}
