/**
 * AWS Bedrock AI Service
 * Service class for interacting with AWS Bedrock API using Anthropic SDK
 * Follows SourceFuse design patterns with separation of concerns
 */

import Anthropic from '@anthropic-ai/sdk';
import {AnthropicBedrock} from '@anthropic-ai/bedrock-sdk';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockConfigDto,
  BedrockChatCompletionRequestDto,
  BedrockChatCompletionResponseDto,
  BedrockEmbeddingRequestDto,
  BedrockEmbeddingResponseDto,
} from '../dtos';
import {
  BEDROCK_DEFAULTS,
  BEDROCK_ERROR_MESSAGES,
} from '../constants';

/**
 * AWS Bedrock AI Service Class
 * Uses Anthropic SDK for Claude chat completions and AWS SDK for Titan embeddings
 */
export class BedrockAIService {
  private readonly client: AnthropicBedrock;
  private readonly embeddingClient: BedrockRuntimeClient;
  private readonly config: BedrockConfigDto;

  /**
   * Constructor
   * @param config - Bedrock configuration
   */
  constructor(config: BedrockConfigDto) {
    this.config = config;

    const region = config.region || BEDROCK_DEFAULTS.REGION;
    console.log(`🚀 Initializing BedrockAIService in region: ${region}`);

    // Create Anthropic Bedrock client for Claude chat completions
    // If AWS profile is provided, use it; otherwise use explicit keys
    if (config.awsProfile) {
      // Use AWS profile (credentials from ~/.aws/credentials)
      this.client = new AnthropicBedrock({
        awsRegion: region,
        // awsProfile will be picked up from AWS_PROFILE env var
      });

      this.embeddingClient = new BedrockRuntimeClient({
        region,
        // Will use default credential provider chain (includes profile)
      });
    } else {
      // Use explicit access keys
      if (!config.accessKeyId || !config.secretAccessKey) {
        throw new Error('AWS credentials required: set AWS_PROFILE or AWS_ACCESS_KEY_BEDROCK/AWS_SECRET_KEY_BEDROCK');
      }

      this.client = new AnthropicBedrock({
        awsAccessKey: config.accessKeyId,
        awsSecretKey: config.secretAccessKey,
        awsRegion: region,
      });

      this.embeddingClient = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }
  }

