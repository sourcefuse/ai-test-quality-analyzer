/**
 * JIRA Service
 * Service class for interacting with JIRA API
 * Follows SourceFuse design patterns with separation of concerns
 */

import axios, {AxiosInstance, AxiosError} from 'axios';
import {
  JiraConfigDto,
  JiraSearchRequestDto,
  JiraSearchResponseDto,
  JiraTicketQueryDto,
  JiraIssueDetailsResponseDto,
  JiraErrorResponseDto,
} from '../dtos';
import {JiraIssue} from '../models';
import {
  JIRA_ENDPOINTS,
  JIRA_DEFAULTS,
  JIRA_ERROR_MESSAGES,
  JIRA_STATUS_CODES,
} from '../constants';
import {
  extractParagraphText,
  extractJiraId,
  buildTicketJQL,
  sanitizeText,
} from '../utils';

/**
 * JIRA Service Class
 * Handles all JIRA API interactions with proper error handling
 */
export class JiraService {
  private readonly axiosInstance: AxiosInstance;
  private readonly config: JiraConfigDto;

  /**
   * Constructor
   * @param config - JIRA configuration with credentials and settings
   */
  constructor(config: JiraConfigDto) {
    this.config = config;

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: config.url,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Add request interceptor for authentication
    this.axiosInstance.interceptors.request.use(
      requestConfig => {
        // Add Basic Auth header
        const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
        requestConfig.headers.Authorization = `Basic ${auth}`;
        return requestConfig;
      },
      error => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => this.handleApiError(error)
    );
  }

  /**
   * Search for JIRA issues using JQL
   * @param searchRequest - Search request configuration
   * @returns Promise resolving to search response with issues
   */
  async searchIssues(searchRequest: JiraSearchRequestDto): Promise<JiraSearchResponseDto> {
    try {
      const {jql, maxResults, startAt, expand, fields} = searchRequest;

      console.log(`🔍 Searching JIRA with JQL: ${jql}`);

      const fieldsParam = fields?.join(',') ||
        this.config.fetchFields?.join(',') ||
        JIRA_DEFAULTS.DEFAULT_FIELDS.join(',');

      const response = await this.axiosInstance.get(JIRA_ENDPOINTS.SEARCH_JQL, {
        params: {
          jql,
          maxResults: maxResults || this.config.maxResult || JIRA_DEFAULTS.MAX_RESULTS,
          startAt: startAt || JIRA_DEFAULTS.START_AT,
          expand: expand?.join(',') || JIRA_DEFAULTS.EXPAND_OPTIONS.join(','),
          fields: fieldsParam,
        },
      });

      console.log(`✅ Found ${response.data.issues?.length || 0} issue(s)`);

      // JIRA Cloud API v3 uses different pagination format
      // Old format: total, maxResults, startAt
      // New format: nextPageToken, isLast
      const hasNewPaginationFormat = 'nextPageToken' in response.data || 'isLast' in response.data;

      // For new format, if we have issues, estimate total based on what we know
      // If isLast=true, total = issues.length, otherwise we don't know exact total
      let total = response.data.total;
      if (hasNewPaginationFormat && total === undefined) {
        if (response.data.isLast) {
          total = (startAt || 0) + (response.data.issues?.length || 0);
        } else {
          // We don't know the exact total, use issues length as minimum
          total = response.data.issues?.length || 0;
        }
      }

      return {
        issues: response.data.issues || [],
        total: total || 0,
        startAt: response.data.startAt || 0,
        maxResults: response.data.maxResults || (maxResults || this.config.maxResult || JIRA_DEFAULTS.MAX_RESULTS),
        expand: response.data.expand,
      };
    } catch (error) {
      console.error('❌ Error searching JIRA issues:', error);
      throw error;
    }
  }

