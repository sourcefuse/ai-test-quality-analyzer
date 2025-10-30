/**
 * Vector Store DTOs
 * Data Transfer Objects for vector database operations
 */

import {VectorDocument, VectorDocumentMetadata} from '../models';

/**
 * Vector Store Configuration
 */
export interface VectorStoreConfigDto {
  /** Vector store type (QDRANT, PINECONE, etc.) */
  type: string;

  /** Vector store URL */
  url: string;

  /** API key (if required) */
  apiKey?: string;

  /** Collection/Index name */
  collectionName?: string;

  /** Vector dimensions */
  vectorSize?: number;

  /** Distance metric (cosine, euclidean, dot) */
  distanceMetric?: string;
}

/**
 * Upsert Document Request
 */
export interface UpsertDocumentRequestDto {
  /** Document ID */
  id: string;

  /** Document content */
  content: string;

  /** Document metadata */
  metadata: VectorDocumentMetadata;

  /** Pre-computed embedding (optional) */
  embedding?: number[];
}

/**
 * Search Request
 */
export interface VectorSearchRequestDto {
  /** Query text to search for */
  query: string;

  /** Number of results to return */
  limit?: number;

  /** Minimum similarity score (0-1) */
  minScore?: number;

  /** Filter by metadata */
  filter?: Record<string, any>;
}

/**
 * Search Response
 */
export interface VectorSearchResponseDto {
  /** Search results */
  results: VectorDocument[];

  /** Total results found */
  total: number;

  /** Query text used */
  query: string;
}

/**
 * Delete Document Request
 */
export interface DeleteDocumentRequestDto {
  /** Document IDs to delete */
  ids: string[];
}

/**
 * Collection Info Response
 */
export interface CollectionInfoResponseDto {
  /** Collection name */
  name: string;

  /** Number of documents */
  documentCount: number;

  /** Vector dimensions */
  vectorSize: number;

  /** Distance metric */
  distanceMetric: string;
}
