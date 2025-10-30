/**
 * OpenRouter AI Constants
 * Constants for OpenRouter AI service
 */

export const OPENROUTER_ENDPOINTS = {
  CHAT_COMPLETION: '/chat/completions',
  EMBEDDINGS: '/embeddings',
  MODELS: '/models',
} as const;

export const OPENROUTER_DEFAULTS = {
  MODEL: 'google/gemini-2.0-flash-exp:free',
  EMBEDDING_MODEL: 'openai/text-embedding-3-small',
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
  TOP_P: 1.0,
  TIMEOUT: 60000, // 60 seconds
} as const;

export const OPENROUTER_ERROR_MESSAGES = {
  API_ERROR: 'OpenRouter API error occurred',
  INVALID_CREDENTIALS: 'Invalid API key or credentials',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  MODEL_NOT_FOUND: 'Requested model not found',
  INVALID_REQUEST: 'Invalid request parameters',
  NETWORK_ERROR: 'Network error occurred while connecting to OpenRouter',
  MISSING_CONFIG: 'Missing required OpenRouter configuration',
} as const;

export const OPENROUTER_STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
} as const;

/**
 * System prompts for different analysis tasks
 */
export const ANALYSIS_PROMPTS = {
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
