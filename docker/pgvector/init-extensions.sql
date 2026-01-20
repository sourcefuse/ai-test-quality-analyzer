-- Initialize PostgreSQL extensions for RAG/vector search
-- This runs automatically on first container start

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search (useful for hybrid search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
