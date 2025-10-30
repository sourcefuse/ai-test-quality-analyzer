/**
 * JIRA Search Request DTO
 * Data Transfer Object for JIRA search operations
 */

/**
 * JIRA Search Request configuration
 */
export interface JiraSearchRequestDto {
  /** JQL (JIRA Query Language) query string */
  jql: string;

  /** Maximum number of results to return */
  maxResults?: number;

  /** Starting index for pagination */
  startAt?: number;

  /** Comma-separated list of fields to retrieve */
  fields?: string[];

  /** Expand options (e.g., 'names', 'schema') */
  expand?: string[];
}

/**
 * JIRA Configuration DTO
 * Contains authentication and connection details
 */
export interface JiraConfigDto {
  /** JIRA instance URL */
  url: string;

  /** User email for authentication */
  email: string;

  /** API token for authentication */
  apiToken: string;

  /** Project key (e.g., 'PROJ', 'TEL') */
  projectKey?: string;

  /** Maximum results per query */
  maxResult?: number;

  /** Fields to fetch by default */
  fetchFields?: string[];
}

/**
 * JIRA Ticket Query DTO
 * Simplified DTO for fetching a specific ticket
 */
export interface JiraTicketQueryDto {
  /** Ticket ID (e.g., 'PROJ-123') */
  ticketId: string;

  /** Project key (optional - will be extracted from ticketId if not provided) */
  projectKey?: string;

  /** Whether to include sub-tasks */
  includeSubTasks?: boolean;

  /** Fields to retrieve */
  fields?: string[];
}
