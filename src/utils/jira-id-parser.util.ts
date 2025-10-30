/**
 * JIRA ID Parser Utility
 * Utilities for parsing and validating JIRA ticket IDs
 */

/**
 * Regular expression pattern for JIRA ticket IDs
 * Matches format: PROJECTKEY-123 (uppercase letters, hyphen, digits)
 */
const JIRA_ID_PATTERN = /^([A-Z]+-\d+)/;

/**
 * Extracts JIRA ticket ID from a string
 * Handles various input formats (e.g., branch names, full text)
 *
 * @param input - Input string containing JIRA ticket ID
 * @returns Extracted JIRA ticket ID, or original input if no match
 *
 * @example
 * extractJiraId('PROJ-123') // Returns: 'PROJ-123'
 * extractJiraId('feature/PROJ-123-add-feature') // Returns: 'PROJ-123'
 * extractJiraId('PROJ-123-some-description') // Returns: 'PROJ-123'
 */
export function extractJiraId(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const match = JIRA_ID_PATTERN.exec(input);

  if (match && match[1]) {
    return match[1];
  }

  return input;
}

/**
 * Validates if a string is a valid JIRA ticket ID
 *
 * @param ticketId - String to validate
 * @returns True if valid JIRA ticket ID format
 *
 * @example
 * isValidJiraId('PROJ-123') // Returns: true
 * isValidJiraId('proj-123') // Returns: false (lowercase not allowed)
 * isValidJiraId('PROJ123') // Returns: false (missing hyphen)
 */
export function isValidJiraId(ticketId: string): boolean {
  if (!ticketId || typeof ticketId !== 'string') {
    return false;
  }

  return JIRA_ID_PATTERN.test(ticketId);
}

/**
 * Extracts project key from JIRA ticket ID
 *
 * @param ticketId - JIRA ticket ID (e.g., 'PROJ-123')
 * @returns Project key (e.g., 'PROJ'), or empty string if invalid
 *
 * @example
 * getProjectKey('PROJ-123') // Returns: 'PROJ'
 * getProjectKey('TEL-456') // Returns: 'TEL'
 */
export function getProjectKey(ticketId: string): string {
  if (!isValidJiraId(ticketId)) {
    return '';
  }

  const parts = ticketId.split('-');
  return parts[0];
}

/**
 * Extracts issue number from JIRA ticket ID
 *
 * @param ticketId - JIRA ticket ID (e.g., 'PROJ-123')
 * @returns Issue number (e.g., '123'), or empty string if invalid
 *
 * @example
 * getIssueNumber('PROJ-123') // Returns: '123'
 * getIssueNumber('TEL-456') // Returns: '456'
 */
export function getIssueNumber(ticketId: string): string {
  if (!isValidJiraId(ticketId)) {
    return '';
  }

  const parts = ticketId.split('-');
  return parts[1];
}

/**
 * Builds a JQL query to search for a specific ticket and its sub-tasks
 *
 * @param ticketId - JIRA ticket ID
 * @param projectKey - Project key (optional, will be extracted from ticketId if not provided)
 * @returns JQL query string
 *
 * @example
 * buildTicketJQL('PROJ-123', 'PROJ')
 * // Returns: "project = 'PROJ' AND (key = PROJ-123 OR parent = PROJ-123)"
 */
export function buildTicketJQL(ticketId: string, projectKey?: string): string {
  const jiraId = extractJiraId(ticketId);

  if (!jiraId) {
    throw new Error('Invalid JIRA ticket ID');
  }

  // Don't filter by project - ticket keys are unique across JIRA
  // This allows tickets from any project to be found
  return `key = ${jiraId} OR parent = ${jiraId}`;
}

/**
 * Normalizes JIRA ticket ID to standard format
 * Converts to uppercase and validates format
 *
 * @param ticketId - JIRA ticket ID to normalize
 * @returns Normalized ticket ID, or throws error if invalid
 *
 * @example
 * normalizeJiraId('proj-123') // Returns: 'PROJ-123'
 * normalizeJiraId('PROJ-123') // Returns: 'PROJ-123'
 */
export function normalizeJiraId(ticketId: string): string {
  const normalized = ticketId.toUpperCase().trim();

  if (!isValidJiraId(normalized)) {
    throw new Error(`Invalid JIRA ticket ID format: ${ticketId}`);
  }

  return normalized;
}