  /**
   * Generate chat completion using Claude on Bedrock via Anthropic SDK
   *
   * @param request - Chat completion request
   * @returns Chat completion response
   */
  async chatCompletion(
    request: BedrockChatCompletionRequestDto,
  ): Promise<BedrockChatCompletionResponseDto> {
    try {
      console.log(`🤖 Generating chat completion with Bedrock (Anthropic SDK)...`);

      const model = this.config.model || BEDROCK_DEFAULTS.MODEL;

      // Prepare messages for Anthropic SDK
      const messages = request.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Call Anthropic messages API via Bedrock
      const response = await this.client.messages.create({
        model,
        max_tokens:
          request.maxTokens ||
          this.config.maxTokens ||
          BEDROCK_DEFAULTS.MAX_TOKENS,
        messages,
        ...(request.system && {system: request.system}),
        ...(request.temperature !== undefined && {temperature: request.temperature}),
        ...(request.topP !== undefined && {top_p: request.topP}),
      });

      // Extract text from response
      const text = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      console.log(`✅ Chat completion generated`);

      return {
        response: text,
        model: response.model,
        tokensUsed: response.usage
          ? {
              input: response.usage.input_tokens,
              output: response.usage.output_tokens,
              total: response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
        stopReason: response.stop_reason || undefined,
      };
    } catch (error: any) {
      console.error('❌ Error generating chat completion:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings for text using Bedrock Titan (via AWS SDK)
   * Note: Uses AWS SDK since Anthropic SDK doesn't support embeddings
   *
   * @param request - Embedding request
   * @returns Embedding response
   */
  async generateEmbedding(
    request: BedrockEmbeddingRequestDto,
  ): Promise<BedrockEmbeddingResponseDto> {
    try {
      console.log(`🔢 Generating embedding with Bedrock Titan (AWS SDK)...`);

      const model =
        request.model ||
        this.config.embeddingModel ||
        BEDROCK_DEFAULTS.EMBEDDING_MODEL;

      // Prepare embedding request body (for Titan Embeddings)
      const requestBody = {
        inputText: request.text,
      };

      const input: InvokeModelCommandInput = {
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      };

      const command = new InvokeModelCommand(input);
      const response = await this.embeddingClient.send(command);

      // Parse response
      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body),
      );

      const embedding = responseBody.embedding;

      console.log(`✅ Embedding generated (${embedding.length} dimensions)`);

      return {
        embedding,
        model,
        dimensions: embedding.length,
      };
    } catch (error: any) {
      console.error('❌ Error generating embedding:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to embed
   * @returns Array of embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      console.log(`🔢 Generating ${texts.length} embeddings with Bedrock...`);

      const embeddings: number[][] = [];

      // Generate embeddings one by one
      for (const text of texts) {
        const result = await this.generateEmbedding({text});
        embeddings.push(result.embedding);
      }

      console.log(`✅ Generated ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error: any) {
      console.error('❌ Error generating embeddings:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Analyze JIRA and Confluence content
   * Helper method for requirement analysis
   *
   * @param jiraContent - JIRA ticket content
   * @param confluenceContent - Related Confluence content
   * @param systemPrompt - System prompt for analysis
   * @returns Analysis result
   */
  async analyzeContent(
    jiraContent: string,
    confluenceContent: string,
    systemPrompt: string,
  ): Promise<string> {
    try {
      console.log(`🔍 Analyzing content with Bedrock...`);

      const userPrompt = `
# JIRA Ticket:
${jiraContent}

# Related Confluence Documentation:
${confluenceContent}

Please analyze the above content according to the instructions.
`;

      const result = await this.chatCompletion({
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      console.log(`✅ Content analyzed`);

      return result.response;
    } catch (error: any) {
      console.error('❌ Error analyzing content:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate configuration
   * Throws error if required configuration is missing
   */
  validateConfig(): void {
    const missingFields: string[] = [];

    // Check authentication: either profile or explicit keys
    if (!this.config.awsProfile) {
      if (!this.config.accessKeyId) {
        missingFields.push('accessKeyId (or awsProfile)');
      }
      if (!this.config.secretAccessKey) {
        missingFields.push('secretAccessKey (or awsProfile)');
      }
    }

    if (!this.config.region) {
      missingFields.push('region');
    }
    if (!this.config.model) {
      missingFields.push('model');
    }

    if (missingFields.length > 0) {
      throw new Error(
        `${BEDROCK_ERROR_MESSAGES.MISSING_CONFIG}\n` +
          `Missing fields: ${missingFields.join(', ')}\n` +
          `Either set AWS_PROFILE or AWS_ACCESS_KEY_BEDROCK/AWS_SECRET_KEY_BEDROCK`,
      );
    }
  }

  /**
   * Handle errors
   * @param error - Error object
   * @returns Formatted error
   */
  private handleError(error: any): Error {
    let message: string = BEDROCK_ERROR_MESSAGES.API_ERROR;

    if (error.name === 'ValidationException') {
      message = BEDROCK_ERROR_MESSAGES.INVALID_REQUEST;
    } else if (error.name === 'UnrecognizedClientException') {
      message = BEDROCK_ERROR_MESSAGES.INVALID_CREDENTIALS;
    } else if (error.name === 'ThrottlingException') {
      message = BEDROCK_ERROR_MESSAGES.THROTTLING;
    } else if (error.name === 'ResourceNotFoundException') {
      message = BEDROCK_ERROR_MESSAGES.MODEL_NOT_FOUND;
    } else if (error.message) {
      message = error.message;
    }

    console.error(`❌ AWS Bedrock Error: ${message}`);

    const enhancedError = new Error(message) as any;
    enhancedError.originalError = error;

    return enhancedError;
  }
}
