-- pixelcoda Search Database Initialization
-- This script runs when the PostgreSQL container starts for the first time

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create user if not exists (for development)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pixelcoda') THEN
        CREATE ROLE pixelcoda WITH LOGIN PASSWORD 'pixelcoda_dev';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE pixelcoda_search TO pixelcoda;
GRANT ALL ON SCHEMA public TO pixelcoda;

-- Create tables
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
);

-- Create synonyms table
CREATE TABLE IF NOT EXISTS synonyms (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    terms TEXT[] NOT NULL,
    lang TEXT DEFAULT 'de',
    type TEXT DEFAULT 'synonym',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metrics tables
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
);

CREATE TABLE IF NOT EXISTS click_metrics (
    id SERIAL PRIMARY KEY,
    project_id TEXT NOT NULL,
    query TEXT NOT NULL,
    document_id TEXT NOT NULL,
    position INTEGER,
    url TEXT,
    collection TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL CHECK (scope IN ('read', 'write', 'admin')),
    project_id TEXT,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS chunks_project_collection_idx ON chunks(project_id, collection);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS synonyms_project_idx ON synonyms(project_id);
CREATE INDEX IF NOT EXISTS synonyms_lang_idx ON synonyms(lang);

CREATE INDEX IF NOT EXISTS query_metrics_project_date_idx ON query_metrics(project_id, created_at);
CREATE INDEX IF NOT EXISTS query_metrics_query_idx ON query_metrics(query);

CREATE INDEX IF NOT EXISTS click_metrics_project_date_idx ON click_metrics(project_id, created_at);
CREATE INDEX IF NOT EXISTS click_metrics_document_idx ON click_metrics(document_id);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_project_idx ON api_keys(project_id);

-- Grant permissions on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO pixelcoda;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO pixelcoda;

-- Insert default API keys for development
INSERT INTO api_keys (id, key_hash, scope, project_id, name) VALUES
('default-read', encode(sha256('pc_read_dev_key'::bytea), 'hex'), 'read', NULL, 'Development Read Key'),
('default-write', encode(sha256('pc_write_dev_key'::bytea), 'hex'), 'write', NULL, 'Development Write Key')
ON CONFLICT (key_hash) DO NOTHING;

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for chunks table
DROP TRIGGER IF EXISTS update_chunks_updated_at ON chunks;
CREATE TRIGGER update_chunks_updated_at
    BEFORE UPDATE ON chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to log API key usage
CREATE OR REPLACE FUNCTION log_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = NEW.key_hash;
    RETURN NEW;
END;
$$ language 'plpgsql';
