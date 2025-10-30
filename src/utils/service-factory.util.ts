/**
 * Service Factory Utility
 * Helper functions to create service instances from environment variables
 */

import {
  BedrockConfigDto,
  OpenRouterConfigDto,
  VectorStoreConfigDto,
} from '../dtos';
import {
  BedrockAIService,
  OpenRouterAIService,
  VectorStoreService,
} from '../services';
import {AIService} from '../services/requirement-analyzer.service';

/**
 * Create Bedrock AI Service from environment variables
 * Supports two authentication methods:
 * 1. AWS Profile: Set AWS_PROFILE env var (preferred, uses ~/.aws/credentials)
 * 2. Explicit Keys: Set AWS_ACCESS_KEY_BEDROCK and AWS_SECRET_KEY_BEDROCK
 */
export function createBedrockAIService(): BedrockAIService {
  const config: BedrockConfigDto = {
    // Use AWS profile if set, otherwise use explicit keys
    awsProfile: process.env.AWS_PROFILE,
    accessKeyId: process.env.AWS_ACCESS_KEY_BEDROCK,
    secretAccessKey: process.env.AWS_SECRET_KEY_BEDROCK,
    region: process.env.AWS_REGION_BEDROCK || process.env.AWS_REGION || 'us-east-2',
    model:
      process.env.AWS_BEDROCK_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
    embeddingModel:
      process.env.AWS_BEDROCK_EMBEDDING_MODEL ||
      'amazon.titan-embed-text-v2:0',
    subagentModel:
      process.env.CLAUDE_CODE_SUBAGENT_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
  };

  return new BedrockAIService(config);
}

/**
 * Create OpenRouter AI Service from environment variables
 */
export function createOpenRouterAIService(): OpenRouterAIService {
  const config: OpenRouterConfigDto = {
    apiKey: process.env.OPEN_ROUTER_API_KEY || '',
    apiUrl:
      process.env.OPEN_ROUTER_API_URL || 'https://openrouter.ai/api/v1',
    model:
      process.env.OPEN_ROUTER_MODEL || 'google/gemini-2.0-flash-exp:free',
  };

  const service = new OpenRouterAIService(config);
  service.validateConfig(); // Validate config on creation
  return service;
}

/**
 * Create AI Service based on environment configuration
 * Automatically selects Bedrock or OpenRouter based on CLAUDE_CODE_USE_BEDROCK flag
 */
export function createAIService(): AIService {
  const useBedrock = process.env.CLAUDE_CODE_USE_BEDROCK === '1';

  if (useBedrock) {
    console.log('📡 Using AWS Bedrock for AI operations');
    return createBedrockAIService();
  } else {
    console.log('📡 Using OpenRouter for AI operations');
    return createOpenRouterAIService();
  }
}

/**
 * Create Vector Store Service from environment variables
 */
export function createVectorStoreService(): VectorStoreService {
  // Determine vector size based on which AI service is being used
  const useBedrock = process.env.CLAUDE_CODE_USE_BEDROCK === '1';
  const vectorSize = useBedrock
    ? 1024  // AWS Bedrock Titan Embeddings v2
    : 1536; // OpenRouter (OpenAI text-embedding-3-small)

  const config: VectorStoreConfigDto = {
    type: process.env.VECTOR_STORE_TYPE || 'QDRANT',
    url: process.env.VECTOR_STORE_URL || 'http://127.0.0.1:6333',
    collectionName: process.env.VECTOR_STORE_COLLECTION_NAME || 'confluence_documents',
    vectorSize: process.env.VECTOR_STORE_VECTOR_SIZE
      ? parseInt(process.env.VECTOR_STORE_VECTOR_SIZE)
      : vectorSize,
  };

  return new VectorStoreService(config);
}
