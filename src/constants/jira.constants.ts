/**
 * JIRA Constants
 * Centralized constants for JIRA operations
 */

/**
 * JIRA API Endpoints
 */
export const JIRA_ENDPOINTS = {
  SEARCH_JQL: '/rest/api/3/search/jql',
  ISSUE: '/rest/api/3/issue',
  SEARCH: '/rest/api/3/search',
} as const;

/**
 * Default JIRA Configuration Values
 */
export const JIRA_DEFAULTS = {
  MAX_RESULTS: 100,
  START_AT: 0,
  DEFAULT_FIELDS: ['key', 'summary', 'description', 'issuetype', 'priority', 'status'],
  EXPAND_OPTIONS: ['names', 'schema'],
} as const;

/**
 * JIRA Error Messages
 */
export const JIRA_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid JIRA credentials. Please check your email and API token.',
  URL_NOT_FOUND: 'JIRA URL not found. Please verify the URL is correct.',
  TICKET_NOT_FOUND: 'JIRA ticket not found. Please verify the ticket ID.',
  RATE_LIMIT_EXCEEDED: 'JIRA API rate limit exceeded. Please try again later.',
  UNAUTHORIZED: 'Unauthorized access to JIRA. Please check your permissions.',
  FORBIDDEN: 'Access forbidden. Insufficient permissions to access this resource.',
  NETWORK_ERROR: 'Network error while connecting to JIRA. Please check your connection.',
  INVALID_JQL: 'Invalid JQL query. Please check your query syntax.',
  MISSING_CONFIG: 'Missing JIRA configuration. Please provide all required parameters.',
} as const;

/**
 * JIRA HTTP Status Codes
 */
export const JIRA_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
} as const;

/**
 * JIRA Issue Types
 */
export const JIRA_ISSUE_TYPES = {
  STORY: 'Story',
  TASK: 'Task',
  BUG: 'Bug',
  EPIC: 'Epic',
  SUB_TASK: 'Sub-task',
} as const;

/**
 * JIRA Field Names
 */
export const JIRA_FIELD_NAMES = {
  KEY: 'key',
  SUMMARY: 'summary',
  DESCRIPTION: 'description',
  ISSUE_TYPE: 'issuetype',
  PRIORITY: 'priority',
  STATUS: 'status',
  ASSIGNEE: 'assignee',
  REPORTER: 'reporter',
  PARENT: 'parent',
  SUBTASKS: 'subtasks',
} as const;

/**
 * JIRA Content Node Types
 */
export const JIRA_CONTENT_TYPES = {
  PARAGRAPH: 'paragraph',
  TEXT: 'text',
  HEADING: 'heading',
  BULLET_LIST: 'bulletList',
  ORDERED_LIST: 'orderedList',
  LIST_ITEM: 'listItem',
  CODE_BLOCK: 'codeBlock',
} as const;

/**
 * Type exports for better type safety
 */
export type JiraEndpoint = typeof JIRA_ENDPOINTS[keyof typeof JIRA_ENDPOINTS];
export type JiraErrorMessage = typeof JIRA_ERROR_MESSAGES[keyof typeof JIRA_ERROR_MESSAGES];
export type JiraStatusCode = typeof JIRA_STATUS_CODES[keyof typeof JIRA_STATUS_CODES];
export type JiraIssueType = typeof JIRA_ISSUE_TYPES[keyof typeof JIRA_ISSUE_TYPES];
export type JiraFieldName = typeof JIRA_FIELD_NAMES[keyof typeof JIRA_FIELD_NAMES];
export type JiraContentType = typeof JIRA_CONTENT_TYPES[keyof typeof JIRA_CONTENT_TYPES];
