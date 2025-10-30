/**
 * Confluence Configuration DTO
 * Data Transfer Object for Confluence configuration
 */

/**
 * Confluence Configuration
 */
export interface ConfluenceConfigDto {
  /** Confluence instance URL */
  host: string;

  /** User email for authentication */
  email: string;

  /** API token for authentication */
  apiToken: string;

  /** Default space key */
  spaceKey?: string;
}

/**
 * Confluence Search Request DTO
 */
export interface ConfluenceSearchRequestDto {
  /** Space key to search in */
  spaceKey: string;

  /** Page title to search for */
  title?: string;

  /** Content type (page or blogpost) */
  type?: 'page' | 'blogpost';

  /** Starting index for pagination */
  start?: number;

  /** Maximum results per page */
  limit?: number;

  /** Fields to expand */
  expand?: string[];

  /** Maximum number of pages to fetch (0 or undefined = fetch all) */
  maxPages?: number;
}

/**
 * Confluence Create Page Request DTO
 */
export interface ConfluenceCreatePageRequestDto {
  /** Page title */
  title: string;

  /** Page content (HTML) */
  content: string;

  /** Space key */
  spaceKey: string;

  /** Parent page ID (optional) */
  parentId?: string;

  /** Page type */
  type?: 'page' | 'blogpost';
}

/**
 * Confluence Update Page Request DTO
 */
export interface ConfluenceUpdatePageRequestDto {
  /** Page ID to update */
  pageId: string;

  /** New page title */
  title?: string;

  /** New page content (HTML) */
  content?: string;

  /** Current version number */
  version: number;
}

/**
 * Confluence Download Request DTO
 */
export interface ConfluenceDownloadRequestDto {
  /** Space key to download from */
  spaceKey: string;

  /** Output folder path */
  outputFolder: string;

  /** Filter by project key (optional) */
  projectKey?: string;
}
