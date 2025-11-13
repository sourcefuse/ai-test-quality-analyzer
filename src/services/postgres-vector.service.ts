/**
 * PostgreSQL Vector Store Service
 * Service class for interacting with PostgreSQL + pgvector for vector operations
 * Follows SourceFuse design patterns with separation of concerns
 */

import {Pool, PoolClient, QueryResult, QueryResultRow} from 'pg';

export interface PostgresVectorConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  max?: number;
}

export interface SearchResult {
  id: number;
  documentId: number;
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  text: string;
  similarity: number;
}

export interface DocumentChunk {
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

/**
 * PostgreSQL Vector Store Service Class
 * Handles vector database operations with PostgreSQL + pgvector extension
 */
export class PostgresVectorService {
  private pool: Pool | null = null;
  private readonly config: PostgresVectorConfig;

  /**
   * Constructor
   * @param config - PostgreSQL configuration
   */
  constructor(config: PostgresVectorConfig) {
    this.config = {
      ...config,
      port: config.port || 5432,
      max: config.max || 20,
    };
  }

  /**
   * Initialize database connection pool and create tables
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing PostgreSQL connection...');

      // Determine SSL configuration based on host
      // For localhost connections, disable SSL; for remote connections, use SSL with self-signed cert support
      const isLocalhost = this.config.host === 'localhost' || this.config.host === '127.0.0.1';
      const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: this.config.max,
        ssl: sslConfig,
      });

      // Test connection
      const client = await this.pool.connect();

      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      // Create tables if they don't exist
      await this.createTables(client);

      client.release();

      console.log('✅ PostgreSQL initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Create necessary tables for vector storage
   */
  private async createTables(client: PoolClient): Promise<void> {
    // Create confluence_documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS confluence_documents (
        id SERIAL PRIMARY KEY,
        project_key VARCHAR(50),
        page_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT,
        url VARCHAR(1000),
        source VARCHAR(50) DEFAULT 'confluence',
        last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day')
      )
    `);

    // Add project_key column if it doesn't exist (for existing tables)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'confluence_documents'
          AND column_name = 'project_key'
        ) THEN
          ALTER TABLE confluence_documents
          ADD COLUMN project_key VARCHAR(50);
        END IF;
      END $$;
    `);

