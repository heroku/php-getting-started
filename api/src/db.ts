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

// Admin/Telemetry Functions

export async function getTelemetryData(project: string, options: {
  from?: Date;
  to?: Date;
  period?: string;
}): Promise<any> {
  const db = getDb();
  const { from, to, period = '7d' } = options;
  
  // Calculate date range
  const endDate = to || new Date();
  const startDate = from || new Date(endDate.getTime() - parsePeriod(period));
  
  try {
    // Get basic metrics
    const [queryMetrics, clickMetrics] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) as total_queries,
          AVG(response_time_ms) as avg_response_time,
          COUNT(CASE WHEN results_count = 0 THEN 1 END)::float / COUNT(*) as no_result_rate
        FROM query_metrics 
        WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
      `, [project, startDate, endDate]),
      
      db.query(`
        SELECT COUNT(*) as total_clicks
        FROM click_metrics 
        WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
      `, [project, startDate, endDate])
    ]);
    
    const totalQueries = parseInt(queryMetrics.rows[0]?.total_queries || '0');
    const totalClicks = parseInt(clickMetrics.rows[0]?.total_clicks || '0');
    
    return {
      totalQueries,
      totalClicks,
      avgResponseTime: Math.round(queryMetrics.rows[0]?.avg_response_time || 0),
      avgClickThroughRate: totalQueries > 0 ? totalClicks / totalQueries : 0,
      noResultRate: parseFloat(queryMetrics.rows[0]?.no_result_rate || '0'),
      periodStart: startDate,
      periodEnd: endDate,
      dataPoints: []
    };
  } catch (error) {
    console.error('Telemetry data error:', error);
    throw error;
  }
}

export async function getNoResultQueries(project: string, options: {
  limit?: number;
  period?: string;
}): Promise<any[]> {
  const db = getDb();
  const { limit = 50, period = '7d' } = options;
  const startDate = new Date(Date.now() - parsePeriod(period));
  
  try {
    const result = await db.query(`
      SELECT 
        query,
        COUNT(*) as count,
        MAX(created_at) as last_searched
      FROM query_metrics 
      WHERE project_id = $1 
        AND results_count = 0 
        AND created_at >= $2
      GROUP BY query
      ORDER BY count DESC, last_searched DESC
      LIMIT $3
    `, [project, startDate, limit]);
    
    return result.rows.map(row => ({
      query: row.query,
      count: parseInt(row.count),
      lastSearched: row.last_searched,
      suggestedSynonyms: [] // TODO: Implement AI-powered synonym suggestions
    }));
  } catch (error) {
    console.error('No-result queries error:', error);
    throw error;
  }
}

export async function getTopQueries(project: string, options: {
  limit?: number;
  period?: string;
  sortBy?: 'count' | 'ctr' | 'response_time';
}): Promise<any[]> {
  const db = getDb();
  const { limit = 20, period = '7d', sortBy = 'count' } = options;
  const startDate = new Date(Date.now() - parsePeriod(period));
  
  try {
    const result = await db.query(`
      SELECT 
        q.query,
        COUNT(q.*) as count,
        AVG(q.response_time_ms) as avg_response_time,
        AVG(q.results_count) as avg_results,
        MAX(q.created_at) as last_searched,
        COUNT(c.*) as clicks,
        CASE WHEN COUNT(q.*) > 0 THEN COUNT(c.*)::float / COUNT(q.*) ELSE 0 END as click_through_rate
      FROM query_metrics q
      LEFT JOIN click_metrics c ON q.query = c.query AND q.project_id = c.project_id
      WHERE q.project_id = $1 AND q.created_at >= $2
      GROUP BY q.query
      ORDER BY ${sortBy === 'count' ? 'count' : sortBy === 'ctr' ? 'click_through_rate' : 'avg_response_time'} DESC
      LIMIT $3
    `, [project, startDate, limit]);
    
    return result.rows.map(row => ({
      query: row.query,
      count: parseInt(row.count),
      avgResponseTime: Math.round(row.avg_response_time || 0),
      clickThroughRate: parseFloat(row.click_through_rate || '0'),
      avgResults: Math.round(row.avg_results || 0),
      lastSearched: row.last_searched
    }));
  } catch (error) {
    console.error('Top queries error:', error);
    throw error;
  }
}

export async function getSynonymSuggestions(project: string, options: {
  limit?: number;
  minFrequency?: number;
}): Promise<any[]> {
  // TODO: Implement AI-powered synonym mining from no-result queries
  // This would analyze failed queries and suggest synonyms using LLM
  return [
    {
      sourceQuery: 'typo3 installieren',
      suggestedSynonyms: ['typo3 installation', 'typo3 setup', 'typo3 einrichten'],
      confidence: 0.89,
      impactEstimate: 23,
      frequency: 23
    }
  ];
}

export async function applySynonymRule(project: string, rule: {
  sourceTerms: string[];
  targetTerms: string[];
  type: 'bidirectional' | 'oneway';
  autoApply: boolean;
}): Promise<any> {
  const db = getDb();
  const ruleId = `syn_${Date.now()}`;
  
  try {
    await db.query(`
      INSERT INTO synonyms (id, project_id, terms, type, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [ruleId, project, [...rule.sourceTerms, ...rule.targetTerms], rule.type]);
    
    return {
      id: ruleId,
      sourceTerms: rule.sourceTerms,
      targetTerms: rule.targetTerms,
      type: rule.type,
      status: 'active',
      createdAt: new Date().toISOString(),
      autoApplied: rule.autoApply,
      estimatedQueriesAffected: 42 // TODO: Calculate based on query frequency
    };
  } catch (error) {
    console.error('Apply synonym rule error:', error);
    throw error;
  }
}

// Helper function to parse period strings like "7d", "30d", "1h"
function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)([dhm])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
  
  const [, num, unit] = match;
  const value = parseInt(num);
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

// Placeholder functions for remaining admin features
export async function createBoostRule(project: string, rule: any): Promise<any> {
  return { id: `boost_${Date.now()}`, ...rule, createdAt: new Date().toISOString() };
}

export async function createDemoteRule(project: string, rule: any): Promise<any> {
  return { id: `demote_${Date.now()}`, ...rule, createdAt: new Date().toISOString() };
}

export async function getSearchRules(project: string, options: any): Promise<any[]> {
  return [];
}

export async function deleteRule(project: string, ruleId: string): Promise<void> {
  console.log(`Deleting rule ${ruleId} for project ${project}`);
}

export async function getABTestResults(project: string, options: any): Promise<any[]> {
  return [];
}

export async function toggleABTest(project: string, testName: string, enabled: boolean): Promise<any> {
  return { id: `ab_${Date.now()}`, testName, enabled, updatedAt: new Date().toISOString() };
}
