/**
 * OpenRouter AI DTOs
 * Data Transfer Objects for OpenRouter AI service
 */

/**
 * OpenRouter AI Configuration
 */
export interface OpenRouterConfigDto {
  /** API key */
  apiKey: string;

  /** API URL */
  apiUrl: string;

  /** Model to use */
  model: string;

  /** Max tokens in response */
  maxTokens?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Top P sampling */
  topP?: number;
}

/**
 * Chat Message
 */
export interface ChatMessageDto {
  /** Message role */
  role: 'system' | 'user' | 'assistant';

  /** Message content */
  content: string;
}

/**
 * Chat Completion Request
 */
export interface ChatCompletionRequestDto {
  /** Messages array */
  messages: ChatMessageDto[];

  /** Model override */
  model?: string;

  /** Max tokens */
  maxTokens?: number;

  /** Temperature */
  temperature?: number;

  /** Top P */
  topP?: number;

  /** Stream response */
  stream?: boolean;
}

/**
 * Chat Completion Response
 */
export interface ChatCompletionResponseDto {
  /** Generated response */
  response: string;

  /** Model used */
  model: string;

  /** Tokens used */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Finish reason */
  finishReason?: string;
}

/**
 * Embedding Request
 */
export interface EmbeddingRequestDto {
  /** Text to embed */
  text: string;

  /** Model for embeddings */
  model?: string;
}

/**
 * Embedding Response
 */
export interface EmbeddingResponseDto {
  /** Embedding vector */
  embedding: number[];

  /** Model used */
  model: string;

  /** Dimensions */
  dimensions: number;
}
