/**
 * Confluence Page Model
 * Represents a Confluence page with its associated fields
 */

/**
 * Confluence Space
 */
export interface ConfluenceSpace {
  /** Space key (e.g., 'PROJ', 'DOC') */
  key: string;

  /** Space name */
  name?: string;

  /** Space ID */
  id?: string;
}

/**
 * Confluence Page Ancestor
 */
export interface ConfluenceAncestor {
  /** Ancestor page ID */
  id: string;

  /** Ancestor page title */
  title?: string;
}

/**
 * Confluence Page Body Storage
 */
export interface ConfluenceBodyStorage {
  /** Content value (HTML) */
  value: string;

  /** Representation type (usually 'storage') */
  representation: 'storage' | 'view' | 'export_view';
}

/**
 * Confluence Page Body
 */
export interface ConfluenceBody {
  /** Storage representation */
  storage?: ConfluenceBodyStorage;

  /** View representation */
  view?: ConfluenceBodyStorage;

  /** Export view representation */
  export_view?: ConfluenceBodyStorage;
}

/**
 * Confluence Page Version
 */
export interface ConfluenceVersion {
  /** Version number */
  number: number;

  /** When the version was created */
  when?: string;

  /** Who created the version */
  by?: {
    displayName: string;
    email: string;
  };
}

/**
 * Confluence Page Model
 * Represents a complete Confluence page
 */
export interface ConfluencePage {
  /** Page ID */
  id?: string;

  /** Page type (usually 'page') */
  type: 'page' | 'blogpost';

  /** Page title */
  title: string;

  /** Page space */
  space: ConfluenceSpace;

  /** Page body content */
  body?: ConfluenceBody;

  /** Parent pages (ancestors) */
  ancestors?: ConfluenceAncestor[];

  /** Page version */
  version?: ConfluenceVersion;

  /** Page status */
  status?: 'current' | 'trashed' | 'deleted';

  /** Self URL */
  _links?: {
    self?: string;
    webui?: string;
  };
}

/**
 * Confluence Page List Response
 */
export interface ConfluencePageListResponse {
  /** Array of pages */
  results: ConfluencePage[];

  /** Starting index */
  start: number;

  /** Limit per page */
  limit: number;

  /** Total number of results */
  size: number;

  /** Links for pagination */
  _links?: {
    next?: string;
    prev?: string;
  };
}
