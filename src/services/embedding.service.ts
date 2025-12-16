/**
 * Embedding Service
 * Service class for generating text embeddings using OpenAI or OpenRouter
 * Follows SourceFuse design patterns with separation of concerns
 */

import OpenAI from 'openai';
import {getOptionalEnv} from '../utils/env-validator.util';

export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  provider?: 'openai' | 'openrouter';
  concurrency?: number;
  silentMode?: boolean;
}

/**
 * Embedding Service Class
 * Handles text embedding generation with support for batch processing
 */
export class EmbeddingService {
  private readonly client: OpenAI;
  private readonly config: EmbeddingConfig;
  private readonly model: string;

  /**
   * Constructor
   * @param config - Embedding service configuration
   */
  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.model = config.model || 'text-embedding-3-small';

    // Auto-detect OpenRouter if API key starts with sk-or-
    const useOpenRouter =
      config.provider === 'openrouter' || config.apiKey?.startsWith('sk-or-');

    if (useOpenRouter) {
      console.log('✅ Using OpenRouter for embeddings');
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': getOptionalEnv(
            'OPENROUTER_SITE_URL',
            'http://localhost'
          ),
          'X-Title': getOptionalEnv(
            'OPENROUTER_SITE_NAME',
            'CheckUnitTestCases'
          ),
        },
      });
    } else {
      this.client = new OpenAI({
        apiKey: config.apiKey,
      });
    }
  }

  /**
   * Generate embedding for a single text
   * @param text - Text to generate embedding for
   * @returns Embedding vector (array of numbers)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Skip empty or very short text
      if (!text || text.trim().length < 10) {
        if (!this.config.silentMode) {
          console.warn('⚠️  Skipping embedding generation for empty or very short text');
        }
        return [];
      }

      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      // Defensive check for undefined response structure
      if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
        console.error('⚠️  Invalid embedding response structure');
        console.error('   Response:', JSON.stringify(response, null, 2));
        return [];
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      // Return empty array instead of throwing to allow processing to continue
      return [];
    }
  }

  /**
   * Generate embeddings for multiple texts in batch with controlled concurrency
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const concurrency = this.config.concurrency || 10;
    const results: number[][] = new Array(texts.length);

    // Create a queue of items to process
    const queue = texts.map((text, index) => ({text, index}));

    // Create worker promises
    const workers = Array.from({length: concurrency}, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        try {
          const embedding = await this.generateEmbedding(item.text);
          results[item.index] = embedding;

          // Progress indicator (respect silent mode)
          if (!this.config.silentMode && (item.index + 1) % 10 === 0) {
            console.log(`   Generated ${item.index + 1}/${texts.length} embeddings`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to generate embedding for item ${item.index}:`, error);
          results[item.index] = [];
        }
      }
    });

    await Promise.all(workers);

    return results;
  }

  /**
   * Get embedding dimensions for the current model
   * @returns Number of dimensions in the embedding vector
   */
  getEmbeddingDimensions(): number {
    // text-embedding-3-small has 1536 dimensions
    // text-embedding-3-large has 3072 dimensions
    if (this.model === 'text-embedding-3-large') {
      return 3072;
    }
    return 1536;
  }
}
