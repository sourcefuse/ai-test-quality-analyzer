/**
 * Service Factory Utility
 * Helper functions to create service instances from environment variables
 */

import {
  BedrockConfigDto,
  OpenRouterConfigDto,
} from '../dtos';
import {
  BedrockAIService,
  OpenRouterAIService,
  PostgresVectorService,
} from '../services';
import {
  getRequiredEnv,
  getRequiredEnvAsNumber,
  getOptionalEnv,
  getOptionalEnvAsNumber,
} from './env-validator.util';

/**
 * AI Service Type
 * Union type of supported AI service implementations
 */
export type AIService = BedrockAIService | OpenRouterAIService;

/**
 * Create Bedrock AI Service from environment variables
 * Supports two authentication methods:
 * 1. AWS Profile: Set AWS_PROFILE env var (preferred, uses ~/.aws/credentials)
 * 2. Explicit Keys: Set AWS_ACCESS_KEY_BEDROCK and AWS_SECRET_KEY_BEDROCK
 */
export function createBedrockAIService(): BedrockAIService {
  // At least one authentication method must be provided
  const awsProfile = process.env.AWS_PROFILE;
  const accessKeyId = process.env.AWS_ACCESS_KEY_BEDROCK;
  const secretAccessKey = process.env.AWS_SECRET_KEY_BEDROCK;

  if (!awsProfile && (!accessKeyId || !secretAccessKey)) {
    throw new Error(
      'AWS Bedrock authentication required: Either set AWS_PROFILE or both AWS_ACCESS_KEY_BEDROCK and AWS_SECRET_KEY_BEDROCK'
    );
  }

  const config: BedrockConfigDto = {
    awsProfile,
    accessKeyId,
    secretAccessKey,
    region: getRequiredEnv('AWS_REGION', 'AWS region for Bedrock'),
    model: getRequiredEnv('AWS_BEDROCK_MODEL', 'AWS Bedrock model name'),
    embeddingModel: getRequiredEnv(
      'AWS_BEDROCK_EMBEDDING_MODEL',
      'AWS Bedrock embedding model'
    ),
    subagentModel: getOptionalEnv(
      'CLAUDE_CODE_SUBAGENT_MODEL',
      getRequiredEnv('AWS_BEDROCK_MODEL', 'AWS Bedrock model name')
    ),
  };

  return new BedrockAIService(config);
}

/**
 * Create OpenRouter AI Service from environment variables
 */
export function createOpenRouterAIService(): OpenRouterAIService {
  const config: OpenRouterConfigDto = {
    apiKey: getRequiredEnv('OPEN_ROUTER_API_KEY', 'OpenRouter API key'),
    apiUrl: getOptionalEnv(
      'OPEN_ROUTER_API_URL',
      'https://openrouter.ai/api/v1'
    ),
    model: getRequiredEnv('OPEN_ROUTER_MODEL', 'OpenRouter model name'),
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
 * Create PostgreSQL Vector Store Service from environment variables
 */
export function createVectorStoreService(): PostgresVectorService {
  const config = {
    host: getRequiredEnv('DATABASE_HOST', 'PostgreSQL host'),
    port: getRequiredEnvAsNumber('DATABASE_PORT', 'PostgreSQL port'),
    database: getRequiredEnv('DATABASE_NAME', 'PostgreSQL database name'),
    user: getRequiredEnv('DATABASE_USER', 'PostgreSQL user'),
    password: getRequiredEnv('DATABASE_PASSWORD', 'PostgreSQL password'),
  };

  return new PostgresVectorService(config);
}
