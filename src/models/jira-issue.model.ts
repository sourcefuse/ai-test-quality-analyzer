/**
 * JIRA Issue Model
 * Represents a JIRA issue with its associated fields
 */

/**
 * JIRA Issue Field interface
 * Contains standard JIRA fields
 */
export interface JiraIssueFields {
  /** Summary/title of the issue */
  summary: string;

  /** Description of the issue (structured content) */
  description?: any;

  /** Issue type (Story, Task, Bug, etc.) */
  issuetype?: {
    name: string;
    id: string;
  };

  /** Priority of the issue */
  priority?: {
    name: string;
    id: string;
  };

  /** Current status of the issue */
  status?: {
    name: string;
    id: string;
  };

  /** Assignee of the issue */
  assignee?: {
    displayName: string;
    emailAddress: string;
  };

  /** Reporter of the issue */
  reporter?: {
    displayName: string;
    emailAddress: string;
  };

  /** Custom fields - indexed by field ID */
  [key: string]: any;
}

/**
 * JIRA Issue Model
 * Represents a complete JIRA issue
 */
export interface JiraIssue {
  /** Unique issue key (e.g., PROJ-123) */
  key: string;

  /** Issue ID */
  id?: string;

  /** Issue fields */
  fields: JiraIssueFields;

  /** Self URL */
  self?: string;
}

/**
 * JIRA Issue Content Node
 * Represents a node in the JIRA description content structure
 */
export interface JiraContentNode {
  /** Node type (paragraph, text, etc.) */
  type: string;

  /** Text content (for text nodes) */
  text?: string;

  /** Child content nodes */
  content?: JiraContentNode[];

  /** Node attributes */
  attrs?: Record<string, any>;
}
