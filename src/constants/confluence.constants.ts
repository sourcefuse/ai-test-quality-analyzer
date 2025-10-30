/**
 * Confluence Constants
 * Centralized constants for Confluence operations
 */

/**
 * Confluence API Endpoints (relative to base URL)
 */
export const CONFLUENCE_ENDPOINTS = {
  CONTENT: '/wiki/rest/api/content',
  SEARCH: '/wiki/rest/api/search',
  SPACE: '/wiki/rest/api/space',
} as const;

/**
 * Default Confluence Configuration Values
 */
export const CONFLUENCE_DEFAULTS = {
  MAX_RESULTS: 100,
  START_AT: 0,
  DEFAULT_EXPAND: ['body.storage', 'version', 'ancestors'],
  PAGE_TYPE: 'page',
  REPRESENTATION: 'storage',
} as const;

/**
 * Confluence Error Messages
 */
export const CONFLUENCE_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid Confluence credentials. Please check your email and API token.',
  URL_NOT_FOUND: 'Confluence URL not found. Please verify the URL is correct.',
  PAGE_NOT_FOUND: 'Confluence page not found. Please verify the page ID or title.',
  SPACE_NOT_FOUND: 'Confluence space not found. Please verify the space key.',
  RATE_LIMIT_EXCEEDED: 'Confluence API rate limit exceeded. Please try again later.',
  UNAUTHORIZED: 'Unauthorized access to Confluence. Please check your permissions.',
  FORBIDDEN: 'Access forbidden. Insufficient permissions to access this resource.',
  NETWORK_ERROR: 'Network error while connecting to Confluence. Please check your connection.',
  MISSING_CONFIG: 'Missing Confluence configuration. Please provide all required parameters.',
  PAGE_ALREADY_EXISTS: 'A page with this title already exists.',
  INVALID_PARENT: 'Invalid parent page ID.',
} as const;

/**
 * Confluence HTTP Status Codes
 */
export const CONFLUENCE_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
} as const;

/**
 * Confluence Content Types
 */
export const CONFLUENCE_CONTENT_TYPES = {
  PAGE: 'page',
  BLOG_POST: 'blogpost',
  ATTACHMENT: 'attachment',
  COMMENT: 'comment',
} as const;

/**
 * Confluence Representation Types
 */
export const CONFLUENCE_REPRESENTATIONS = {
  STORAGE: 'storage',
  VIEW: 'view',
  EXPORT_VIEW: 'export_view',
  EDITOR: 'editor',
} as const;

/**
 * HTML Tag Patterns for Stripping
 */
export const HTML_PATTERNS = {
  TAGS: /<[^>]*>/g,
  URLS: /https?:\/\/\S+/g,
  EMAIL_DOMAIN: /@sourcefuse\.com/g,
  BRACES: /[{}]/g,
  DOUBLE_NEWLINES: /\n\n/g,
} as const;

/**
 * Type exports for better type safety
 */
export type ConfluenceEndpoint = typeof CONFLUENCE_ENDPOINTS[keyof typeof CONFLUENCE_ENDPOINTS];
export type ConfluenceErrorMessage = typeof CONFLUENCE_ERROR_MESSAGES[keyof typeof CONFLUENCE_ERROR_MESSAGES];
export type ConfluenceStatusCode = typeof CONFLUENCE_STATUS_CODES[keyof typeof CONFLUENCE_STATUS_CODES];
export type ConfluenceContentType = typeof CONFLUENCE_CONTENT_TYPES[keyof typeof CONFLUENCE_CONTENT_TYPES];
export type ConfluenceRepresentation = typeof CONFLUENCE_REPRESENTATIONS[keyof typeof CONFLUENCE_REPRESENTATIONS];
