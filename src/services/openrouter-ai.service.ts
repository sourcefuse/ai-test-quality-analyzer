/**
 * OpenRouter AI Service
 * Service class for interacting with OpenRouter AI API
 * Follows SourceFuse design patterns with separation of concerns
 */

import axios, {AxiosInstance} from 'axios';
import {
  OpenRouterConfigDto,
  ChatCompletionRequestDto,
  ChatCompletionResponseDto,
  EmbeddingRequestDto,
  EmbeddingResponseDto,
} from '../dtos';
import {
  OPENROUTER_ENDPOINTS,
  OPENROUTER_DEFAULTS,
  OPENROUTER_ERROR_MESSAGES,
  OPENROUTER_STATUS_CODES,
} from '../constants';

/**
 * OpenRouter AI Service Class
 * Handles all OpenRouter AI API interactions
 */
export class OpenRouterAIService {
  private readonly client: AxiosInstance;
  private readonly config: OpenRouterConfigDto;

  /**
   * Constructor
   * @param config - OpenRouter configuration
   */
  constructor(config: OpenRouterConfigDto) {
    this.config = config;

    // Create axios client with authentication
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: OPENROUTER_DEFAULTS.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://github.com/sourcefuse',
        'X-Title': 'CheckUnitTestCases',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          if (status === OPENROUTER_STATUS_CODES.UNAUTHORIZED) {
            throw new Error(OPENROUTER_ERROR_MESSAGES.INVALID_CREDENTIALS);
          } else if (status === OPENROUTER_STATUS_CODES.RATE_LIMIT) {
            throw new Error(OPENROUTER_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
          }

          throw new Error(
            data?.error?.message || OPENROUTER_ERROR_MESSAGES.API_ERROR,
          );
        }

        throw new Error(OPENROUTER_ERROR_MESSAGES.NETWORK_ERROR);
      },
    );
  }

  /**
   * Generate chat completion
   *
   * @param request - Chat completion request
   * @returns Chat completion response
   */
  async chatCompletion(
    request: ChatCompletionRequestDto,
  ): Promise<ChatCompletionResponseDto> {
    try {
      console.log(`🤖 Generating chat completion...`);

      const response = await this.client.post(
        OPENROUTER_ENDPOINTS.CHAT_COMPLETION,
        {
          model: request.model || this.config.model,
          messages: request.messages,
          max_tokens:
            request.maxTokens ||
            this.config.maxTokens ||
            OPENROUTER_DEFAULTS.MAX_TOKENS,
          temperature:
            request.temperature !== undefined
              ? request.temperature
              : this.config.temperature || OPENROUTER_DEFAULTS.TEMPERATURE,
          top_p:
            request.topP ||
            this.config.topP ||
            OPENROUTER_DEFAULTS.TOP_P,
          stream: request.stream || false,
        },
      );

      const choice = response.data.choices[0];
      const usage = response.data.usage;

      console.log(`✅ Chat completion generated`);

      return {
        response: choice.message.content,
        model: response.data.model,
        tokensUsed: usage
          ? {
              prompt: usage.prompt_tokens,
              completion: usage.completion_tokens,
              total: usage.total_tokens,
            }
          : undefined,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      console.error('❌ Error generating chat completion:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings for text
   *
   * @param request - Embedding request
   * @returns Embedding response
   */
  async generateEmbedding(
    request: EmbeddingRequestDto,
  ): Promise<EmbeddingResponseDto> {
    try {
      console.log(`🔢 Generating embedding...`);

      const model = request.model || OPENROUTER_DEFAULTS.EMBEDDING_MODEL;

      const response = await this.client.post(OPENROUTER_ENDPOINTS.EMBEDDINGS, {
        model,
        input: request.text,
      });

      const embeddingData = response.data.data[0];

      console.log(`✅ Embedding generated (${embeddingData.embedding.length} dimensions)`);

      return {
        embedding: embeddingData.embedding,
        model: response.data.model,
        dimensions: embeddingData.embedding.length,
      };
    } catch (error) {
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
      console.log(`🔢 Generating ${texts.length} embeddings...`);

      const embeddings: number[][] = [];

      // Generate embeddings one by one (some APIs don't support batch)
      for (const text of texts) {
        const result = await this.generateEmbedding({text});
        embeddings.push(result.embedding);
      }

      console.log(`✅ Generated ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error) {
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
      console.log(`🔍 Analyzing content with LLM...`);

      const userPrompt = `
# JIRA Ticket:
${jiraContent}

# Related Confluence Documentation:
${confluenceContent}

Please analyze the above content according to the instructions.
`;

      const result = await this.chatCompletion({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      console.log(`✅ Content analyzed`);

      return result.response;
    } catch (error) {
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

    if (!this.config.apiKey) {
      missingFields.push('apiKey');
    }
    if (!this.config.apiUrl) {
      missingFields.push('apiUrl');
    }
    if (!this.config.model) {
      missingFields.push('model');
    }

    if (missingFields.length > 0) {
      console.error('');
      console.error('❌ OpenRouter Configuration Error:');
      console.error('   Missing required fields: ' + missingFields.join(', '));
      console.error('');
      console.error('💡 To fix this:');
      if (missingFields.includes('apiKey')) {
        console.error('   1. Get an API key from: https://openrouter.ai/');
        console.error('   2. Set OPEN_ROUTER_API_KEY in your .env file');
      }
      if (missingFields.includes('apiUrl')) {
        console.error('   - Set OPEN_ROUTER_API_URL in your .env file (default: https://openrouter.ai/api/v1)');
      }
      if (missingFields.includes('model')) {
        console.error('   - Set OPEN_ROUTER_MODEL in your .env file (e.g., google/gemini-2.0-flash-exp:free)');
      }
      console.error('');

      throw new Error(
        `${OPENROUTER_ERROR_MESSAGES.MISSING_CONFIG}\n` +
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
    let message: string = OPENROUTER_ERROR_MESSAGES.API_ERROR;

    if (error.message) {
      message = error.message;
    }

    console.error(`❌ OpenRouter AI Error: ${message}`);

    const enhancedError = new Error(message) as any;
    enhancedError.originalError = error;

    return enhancedError;
  }
}
