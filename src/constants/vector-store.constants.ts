/**
 * Vector Store Constants
 * Constants for vector database operations
 */

export const VECTOR_STORE_TYPES = {
  QDRANT: 'QDRANT',
  PINECONE: 'PINECONE',
  WEAVIATE: 'WEAVIATE',
  MILVUS: 'MILVUS',
} as const;

export const VECTOR_STORE_DEFAULTS = {
  COLLECTION_NAME: 'confluence-docs',
  VECTOR_SIZE: 1024, // AWS Bedrock Titan Embeddings v2 size
  DISTANCE_METRIC: 'Cosine',
  DEFAULT_LIMIT: 10,
  DEFAULT_MIN_SCORE: 0.7,
  BATCH_SIZE: 100,
} as const;

export const DISTANCE_METRICS = {
  COSINE: 'Cosine',
  EUCLIDEAN: 'Euclidean',
  DOT: 'Dot',
} as const;

export const VECTOR_STORE_ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Failed to connect to vector store',
  COLLECTION_NOT_FOUND: 'Collection not found',
  UPSERT_FAILED: 'Failed to upsert document',
  SEARCH_FAILED: 'Failed to search documents',
  DELETE_FAILED: 'Failed to delete documents',
  MISSING_CONFIG: 'Missing required vector store configuration',
  INVALID_EMBEDDING: 'Invalid embedding vector',
} as const;

export const VECTOR_STORE_STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;
