-- Initialize schema for confluence documents and embeddings
-- This creates the table structure used by the unit test generator

-- Create confluence_documents table for storing embeddings
CREATE TABLE IF NOT EXISTS confluence_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id VARCHAR(255) NOT NULL,
    title TEXT,
    content TEXT,
    space_key VARCHAR(50),
    embedding vector(1536),  -- Default for OpenAI/OpenRouter embeddings
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_confluence_docs_embedding
ON confluence_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for space_key filtering
CREATE INDEX IF NOT EXISTS idx_confluence_docs_space_key
ON confluence_documents(space_key);

-- Create index for page_id lookups
CREATE INDEX IF NOT EXISTS idx_confluence_docs_page_id
ON confluence_documents(page_id);

-- Create index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_confluence_docs_content_trgm
ON confluence_documents
USING gin(content gin_trgm_ops);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_confluence_documents_updated_at ON confluence_documents;
CREATE TRIGGER update_confluence_documents_updated_at
    BEFORE UPDATE ON confluence_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
