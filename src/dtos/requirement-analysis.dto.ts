/**
 * Requirement Analysis DTOs
 * Data Transfer Objects for analyzing JIRA requirements with Confluence content
 */

import {VectorDocument} from '../models';

/**
 * Analysis Strategy Type
 */
export type AnalysisStrategy = 'vector_db' | 'llm' | 'hybrid';

/**
 * Requirement Analysis Request
 */
export interface RequirementAnalysisRequestDto {
  /** JIRA ticket ID */
  ticketId: string;

  /** JIRA project key */
  projectKey: string;

  /** Confluence space key */
  confluenceSpaceKey: string;

  /** Analysis strategy to use */
  strategy: AnalysisStrategy;

  /** Maximum Confluence pages to retrieve */
  maxConfluencePages?: number;

  /** Maximum vector search results */
  maxVectorResults?: number;

  /** Minimum similarity score for vector search */
  minSimilarityScore?: number;
}

/**
 * Requirement Analysis Response
 */
export interface RequirementAnalysisResponseDto {
  /** JIRA ticket ID */
  ticketId: string;

  /** JIRA ticket summary */
  ticketSummary: string;

  /** Strategy used */
  strategy: AnalysisStrategy;

  /** Related Confluence documents */
  relatedDocuments: VectorDocument[];

  /** Extracted requirements */
  requirements: RequirementDetail[];

  /** Technical design document (if found) */
  technicalDesign?: TechnicalDesignDocument;

  /** Implementation details */
  implementationDetails?: string;

  /** Analysis summary */
  summary: string;

  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Requirement Detail
 */
export interface RequirementDetail {
  /** Requirement ID */
  id: string;

  /** Requirement title */
  title: string;

  /** Requirement description */
  description: string;

  /** Requirement type (functional, non-functional, etc.) */
  type: string;

  /** Priority */
  priority?: string;

  /** Source (Confluence page title/ID) */
  source?: string;

  /** Related test cases */
  testCases?: string[];
}

/**
 * Technical Design Document
 */
export interface TechnicalDesignDocument {
  /** Document title */
  title: string;

  /** Confluence page ID */
  pageId: string;

  /** Architecture overview */
  architecture?: string;

  /** Design decisions */
  designDecisions?: string[];

  /** Technology stack */
  technologyStack?: string[];

  /** API specifications */
  apiSpecs?: string;

  /** Database schema */
  databaseSchema?: string;

  /** Dependencies */
  dependencies?: string[];
}

/**
 * Sync Confluence to Vector DB Request
 */
export interface SyncConfluenceRequestDto {
  /** Confluence space key */
  spaceKey: string;

  /** Project key (for filtering) */
  projectKey?: string;

  /** Maximum pages to sync */
  maxPages?: number;

  /** Force re-sync (delete existing and re-add) */
  forceResync?: boolean;
}

/**
 * Sync Confluence to Vector DB Response
 */
export interface SyncConfluenceResponseDto {
  /** Number of pages synced */
  pagesSynced: number;

  /** Number of documents created */
  documentsCreated: number;

  /** Skipped pages */
  pagesSkipped: number;

  /** Errors encountered */
  errors: string[];

  /** Sync duration (ms) */
  duration: number;
}
