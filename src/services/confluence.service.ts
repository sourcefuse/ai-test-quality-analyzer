/**
 * Confluence Service
 * Service class for interacting with Confluence API
 * Follows SourceFuse design patterns with separation of concerns
 */

import {ConfluenceClient} from 'confluence.js';
import * as fs from 'fs';
import * as path from 'path';
import {
  ConfluenceConfigDto,
  ConfluenceSearchRequestDto,
  ConfluencePagesListResponseDto,
  ConfluenceCreatePageRequestDto,
  ConfluencePageCreateResponseDto,
  ConfluenceDownloadRequestDto,
  ConfluenceDownloadResponseDto,
  ConfluenceErrorResponseDto,
} from '../dtos';
import {ConfluencePage} from '../models';
import {
  CONFLUENCE_DEFAULTS,
  CONFLUENCE_ERROR_MESSAGES,
  CONFLUENCE_STATUS_CODES,
} from '../constants';
import {stripHtmlTags, extractPlainText} from '../utils';

/**
 * Confluence Service Class
 * Handles all Confluence API interactions with proper error handling
 */
export class ConfluenceService {
  private readonly client: ConfluenceClient;
  private readonly config: ConfluenceConfigDto;
  private silentMode: boolean = false;

  // Patterns to exclude - pages created by this AI tool
  private readonly EXCLUDE_PATTERNS = [
    'Via-AI',
    'Generate-Unit-Tests',
    'GENERATE-UNIT-TESTS',
    'GeneratedTestsReport_',
    'Unit-Test-Report',
    'Test-Coverage-Report',
    'AI-Generated',
  ];

  // Regex pattern to match timestamps in page titles (e.g., -1757335353042)
  private readonly TIMESTAMP_PATTERN = /-\d{13,}/;

  /**
   * Constructor
   * @param config - Confluence configuration with credentials and settings
   */
  constructor(config: ConfluenceConfigDto) {
    this.config = config;

    // Create Confluence client
    this.client = new ConfluenceClient({
      host: config.host,
      authentication: {
        basic: {
          email: config.email,
          apiToken: config.apiToken,
        },
      },
    });
  }

  /**
   * Enable or disable silent mode (suppresses logging)
   * @param enabled - true to enable silent mode, false to disable
   */
  setSilentMode(enabled: boolean): void {
    this.silentMode = enabled;
  }

  /**
   * Log message only if not in silent mode
   * @param message - Message to log
   * @param args - Additional arguments
   */
  private log(message: string, ...args: any[]): void {
    if (!this.silentMode) {
      console.log(message, ...args);
    }
  }

