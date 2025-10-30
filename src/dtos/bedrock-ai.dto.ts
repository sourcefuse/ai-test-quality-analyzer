/**
 * AWS Bedrock AI DTOs
 * Data Transfer Objects for AWS Bedrock AI service
 */

/**
 * AWS Bedrock Configuration
 * Supports two authentication methods:
 * 1. AWS Profile: Set awsProfile (credentials from ~/.aws/credentials)
 * 2. Explicit Keys: Set accessKeyId and secretAccessKey
 */
export interface BedrockConfigDto {
  /** AWS Access Key ID (optional if using awsProfile) */
  accessKeyId?: string;

  /** AWS Secret Access Key (optional if using awsProfile) */
  secretAccessKey?: string;

  /** AWS Profile name (e.g., 'awsbedrock' from ~/.aws/credentials) */
  awsProfile?: string;

  /** AWS Region */
  region: string;

  /** Bedrock Model ID for chat */
  model: string;

  /** Bedrock Model ID for embeddings */
  embeddingModel?: string;

  /** Subagent Model ID (for task delegation) */
  subagentModel?: string;

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
export interface BedrockChatMessageDto {
  /** Message role */
  role: 'user' | 'assistant';

  /** Message content */
  content: string;
}

/**
 * Chat Completion Request
 */
export interface BedrockChatCompletionRequestDto {
  /** Messages array */
  messages: BedrockChatMessageDto[];

  /** System prompt */
  system?: string;

  /** Max tokens */
  maxTokens?: number;

  /** Temperature */
  temperature?: number;

  /** Top P */
  topP?: number;
}

/**
 * Chat Completion Response
 */
export interface BedrockChatCompletionResponseDto {
  /** Generated response */
  response: string;

  /** Model used */
  model: string;

  /** Tokens used */
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };

  /** Stop reason */
  stopReason?: string;
}

/**
 * Embedding Request
 */
export interface BedrockEmbeddingRequestDto {
  /** Text to embed */
  text: string;

  /** Model for embeddings (optional override) */
  model?: string;
}

/**
 * Embedding Response
 */
export interface BedrockEmbeddingResponseDto {
  /** Embedding vector */
  embedding: number[];

  /** Model used */
  model: string;

  /** Dimensions */
  dimensions: number;
}