    // Add expires_at column if it doesn't exist (for existing tables)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'confluence_documents'
          AND column_name = 'expires_at'
        ) THEN
          ALTER TABLE confluence_documents
          ADD COLUMN expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day');
        END IF;
      END $$;
    `);

    // Create document_chunks table with vector column
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES confluence_documents(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day')
      )
    `);

    // Add expires_at column to document_chunks if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'document_chunks'
          AND column_name = 'expires_at'
        ) THEN
          ALTER TABLE document_chunks
          ADD COLUMN expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day');
        END IF;
      END $$;
    `);

    // Create index for faster similarity search
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
      ON document_chunks
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);

    console.log('   ✅ Tables and indexes created/verified');
  }

  /**
   * Upsert a Confluence document
   * @param pageId - Confluence page ID
   * @param title - Page title
   * @param content - Page content
   * @param url - Page URL
   * @param projectKey - JIRA project key (optional)
   * @returns Document ID
   */
  async upsertDocument(
    pageId: string,
    title: string,
    content: string,
    url: string,
    projectKey?: string,
  ): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');

    const result = await this.pool.query<{id: number}>(
      `
      INSERT INTO confluence_documents (project_key, page_id, title, content, url, last_modified, expires_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day')
      ON CONFLICT (page_id) DO UPDATE SET
        project_key = EXCLUDED.project_key,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        url = EXCLUDED.url,
        last_modified = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '1 day'
      RETURNING id
    `,
      [projectKey, pageId, title, content, url],
    );

    return result.rows[0].id;
  }

  /**
   * Upsert document chunks with embeddings
   * @param documentId - Document ID
   * @param chunks - Array of chunks with embeddings
   */
  async upsertChunks(
    documentId: number,
    chunks: DocumentChunk[],
  ): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    // Delete existing chunks for this document
    await this.pool.query('DELETE FROM document_chunks WHERE document_id = $1', [
      documentId,
    ]);

    // Insert new chunks with 1-day expiry
    for (const chunk of chunks) {
      // Skip chunks with empty or invalid embeddings
      if (!chunk.embedding || chunk.embedding.length === 0) {
        console.warn(`Skipping chunk with empty embedding for document ${documentId}`);
        continue;
      }

      const embeddingString = `[${chunk.embedding.join(',')}]`;

      await this.pool.query(
        `
        INSERT INTO document_chunks (document_id, text, embedding, metadata, expires_at)
        VALUES ($1, $2, $3::vector, $4, CURRENT_TIMESTAMP + INTERVAL '1 day')
      `,
        [documentId, chunk.text, embeddingString, JSON.stringify(chunk.metadata)],
      );
    }
  }

  /**
   * Search for similar documents using vector similarity
   * @param queryEmbedding - Query embedding vector
   * @param topK - Number of results to return
   * @returns Array of similar documents with similarity scores
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number = 5,
  ): Promise<SearchResult[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const embeddingString = `[${queryEmbedding.join(',')}]`;

    interface DbSearchResult {
      id: number;
      document_id: number;
      page_id: string;
      page_title: string;
      page_url: string;
      text: string;
      similarity: number;
    }

    const result = await this.pool.query<DbSearchResult>(
      `
      SELECT
        dc.id,
        dc.document_id,
        cd.page_id,
        cd.title as page_title,
        cd.url as page_url,
        dc.text,
        1 - (dc.embedding <=> $1::vector) as similarity
      FROM document_chunks dc
      JOIN confluence_documents cd ON dc.document_id = cd.id
      WHERE dc.expires_at > CURRENT_TIMESTAMP
        AND cd.expires_at > CURRENT_TIMESTAMP
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
    `,
      [embeddingString, topK],
    );

    return result.rows.map(row => ({
      id: row.id,
      documentId: row.document_id,
      pageId: row.page_id,
      pageTitle: row.page_title,
      pageUrl: row.page_url,
      text: row.text,
      similarity: row.similarity,
    }));
  }

  /**
   * Get document count
   * @returns Number of documents in the database
   */
  async getDocumentCount(): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');

    const result = await this.pool.query<{count: string}>(
      'SELECT COUNT(*) as count FROM confluence_documents',
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get count of non-expired documents for a specific project key
   * @param projectKey - JIRA project key
   * @returns Number of non-expired documents for the project
   */
  async getDocumentCountByProjectKey(projectKey: string): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');

    const result = await this.pool.query<{count: string}>(
      `SELECT COUNT(*) as count
       FROM confluence_documents
       WHERE project_key = $1
       AND expires_at > CURRENT_TIMESTAMP`,
      [projectKey],
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get chunk count
   * @returns Number of chunks in the database
   */
  async getChunkCount(): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');

    const result = await this.pool.query<{count: string}>(
      'SELECT COUNT(*) as count FROM document_chunks',
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Clean up expired records from database
   * Deletes all documents and chunks where expires_at < CURRENT_TIMESTAMP
   * @returns Number of documents and chunks deleted
   */
  async cleanupExpired(): Promise<{documents: number; chunks: number}> {
    if (!this.pool) throw new Error('Database not initialized');

    // Delete expired chunks (will cascade delete is handled at row level)
    const chunksResult = await this.pool.query<{count: string}>(
      'DELETE FROM document_chunks WHERE expires_at <= CURRENT_TIMESTAMP RETURNING id',
    );

    // Delete expired documents (CASCADE will delete related chunks)
    const docsResult = await this.pool.query<{count: string}>(
      'DELETE FROM confluence_documents WHERE expires_at <= CURRENT_TIMESTAMP RETURNING id',
    );

    const documentsDeleted = docsResult.rowCount || 0;
    const chunksDeleted = chunksResult.rowCount || 0;

    if (documentsDeleted > 0 || chunksDeleted > 0) {
      console.log(
        `🗑️  Cleaned up ${documentsDeleted} expired document(s) and ${chunksDeleted} expired chunk(s)`,
      );
    }

    return {documents: documentsDeleted, chunks: chunksDeleted};
  }

  /**
   * Clean up expired records for a specific project key
   * Deletes documents and chunks where expires_at <= CURRENT_TIMESTAMP AND project_key matches
   * @param projectKey - JIRA project key
   * @returns Number of documents and chunks deleted
   */
  async cleanupExpiredByProjectKey(projectKey: string): Promise<{documents: number; chunks: number}> {
    if (!this.pool) throw new Error('Database not initialized');

    // Delete expired chunks for this project (by joining with confluence_documents)
    const chunksResult = await this.pool.query<{count: string}>(
      `DELETE FROM document_chunks
       WHERE expires_at <= CURRENT_TIMESTAMP
       AND document_id IN (
         SELECT id FROM confluence_documents WHERE project_key = $1
       )
       RETURNING id`,
      [projectKey],
    );

    // Delete expired documents for this project (CASCADE will delete related chunks)
    const docsResult = await this.pool.query<{count: string}>(
      `DELETE FROM confluence_documents
       WHERE expires_at <= CURRENT_TIMESTAMP
       AND project_key = $1
       RETURNING id`,
      [projectKey],
    );

    const documentsDeleted = docsResult.rowCount || 0;
    const chunksDeleted = chunksResult.rowCount || 0;

    if (documentsDeleted > 0 || chunksDeleted > 0) {
      console.log(
        `🗑️  Cleaned up ${documentsDeleted} expired document(s) and ${chunksDeleted} expired chunk(s) for project ${projectKey}`,
      );
    }

    return {documents: documentsDeleted, chunks: chunksDeleted};
  }

  /**
   * Close database connection
   * Optionally cleans up expired records for a specific project before closing
   * @param projectKey - Optional JIRA project key to clean up expired records
   */
  async close(projectKey?: string): Promise<void> {
    if (this.pool) {
      // Clean up expired records before closing if project key is provided
      if (projectKey) {
        console.log(`\n🗑️  Cleaning up expired records for project ${projectKey}...`);
        await this.cleanupExpiredByProjectKey(projectKey);
      }

      await this.pool.end();
      this.pool = null;
      console.log('✅ PostgreSQL connection closed');
    }
  }

  /**
   * Execute a raw query (for advanced operations)
   * @param query - SQL query
   * @param params - Query parameters
   * @returns Query result
   */
  async query<T extends QueryResultRow = any>(
    query: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('Database not initialized');
    return this.pool.query<T>(query, params);
  }
}
