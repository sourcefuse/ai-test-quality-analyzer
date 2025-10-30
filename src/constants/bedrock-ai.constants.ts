/**
 * AWS Bedrock AI Constants
 * Constants for AWS Bedrock AI service
 */

export const BEDROCK_MODELS = {
  // Claude Sonnet 4.5 (Global Inference)
  CLAUDE_SONNET_4_5: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',

  // Claude 3.5 Sonnet
  CLAUDE_3_5_SONNET_V2: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20240620-v1:0',

  // Claude 3 Haiku
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',

  // Claude 3 Sonnet
  CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',

  // Claude 3 Opus
  CLAUDE_3_OPUS: 'anthropic.claude-3-opus-20240229-v1:0',
} as const;

export const BEDROCK_EMBEDDING_MODELS = {
  // Amazon Titan Embeddings
  TITAN_EMBED_TEXT_V2: 'amazon.titan-embed-text-v2:0',
  TITAN_EMBED_TEXT_V1: 'amazon.titan-embed-text-v1',

  // Cohere Embeddings
  COHERE_EMBED_ENGLISH_V3: 'cohere.embed-english-v3',
  COHERE_EMBED_MULTILINGUAL_V3: 'cohere.embed-multilingual-v3',
} as const;

export const BEDROCK_DEFAULTS = {
  MODEL: BEDROCK_MODELS.CLAUDE_SONNET_4_5,
  EMBEDDING_MODEL: BEDROCK_EMBEDDING_MODELS.TITAN_EMBED_TEXT_V2,
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
  TOP_P: 1.0,
  TIMEOUT: 60000, // 60 seconds
  REGION: 'us-east-2',
} as const;

export const BEDROCK_ERROR_MESSAGES = {
  API_ERROR: 'AWS Bedrock API error occurred',
  INVALID_CREDENTIALS: 'Invalid AWS credentials',
  THROTTLING: 'Request throttled by AWS Bedrock',
  MODEL_NOT_FOUND: 'Requested model not found or not enabled',
  INVALID_REQUEST: 'Invalid request parameters',
  NETWORK_ERROR: 'Network error occurred while connecting to AWS Bedrock',
  MISSING_CONFIG: 'Missing required AWS Bedrock configuration',
  REGION_NOT_SUPPORTED: 'Model not available in specified region',
} as const;

export const BEDROCK_STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  THROTTLING: 429,
  SERVER_ERROR: 500,
} as const;

/**
 * System prompts for different analysis tasks
 * (Same as OpenRouter but tailored for Claude on Bedrock)
 */
export const BEDROCK_ANALYSIS_PROMPTS = {
  REQUIREMENT_EXTRACTION: `You are a technical requirements analyst. Analyze the JIRA ticket and related Confluence documentation to extract:
1. Functional requirements
2. Non-functional requirements
3. Technical specifications
4. Acceptance criteria
5. Dependencies

Format your response as structured JSON with the following schema:
{
  "requirements": [
    {
      "id": "REQ-001",
      "title": "Requirement title",
      "description": "Detailed description",
      "type": "functional|non-functional|technical",
      "priority": "high|medium|low",
      "source": "Confluence page or JIRA ticket"
    }
  ],
  "summary": "Overall analysis summary"
}`,

  TDD_EXTRACTION: `You are a technical architect. Analyze the provided Confluence documentation to extract Technical Design Document (TDD) information:
1. Architecture overview
2. Design decisions and rationale
3. Technology stack
4. API specifications
5. Database schema
6. System dependencies

Format your response as structured JSON with the following schema:
{
  "architecture": "Architecture overview",
  "designDecisions": ["Decision 1", "Decision 2"],
  "technologyStack": ["Tech 1", "Tech 2"],
  "apiSpecs": "API specifications",
  "databaseSchema": "Database schema details",
  "dependencies": ["Dependency 1", "Dependency 2"]
}`,

  IMPLEMENTATION_ANALYSIS: `You are a senior software engineer. Analyze the JIRA ticket requirements and Confluence documentation to provide implementation guidance:
1. Implementation approach
2. Key components to develop
3. Technical challenges and solutions
4. Testing strategy
5. Deployment considerations

Provide a comprehensive implementation plan based on the provided context.`,

  RELEVANCE_SCORING: `You are a document relevance analyzer. Given a JIRA ticket and a Confluence page, determine how relevant the Confluence page is to implementing the JIRA ticket.

Score from 0-1 where:
- 0.9-1.0: Highly relevant (TDD, implementation guide, or direct specification)
- 0.7-0.9: Relevant (related documentation, API specs, or architecture)
- 0.5-0.7: Somewhat relevant (tangential information)
- 0.0-0.5: Not relevant

Respond with JSON:
{
  "relevanceScore": 0.85,
  "reason": "Explanation of relevance",
  "keyTopics": ["Topic 1", "Topic 2"]
}`,
} as const;
