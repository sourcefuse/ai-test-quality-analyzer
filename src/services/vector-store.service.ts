/**
 * Vector Store Service
 * Service class for interacting with Qdrant vector database
 * Follows SourceFuse design patterns with separation of concerns
 */

import {QdrantClient} from '@qdrant/qdrant-js';
import {
  VectorStoreConfigDto,
  UpsertDocumentRequestDto,
  VectorSearchRequestDto,
  VectorSearchResponseDto,
  DeleteDocumentRequestDto,
  CollectionInfoResponseDto,
} from '../dtos';
import {VectorDocument} from '../models';
import {
  VECTOR_STORE_DEFAULTS,
  VECTOR_STORE_ERROR_MESSAGES,
  DISTANCE_METRICS,
} from '../constants';

/**
 * Vector Store Service Class
 * Handles all vector database operations with Qdrant
 */
export class VectorStoreService {
  private readonly client: QdrantClient;
  private readonly config: VectorStoreConfigDto;
  private readonly collectionName: string;

  /**
   * Constructor
   * @param config - Vector store configuration
   */
  constructor(config: VectorStoreConfigDto) {
    this.config = config;
    this.collectionName =
      config.collectionName || VECTOR_STORE_DEFAULTS.COLLECTION_NAME;

    // Create Qdrant client
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
      checkCompatibility: false, // Disable version check to avoid compatibility warnings
    });
  }

  /**
   * Initialize collection
   * Creates collection if it doesn't exist
   */
  async initializeCollection(): Promise<void> {
    try {
      console.log(`🔧 Initializing vector store collection: ${this.collectionName}`);

      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        c => c.name === this.collectionName,
      );

      if (!exists) {
        console.log(`   Collection doesn't exist, creating...`);

        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.config.vectorSize || VECTOR_STORE_DEFAULTS.VECTOR_SIZE,
            distance:
              (this.config.distanceMetric as any) ||
              DISTANCE_METRICS.COSINE,
          },
        });

        console.log(`✅ Collection created: ${this.collectionName}`);
      } else {
        console.log(`✅ Collection already exists: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('❌ Error initializing collection:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Upsert document
   * Add or update document in vector store
   *
   * @param request - Upsert document request
   * @param embedding - Pre-computed embedding vector
   */
  async upsertDocument(
    request: UpsertDocumentRequestDto,
    embedding: number[],
  ): Promise<void> {
    try {
      console.log(`📝 Upserting document: ${request.id}`);

      if (!embedding || embedding.length === 0) {
        throw new Error(VECTOR_STORE_ERROR_MESSAGES.INVALID_EMBEDDING);
      }

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: request.id,
            vector: embedding,
            payload: {
              content: request.content,
              ...request.metadata,
            },
          },
        ],
      });

      console.log(`✅ Document upserted: ${request.id}`);
    } catch (error) {
      console.error('❌ Error upserting document:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Upsert multiple documents in batch
   *
   * @param requests - Array of upsert requests
   * @param embeddings - Array of embedding vectors
   */
  async upsertBatch(
    requests: UpsertDocumentRequestDto[],
    embeddings: number[][],
  ): Promise<void> {
    try {
      console.log(`📝 Upserting ${requests.length} documents in batch`);

      if (requests.length !== embeddings.length) {
        throw new Error('Number of requests must match number of embeddings');
      }

      const points = requests.map((request, index) => ({
        id: request.id,
        vector: embeddings[index],
        payload: {
          content: request.content,
          ...request.metadata,
        },
      }));

      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      console.log(`✅ Batch upsert completed: ${requests.length} documents`);
    } catch (error) {
      console.error('❌ Error upserting batch:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Search for similar documents
   *
   * @param request - Search request
   * @param queryEmbedding - Query embedding vector
   * @returns Search results
   */
  async search(
    request: VectorSearchRequestDto,
    queryEmbedding: number[],
  ): Promise<VectorSearchResponseDto> {
    try {
      console.log(`🔍 Searching for: "${request.query}"`);

      const limit = request.limit || VECTOR_STORE_DEFAULTS.DEFAULT_LIMIT;
      const minScore =
        request.minScore || VECTOR_STORE_DEFAULTS.DEFAULT_MIN_SCORE;

      const searchResults = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        score_threshold: minScore,
        filter: request.filter,
        with_payload: true,
      });

      const results: VectorDocument[] = searchResults.map(result => ({
        id: result.id as string,
        content: (result.payload?.content as string) || '',
        metadata: {
          source: (result.payload?.source as string) || '',
          sourceId: (result.payload?.sourceId as string) || '',
          title: (result.payload?.title as string) || '',
          spaceKey: result.payload?.spaceKey as string,
          projectKey: result.payload?.projectKey as string,
          type: result.payload?.type as string,
          createdAt: result.payload?.createdAt as string,
          modifiedAt: result.payload?.modifiedAt as string,
        },
        score: result.score,
      }));

      console.log(`✅ Found ${results.length} matching document(s)`);

      return {
        results,
        total: results.length,
        query: request.query,
      };
    } catch (error) {
      console.error('❌ Error searching documents:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete documents by IDs
   *
   * @param request - Delete request with document IDs
   */
  async deleteDocuments(request: DeleteDocumentRequestDto): Promise<void> {
    try {
      console.log(`🗑️  Deleting ${request.ids.length} document(s)`);

      await this.client.delete(this.collectionName, {
        wait: true,
        points: request.ids,
      });

      console.log(`✅ Documents deleted: ${request.ids.length}`);
    } catch (error) {
      console.error('❌ Error deleting documents:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete all documents matching filter
   *
   * @param filter - Filter criteria
   */
  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      console.log(`🗑️  Deleting documents by filter`);

      await this.client.delete(this.collectionName, {
        wait: true,
        filter,
      });

      console.log(`✅ Documents deleted by filter`);
    } catch (error) {
      console.error('❌ Error deleting by filter:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get collection information
   *
   * @returns Collection info
   */
  async getCollectionInfo(): Promise<CollectionInfoResponseDto> {
    try {
      const info = await this.client.getCollection(this.collectionName);

      // Extract vector config - handle both simple and complex structures
      const vectorConfig = info.config?.params?.vectors as any;
      const vectorSize = typeof vectorConfig === 'object' ? vectorConfig.size : 0;
      const distanceMetric = typeof vectorConfig === 'object'
        ? String(vectorConfig.distance || DISTANCE_METRICS.COSINE)
        : DISTANCE_METRICS.COSINE;

      return {
        name: this.collectionName,
        documentCount: info.points_count || 0,
        vectorSize: vectorSize || 0,
        distanceMetric,
      };
    } catch (error) {
      console.error('❌ Error getting collection info:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate configuration
   * Throws error if required configuration is missing
   */
  validateConfig(): void {
    const missingFields: string[] = [];

    if (!this.config.url) {
      missingFields.push('url');
    }
    if (!this.config.type) {
      missingFields.push('type');
    }

    if (missingFields.length > 0) {
      throw new Error(
        `${VECTOR_STORE_ERROR_MESSAGES.MISSING_CONFIG}\n` +
          `Missing fields: ${missingFields.join(', ')}`,
      );
    }
  }

  /**
   * Handle errors
   * @param error - Error object
   * @returns Formatted error
   */
  private handleError(error: any): Error {
    let message: string = VECTOR_STORE_ERROR_MESSAGES.CONNECTION_FAILED;

    if (error.message) {
      message = error.message;
    }

    console.error(`❌ Vector Store Error: ${message}`);

    const enhancedError = new Error(message) as any;
    enhancedError.originalError = error;

    return enhancedError;
  }
}
