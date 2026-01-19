-- Initialize schema for confluence documents and embeddings
-- This creates the table structure used by the unit test generator
-- Schema must match postgres-vector.service.ts

-- Create confluence_documents table
CREATE TABLE IF NOT EXISTS confluence_documents (
    id SERIAL PRIMARY KEY,
    project_key VARCHAR(50),
    page_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    url TEXT,
    embedding vector(1536),
    last_modified TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day'),
    ticket_id VARCHAR(50),
    relevance_score DECIMAL(5,3),
    matched_by TEXT[],
    filter_metadata JSONB
);

-- Create document_chunks table with vector column
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES confluence_documents(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_confluence_docs_embedding
ON confluence_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for project_key filtering
CREATE INDEX IF NOT EXISTS idx_confluence_docs_project_key
ON confluence_documents(project_key);

-- Create index for page_id lookups
CREATE INDEX IF NOT EXISTS idx_confluence_docs_page_id
ON confluence_documents(page_id);

-- Create index for ticket_id lookups
CREATE INDEX IF NOT EXISTS idx_confluence_docs_ticket_id
ON confluence_documents(ticket_id);

-- Create index for document_id in chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
ON document_chunks(document_id);

-- Create index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_confluence_docs_content_trgm
ON confluence_documents
USING gin(content gin_trgm_ops);