  /**
   * Fetch full issue details by issue key
   * @param issueKey - JIRA issue key (e.g., 'PROJ-123')
   * @param fields - Optional array of field names to retrieve
   * @returns Promise resolving to JIRA issue with full details
   */
  async getIssueByKey(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    try {
      console.log(`📄 Fetching JIRA issue: ${issueKey}`);

      const fieldsToFetch = fields ||
        this.config.fetchFields ||
        JIRA_DEFAULTS.DEFAULT_FIELDS;

      const response = await this.axiosInstance.get(
        `${JIRA_ENDPOINTS.ISSUE}/${issueKey}`,
        {
          params: {
            fields: fieldsToFetch.join(','),
          },
        }
      );

      console.log(`✅ Successfully fetched issue: ${response.data.key}`);

      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching issue ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Fetch JIRA ticket with sub-tasks
   * Gets parent issue and all child issues in a single operation
   *
   * @param query - Ticket query configuration
   * @returns Promise resolving to issue details with sub-tasks
   */
  async getTicketDetails(query: JiraTicketQueryDto): Promise<JiraIssueDetailsResponseDto> {
    try {
      const jiraId = extractJiraId(query.ticketId);
      console.log(`🎫 Fetching ticket details for: ${jiraId}`);

      // Fetch parent issue directly using issue key
      const parentIssue = await this.getIssueByKey(jiraId, query.fields);
      console.log(`✅ Retrieved parent issue: ${parentIssue.key}`);

      // Search for sub-tasks if requested
      let subIssues: JiraIssue[] = [];
      if (query.includeSubTasks !== false) {
        try {
          const jql = `parent = ${jiraId}`;
          console.log(`🔍 Searching for sub-tasks with JQL: ${jql}`);

          const searchResponse = await this.searchIssues({
            jql,
            maxResults: 100,
            fields: query.fields || this.config.fetchFields,
          });

          subIssues = searchResponse.issues || [];
          console.log(`✅ Retrieved ${subIssues.length} sub-task(s) for ${jiraId}`);
        } catch (subTaskError) {
          console.warn(`⚠️  Could not fetch sub-tasks: ${subTaskError}`);
          // Continue without sub-tasks
        }
      }

      // Format text representation
      const formattedText = this.formatIssueDetails(parentIssue, subIssues);

      return {
        issue: parentIssue,
        subIssues,
        formattedText,
      };
    } catch (error) {
      console.error('❌ Error fetching ticket details:', error);
      throw error;
    }
  }

  /**
   * Format issue details to human-readable text
   * Includes parent issue and sub-tasks
   *
   * @param parentIssue - Main JIRA issue
   * @param subIssues - Array of sub-tasks
   * @returns Formatted text representation
   */
  private formatIssueDetails(parentIssue: JiraIssue, subIssues?: JiraIssue[]): string {
    let result = '';

    // Defensive check for undefined fields
    if (!parentIssue || !parentIssue.fields) {
      console.error('⚠️  Invalid JIRA issue structure - missing fields');
      console.error('   Issue data:', JSON.stringify(parentIssue, null, 2));
      return 'Error: Unable to format JIRA issue - missing fields data';
    }

    // Format parent issue
    const parentDescription = parentIssue.fields.description
      ? extractParagraphText(parentIssue.fields.description).join('\n')
      : 'No description provided';

    result += `**${parentIssue.key} :- ${sanitizeText(parentIssue.fields.summary)}** : ${sanitizeText(parentDescription)}`;

    // Format sub-tasks if any
    if (subIssues && subIssues.length > 0) {
      result += `\n\n### Sub-Tasks\n`;

      for (const subIssue of subIssues) {
        // Skip sub-issues with missing fields
        if (!subIssue || !subIssue.fields) {
          console.warn('⚠️  Skipping sub-issue with missing fields:', subIssue?.key || 'unknown');
          continue;
        }

        const subDescription = subIssue.fields.description
          ? extractParagraphText(subIssue.fields.description).join('\n')
          : 'No description provided';

        result += `- **${sanitizeText(subIssue.fields.summary)}**: ${sanitizeText(subDescription)}\n`;
      }
    }

    return result.trim();
  }

  /**
   * Handle API errors with proper error messages
   * @param error - Axios error object
   * @returns Promise rejection with formatted error
   */
  private handleApiError(error: AxiosError): Promise<never> {
    const statusCode = error.response?.status || 500;
    let message: string = JIRA_ERROR_MESSAGES.NETWORK_ERROR;

    // Map status codes to user-friendly messages
    switch (statusCode) {
      case JIRA_STATUS_CODES.UNAUTHORIZED:
        message = JIRA_ERROR_MESSAGES.INVALID_CREDENTIALS;
        break;
      case JIRA_STATUS_CODES.FORBIDDEN:
        message = JIRA_ERROR_MESSAGES.FORBIDDEN;
        break;
      case JIRA_STATUS_CODES.NOT_FOUND:
        message = JIRA_ERROR_MESSAGES.TICKET_NOT_FOUND;
        break;
      case JIRA_STATUS_CODES.RATE_LIMIT:
        message = JIRA_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;
        break;
      case JIRA_STATUS_CODES.BAD_REQUEST:
        message = JIRA_ERROR_MESSAGES.INVALID_JQL;
        break;
    }

    // Check for specific error conditions
    if (error.message?.toLowerCase().includes('getaddrinfo')) {
      message = JIRA_ERROR_MESSAGES.URL_NOT_FOUND;
    }

    const responseData: any = error.response?.data || {};
    const errorResponse: JiraErrorResponseDto = {
      message,
      statusCode,
      errors: responseData.errors,
      warnings: responseData.warnings,
    };

    console.error(`❌ JIRA API Error [${statusCode}]: ${message}`);

    const enhancedError = new Error(message) as any;
    enhancedError.statusCode = statusCode;
    enhancedError.response = error.response;
    enhancedError.details = errorResponse;

    return Promise.reject(enhancedError);
  }

  /**
   * Validate configuration
   * Throws error if required configuration is missing
   */
  validateConfig(): void {
    const missingFields: string[] = [];

    if (!this.config.url) {
      missingFields.push('url');
    }
    if (!this.config.email) {
      missingFields.push('email');
    }
    if (!this.config.apiToken) {
      missingFields.push('apiToken');
    }

    if (missingFields.length > 0) {
      throw new Error(
        `${JIRA_ERROR_MESSAGES.MISSING_CONFIG}\n` +
        `Missing fields: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Test authentication by making a simple API call
   * Gets current user information to verify credentials are valid
   *
   * @returns Promise resolving to true if authentication successful
   * @throws Error with authentication failure details
   */
  async testAuthentication(): Promise<boolean> {
    try {
      console.log('🔐 Testing JIRA authentication...');

      // Make a simple API call to get current user info
      const response = await this.axiosInstance.get('/rest/api/3/myself');

      const user = response.data;
      console.log(`✅ Authentication successful - Logged in as: ${user.displayName} (${user.emailAddress})`);

      return true;
    } catch (error: any) {
      console.error('❌ Authentication failed');

      // Provide helpful error messages
      if (error.statusCode === 401 || error.statusCode === 403) {
        console.error('');
        console.error('💡 Authentication Issue:');
        console.error('   - Your JIRA API token may be invalid or expired');
        console.error('   - Generate a new token at: https://id.atlassian.com/manage-profile/security/api-tokens');
        console.error('   - Update the JIRA_API_TOKEN in your .env file');
        console.error('');
        console.error(`   Current email: ${this.config.email}`);
        console.error(`   JIRA URL: ${this.config.url}`);
      } else if (error.statusCode === 404) {
        console.error('');
        console.error('💡 Possible Issues:');
        console.error('   - Your account may not have access to this JIRA instance');
        console.error('   - The JIRA URL might be incorrect');
        console.error('   - Your API token may be valid but lacks proper permissions');
        console.error('');
        console.error(`   Current email: ${this.config.email}`);
        console.error(`   JIRA URL: ${this.config.url}`);
      }

      throw new Error(`JIRA authentication failed: ${error.message}`);
    }
  }
}
