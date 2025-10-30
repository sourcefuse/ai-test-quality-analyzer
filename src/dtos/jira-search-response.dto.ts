/**
 * JIRA Search Response DTO
 * Data Transfer Object for JIRA API responses
 */

import {JiraIssue} from '../models';

/**
 * JIRA Search Response
 * Standard response from JIRA search API
 */
export interface JiraSearchResponseDto {
  /** Array of issues returned from search */
  issues: JiraIssue[];

  /** Total number of issues matching the query */
  total: number;

  /** Starting index of results */
  startAt: number;

  /** Maximum results per page */
  maxResults: number;

  /** Expand options applied */
  expand?: string;
}

/**
 * JIRA Issue Details Response DTO
 * Response for fetching a single issue with full details
 */
export interface JiraIssueDetailsResponseDto {
  /** The JIRA issue */
  issue: JiraIssue;

  /** Related sub-tasks or child issues */
  subIssues?: JiraIssue[];

  /** Formatted title with description */
  formattedText?: string;
}

/**
 * JIRA API Error Response
 */
export interface JiraErrorResponseDto {
  /** Error message */
  message: string;

  /** HTTP status code */
  statusCode: number;

  /** Detailed error messages */
  errors?: Record<string, string>;

  /** Warning messages */
  warnings?: string[];
}