  /**
   * Check if a page should be excluded from processing
   * @param page - Confluence page to check
   * @returns true if page should be excluded, false otherwise
   */
  private shouldExcludePage(page: ConfluencePage): boolean {
    const title = page.title || '';

    // Check if title contains timestamp pattern
    if (this.TIMESTAMP_PATTERN.test(title)) {
      return true;
    }

    // Check if title contains any exclude patterns
    for (const pattern of this.EXCLUDE_PATTERNS) {
      if (title.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * List all pages in a space
   * Handles pagination automatically to fetch all pages
   *
   * @param searchRequest - Search request configuration
   * @returns Promise resolving to list of pages
   */
  async listPages(searchRequest: ConfluenceSearchRequestDto): Promise<ConfluencePagesListResponseDto> {
    try {
      const {spaceKey, type, title, start, limit, expand, maxPages} = searchRequest;

      this.log(`📖 Listing pages in Confluence space: ${spaceKey}`);

      let allPages: ConfluencePage[] = [];
      let currentStart = start || CONFLUENCE_DEFAULTS.START_AT;
      const pageLimit = limit || CONFLUENCE_DEFAULTS.MAX_RESULTS;
      let hasMorePages = true;

      // Determine maximum pages to fetch (0 or undefined means fetch all)
      const maxPagesToFetch = maxPages || 0;
      const shouldLimitPages = maxPagesToFetch > 0;

      while (hasMorePages) {
        // Check if we've reached the maximum pages limit
        if (shouldLimitPages && allPages.length >= maxPagesToFetch) {
          this.log(`   Reached maximum pages limit: ${maxPagesToFetch}`);
          break;
        }

        this.log(`   Fetching batch starting at ${currentStart}...`);

        const response: any = await this.client.content.getContent({
          spaceKey,
          type: type || CONFLUENCE_DEFAULTS.PAGE_TYPE,
          title,
          start: currentStart,
          limit: pageLimit,
          expand: expand || CONFLUENCE_DEFAULTS.DEFAULT_EXPAND,
        });

        const batchPages = response.results || [];

        // Filter out AI-generated pages and pages with timestamps
        const filteredPages = batchPages.filter((page: ConfluencePage) => {
          if (this.shouldExcludePage(page)) {
            this.log(`   ⊘ Excluding page: ${page.title}`);
            return false;
          }
          return true;
        });

        // If limiting pages, only add what we need
        if (shouldLimitPages) {
          const remainingSlots = maxPagesToFetch - allPages.length;
          allPages = [...allPages, ...filteredPages.slice(0, remainingSlots)];
        } else {
          allPages = [...allPages, ...filteredPages];
        }

        hasMorePages = response.size >= pageLimit;
        currentStart += pageLimit;

        const excludedCount = batchPages.length - filteredPages.length;
        this.log(`   Fetched ${filteredPages.length} page(s)${excludedCount > 0 ? ` (excluded ${excludedCount} page(s))` : ''}`);
      }

      this.log(`✅ Total pages fetched: ${allPages.length}`);

      return {
        pages: allPages,
        total: allPages.length,
        start: start || 0,
        limit: pageLimit,
        hasMore: hasMorePages && shouldLimitPages,
      };
    } catch (error) {
      console.error('❌ Error listing Confluence pages:', error);
      throw this.handleError(error);
    }
  }

  /**
   * List pages in batches (generator function)
   * Yields batches of pages for incremental processing
   *
   * @param searchRequest - Search request configuration
   * @yields Promise resolving to a batch of pages
   */
  async *listPagesInBatches(searchRequest: ConfluenceSearchRequestDto): AsyncGenerator<{
    pages: ConfluencePage[];
    batchNumber: number;
    totalBatches: number;
    isLastBatch: boolean;
  }> {
    try {
      const {spaceKey, type, title, start, limit, expand, maxPages} = searchRequest;

      this.log(`📖 Listing pages in batches for Confluence space: ${spaceKey}`);

      let currentStart = start || CONFLUENCE_DEFAULTS.START_AT;
      const pageLimit = limit || CONFLUENCE_DEFAULTS.MAX_RESULTS;
      let hasMorePages = true;
      let batchNumber = 1;

      // Determine maximum pages to fetch (0 or undefined means fetch all)
      const maxPagesToFetch = maxPages || 0;
      const shouldLimitPages = maxPagesToFetch > 0;

      // Calculate total batches (estimate)
      const estimatedTotalBatches = shouldLimitPages
        ? Math.ceil(maxPagesToFetch / pageLimit)
        : -1; // Unknown for unlimited

      let totalPagesProcessed = 0;

      while (hasMorePages) {
        // Check if we've reached the maximum pages limit
        if (shouldLimitPages && totalPagesProcessed >= maxPagesToFetch) {
          this.log(`   Reached maximum pages limit: ${maxPagesToFetch}`);
          break;
        }

        this.log(`   📦 Fetching batch ${batchNumber} starting at ${currentStart}...`);

        const response: any = await this.client.content.getContent({
          spaceKey,
          type: type || CONFLUENCE_DEFAULTS.PAGE_TYPE,
          title,
          start: currentStart,
          limit: pageLimit,
          expand: expand || CONFLUENCE_DEFAULTS.DEFAULT_EXPAND,
        });

        const batchPages = response.results || [];

        // Filter out AI-generated pages and pages with timestamps
        const filteredPages = batchPages.filter((page: ConfluencePage) => {
          if (this.shouldExcludePage(page)) {
            this.log(`   ⊘ Excluding page: ${page.title}`);
            return false;
          }
          return true;
        });

        // If limiting pages, only yield what we need
        let pagesToYield = filteredPages;
        if (shouldLimitPages) {
          const remainingSlots = maxPagesToFetch - totalPagesProcessed;
          pagesToYield = filteredPages.slice(0, remainingSlots);
        }

        totalPagesProcessed += pagesToYield.length;
        hasMorePages = response.size >= pageLimit;
        const isLastBatch = !hasMorePages || (shouldLimitPages && totalPagesProcessed >= maxPagesToFetch);

        const excludedCount = batchPages.length - filteredPages.length;
        this.log(`   ✅ Batch ${batchNumber}: Fetched ${pagesToYield.length} page(s)${excludedCount > 0 ? ` (excluded ${excludedCount} page(s))` : ''}`);

        yield {
          pages: pagesToYield,
          batchNumber,
          totalBatches: shouldLimitPages ? estimatedTotalBatches : -1,
          isLastBatch,
        };

        currentStart += pageLimit;
        batchNumber++;
      }

      this.log(`✅ Total pages processed: ${totalPagesProcessed} across ${batchNumber - 1} batch(es)`);
    } catch (error) {
      console.error('❌ Error listing Confluence pages in batches:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a page by its title
   *
   * @param spaceKey - Space key
   * @param title - Page title
   * @param parentId - Optional parent page ID to search under
   * @returns Promise resolving to page ID, or empty string if not found
   */
  async getPageIdByTitle(spaceKey: string, title: string, parentId?: string): Promise<string> {
    try {
      console.log(`🔍 Searching for page: "${title}" in space ${spaceKey}${parentId ? ` under parent ${parentId}` : ''}`);

      const response: any = await this.client.content.getContent({
        spaceKey,
        title,
        expand: ['ancestors'],
      });

      if (response.results && response.results.length > 0) {
        // If parentId is specified, filter results to only include pages with that parent
        if (parentId) {
          const matchingPage = response.results.find((page: any) => {
            const ancestors = page.ancestors || [];
            // Check if any ancestor matches the parentId
            return ancestors.some((ancestor: any) => ancestor.id === parentId);
          });

          if (matchingPage) {
            console.log(`✅ Found page ID: ${matchingPage.id} under parent ${parentId}`);
            return matchingPage.id;
          } else {
            console.log(`⚠️  Page "${title}" found but not under parent ${parentId}`);
            return '';
          }
        } else {
          // No parent specified, return first match
          const pageId = response.results[0].id;
          console.log(`✅ Found page ID: ${pageId}`);
          return pageId;
        }
      }

      console.log(`⚠️  Page not found: "${title}"`);
      return '';
    } catch (error) {
      console.error(`❌ Error getting page by title:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a new page in Confluence
   *
   * @param request - Create page request
   * @returns Promise resolving to created page response
   */
  async createPage(request: ConfluenceCreatePageRequestDto): Promise<ConfluencePageCreateResponseDto> {
    try {
      const {title, content, spaceKey, parentId, type} = request;

      console.log(`📝 Creating Confluence page: "${title}" in space ${spaceKey}${parentId ? ` under parent ${parentId}` : ' at root level'}`);

      // Clean content
      let cleanedContent = content
        .replace(/```markdown/g, '')
        .replace(/```/g, '');

      const page: any = {
        type: type || CONFLUENCE_DEFAULTS.PAGE_TYPE,
        title,
        space: {
          key: spaceKey,
        },
        body: {
          storage: {
            value: cleanedContent,
            representation: CONFLUENCE_DEFAULTS.REPRESENTATION,
          },
        },
      };

      // Add parent if specified
      if (parentId) {
        page.ancestors = [{id: parentId}];
      }

      const response: any = await this.client.content.createContent(page);

      console.log(`✅ Page created successfully with ID: ${response.id}`);

      return {
        pageId: response.id,
        pageTitle: response.title,
        url: response._links?.webui
          ? `${this.config.host}${response._links.webui}`
          : undefined,
      };
    } catch (error: any) {
      console.error('❌ Error creating Confluence page:', error);

      // Check if page already exists (handle different error formats from Confluence API)
      const errorMessage = error.message || error.toString() || '';
      const isPageExists =
        errorMessage.includes('already exists') ||
        errorMessage.includes('A page with this title already exists') ||
        errorMessage.includes('BadRequestException') && errorMessage.includes('title');

      if (isPageExists) {
        console.log(`   ℹ️  Page "${request.title}" already exists, fetching existing page ID...`);

        // Search for existing page (with or without parent filter based on request)
        const existingPageId = await this.getPageIdByTitle(request.spaceKey, request.title, request.parentId);

        if (existingPageId) {
          console.log(`   ✅ Using existing page ID: ${existingPageId}`);
          // Construct URL from page ID
          const pageUrl = `${this.config.host}/wiki/spaces/${request.spaceKey}/pages/${existingPageId}`;
          return {
            pageId: existingPageId,
            pageTitle: request.title,
            url: pageUrl,
          };
        }

        // If page exists but we can't find it, something is wrong
        throw new Error(`Page "${request.title}" exists but cannot be found. Check permissions or space key.`);
      }

      throw this.handleError(error);
    }
  }

  /**
   * Create a hierarchical page structure
   * Creates parent pages if they don't exist
   *
   * @param spaceKey - Space key
   * @param ticketId - Ticket ID for the report
   * @param content - Page content
   * @param projectKey - Project key
   * @returns Promise resolving to created page response
   */
  async createHierarchicalPage(
    spaceKey: string,
    ticketId: string,
    content: string,
    projectKey: string
  ): Promise<ConfluencePageCreateResponseDto> {
    try {
      console.log(`🏗️  Creating hierarchical page structure for ${ticketId}`);

      // Step 1: Create/Get project root page
      const projectPageTitle = `${projectKey}-GENERATE-UNIT-TESTS`;
      console.log(`   Creating project root page: ${projectPageTitle}`);
      const projectPageResponse = await this.createPage({
        title: projectPageTitle,
        content: '',
        spaceKey,
      });

      // Step 2: Create/Get ticket page under project
      console.log(`   Creating ticket page: ${ticketId}`);
      const ticketPageResponse = await this.createPage({
        title: ticketId,
        content: '',
        spaceKey,
        parentId: projectPageResponse.pageId,
      });

      // Step 3: Create timestamped report page under ticket
      const reportPageTitle = `${ticketId}-${Date.now()}`;
      console.log(`   Creating report page: ${reportPageTitle}`);
      const reportPageResponse = await this.createPage({
        title: reportPageTitle,
        content,
        spaceKey,
        parentId: ticketPageResponse.pageId,
      });

      console.log(`✅ Hierarchical page structure created successfully`);

      return reportPageResponse;
    } catch (error) {
      console.error('❌ Error creating hierarchical page:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Download all pages from a space and save to a file
   *
   * @param request - Download request configuration
   * @returns Promise resolving to download response
   */
  async downloadSpaceToFile(request: ConfluenceDownloadRequestDto): Promise<ConfluenceDownloadResponseDto> {
    try {
      const {spaceKey, outputFolder, projectKey} = request;

      console.log(`💾 Downloading Confluence space: ${spaceKey}`);

      // List all pages
      const pagesResponse = await this.listPages({
        spaceKey,
        expand: ['body.storage'],
      });

      let content = '';
      let processedCount = 0;

      // Process each page
      for (const page of pagesResponse.pages) {
        // Skip AI-generated pages
        if (this.shouldExcludePage(page)) {
          console.log(`   Skipping AI-generated page: ${page.title}`);
          continue;
        }

        // Skip pages that start with project key (if specified)
        if (projectKey && page.title.toLowerCase().startsWith(projectKey.toLowerCase() + '-')) {
          console.log(`   Skipping project-specific page: ${page.title}`);
          continue;
        }

        // Add page title and content
        content += page.title + '\n';
        if (page.body?.storage?.value) {
          content += page.body.storage.value.trim() + '\n\n';
        }

        processedCount++;
      }

      // Strip HTML and clean content
      const cleanedContent = stripHtmlTags(content);

      // Create output directory if it doesn't exist
      const outputFilePath = path.join(outputFolder, `${spaceKey}.txt`);
      const outputDir = path.dirname(outputFilePath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }

      // Write to file
      fs.writeFileSync(outputFilePath, cleanedContent);

      console.log(`✅ Downloaded ${processedCount} page(s) to ${outputFilePath}`);

      return {
        filePath: outputFilePath,
        pagesCount: processedCount,
        contentSize: cleanedContent.length,
      };
    } catch (error) {
      console.error('❌ Error downloading space:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle Confluence API errors
   * @param error - Error object
   * @returns Formatted error
   */
  private handleError(error: any): Error {
    let message: string = CONFLUENCE_ERROR_MESSAGES.NETWORK_ERROR;
    let statusCode: number = CONFLUENCE_STATUS_CODES.SERVER_ERROR;

    if (error.response) {
      statusCode = error.response.status || statusCode;

      switch (statusCode) {
        case CONFLUENCE_STATUS_CODES.UNAUTHORIZED:
          message = CONFLUENCE_ERROR_MESSAGES.INVALID_CREDENTIALS;
          break;
        case CONFLUENCE_STATUS_CODES.FORBIDDEN:
          message = CONFLUENCE_ERROR_MESSAGES.FORBIDDEN;
          break;
        case CONFLUENCE_STATUS_CODES.NOT_FOUND:
          message = CONFLUENCE_ERROR_MESSAGES.PAGE_NOT_FOUND;
          break;
        case CONFLUENCE_STATUS_CODES.CONFLICT:
          message = CONFLUENCE_ERROR_MESSAGES.PAGE_ALREADY_EXISTS;
          break;
        case CONFLUENCE_STATUS_CODES.RATE_LIMIT:
          message = CONFLUENCE_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;
          break;
      }
    }

    if (error.message && error.message.toLowerCase().includes('getaddrinfo')) {
      message = CONFLUENCE_ERROR_MESSAGES.URL_NOT_FOUND;
    }

    console.error(`❌ Confluence API Error [${statusCode}]: ${message}`);

    const enhancedError = new Error(message) as any;
    enhancedError.statusCode = statusCode;
    enhancedError.originalError = error;

    return enhancedError;
  }

  /**
   * Validate configuration
   * Throws error if required configuration is missing
   */
  validateConfig(): void {
    const missingFields: string[] = [];

    if (!this.config.host) {
      missingFields.push('host');
    }
    if (!this.config.email) {
      missingFields.push('email');
    }
    if (!this.config.apiToken) {
      missingFields.push('apiToken');
    }

    if (missingFields.length > 0) {
      throw new Error(
        `${CONFLUENCE_ERROR_MESSAGES.MISSING_CONFIG}\n` +
        `Missing fields: ${missingFields.join(', ')}`
      );
    }
  }
}
