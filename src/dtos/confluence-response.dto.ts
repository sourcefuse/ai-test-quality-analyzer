/**
 * Confluence Response DTOs
 * Data Transfer Objects for Confluence API responses
 */

import {ConfluencePage} from '../models';

/**
 * Confluence Page Create Response DTO
 */
export interface ConfluencePageCreateResponseDto {
  /** Created page ID */
  pageId: string;

  /** Created page title */
  pageTitle: string;

  /** Full URL to the page */
  url?: string;
}

/**
 * Confluence Pages List Response DTO
 */
export interface ConfluencePagesListResponseDto {
  /** Array of pages */
  pages: ConfluencePage[];

  /** Total number of pages */
  total: number;

  /** Starting index */
  start: number;

  /** Limit per request */
  limit: number;

  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Confluence Download Response DTO
 */
export interface ConfluenceDownloadResponseDto {
  /** Path to downloaded file */
  filePath: string;

  /** Number of pages downloaded */
  pagesCount: number;

  /** Total content size in bytes */
  contentSize: number;
}

/**
 * Confluence Error Response DTO
 */
export interface ConfluenceErrorResponseDto {
  /** Error message */
  message: string;

  /** HTTP status code */
  statusCode: number;

  /** Detailed error information */
  errors?: Record<string, string>;
}
