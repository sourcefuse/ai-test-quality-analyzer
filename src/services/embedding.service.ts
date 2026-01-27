/**
 * Embedding Service
 * Service class for generating text embeddings using OpenAI or OpenRouter
 * Follows SourceFuse design patterns with separation of concerns
 */

import OpenAI from "openai";
import { getOptionalEnv } from "../utils/env-validator.util";

export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  provider?: "openai" | "openrouter";
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
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
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  /**
   * Constructor
   * @param config - Embedding service configuration
   */
  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.model = config.model || "text-embedding-3-small";
    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 1000;

    // Auto-detect OpenRouter if API key starts with sk-or-
    const useOpenRouter =
      config.provider === "openrouter" || config.apiKey?.startsWith("sk-or-");

    if (useOpenRouter) {
      console.log("✅ Using OpenRouter for embeddings");
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": getOptionalEnv(
            "OPENROUTER_SITE_URL",
            "http://localhost",
          ),
          "X-Title": getOptionalEnv(
            "OPENROUTER_SITE_NAME",
            "CheckUnitTestCases",
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
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable (network errors, rate limits, etc.)
   */
  private isRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || "";
    const code = error?.code || error?.cause?.code || "";

    return (
      message.includes("terminated") ||
      message.includes("socket") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      code === "UND_ERR_SOCKET" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT"
    );
  }

  /**
   * Generate embedding for a single text with retry logic
   * @param text - Text to generate embedding for
   * @returns Embedding vector (array of numbers)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Skip empty or very short text
    if (!text || text.trim().length < 10) {
      console.warn(
        `⚠️  Text too short for embedding (${text?.length || 0} chars). Minimum 10 characters required.`
      );
      return [];
    }

    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: text,
        });

        return response.data[0].embedding;
      } catch (error: any) {
        lastError = error;

        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error or max retries reached
        break;
      }
    }

    // Log error only after all retries failed (suppress verbose error output)
    // Return empty array to allow processing to continue
    console.error(
      `❌ Failed to generate embedding after ${this.maxRetries} attempts:`,
      lastError?.message || lastError
    );
    return [];
  }

  /**
   * Generate embeddings for multiple texts in batch with controlled concurrency
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const concurrency = this.config.concurrency || 5;
    const results: number[][] = new Array(texts.length);

    // Create a queue of items to process
    const queue = texts.map((text, index) => ({ text, index }));

    // Create worker promises
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        const embedding = await this.generateEmbedding(item.text);
        results[item.index] = embedding;
      }
    });

    await Promise.all(workers);

    // Log summary after all embeddings generated
    const successCount = results.filter((r) => r.length > 0).length;
    console.log(`   ✅ Generated ${successCount}/${texts.length} embeddings`);

    return results;
  }

  /**
   * Get embedding dimensions for the current model
   * @returns Number of dimensions in the embedding vector
   */
  getEmbeddingDimensions(): number {
    // text-embedding-3-small has 1536 dimensions
    // text-embedding-3-large has 3072 dimensions
    if (this.model === "text-embedding-3-large") {
      return 3072;
    }
    return 1536;
  }
}
