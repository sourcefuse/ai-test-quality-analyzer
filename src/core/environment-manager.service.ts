/**
 * Environment Manager Service
 * Handles environment variables loading and configuration management
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import * as fs from 'fs';
import {JiraConfigDto, ConfluenceConfigDto} from '../dtos';

export class EnvironmentManagerService {
  private isLoaded = false;

  /**
   * Load environment variables with dotenv-extended
   */
  loadEnvironment(): void {
    if (this.isLoaded) return;

    const baseEnvPath = '.env';
    const envExamplePath = '.env.example';
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Load base .env first
    if (fs.existsSync(baseEnvPath)) {
      dotenv.config({path: baseEnvPath});
    }

    // Use dotenv-extended to validate against .env.example
    dotenvExt.load({
      schema: envExamplePath,
      errorOnMissing: false,
      includeProcessEnv: true,
      silent: false,
      path: baseEnvPath,
      defaults: envExamplePath,
    });

    this.isLoaded = true;
    console.log(`✅ Environment loaded: ${nodeEnv}`);
  }

  /**
   * Get JIRA configuration from environment variables
   */
  getJiraConfig(): JiraConfigDto {
    const fetchFields = process.env.JIRA_FETCH_FIELDS
      ? process.env.JIRA_FETCH_FIELDS.split(',').map(f => f.trim())
      : undefined;

    return {
      url: process.env.JIRA_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
      projectKey: process.env.JIRA_PROJECT_KEY,
      maxResult: process.env.JIRA_MAX_RESULT ? parseInt(process.env.JIRA_MAX_RESULT) : undefined,
      fetchFields,
    };
  }

  /**
   * Get Confluence configuration from environment variables
   */
  getConfluenceConfig(): ConfluenceConfigDto {
    return {
      host: process.env.CONFLUENCE_URL || '',
      email: process.env.CONFLUENCE_EMAIL || '',
      apiToken: process.env.CONFLUENCE_API_TOKEN || '',
      spaceKey: process.env.CONFLUENCE_SPACE_KEY,
    };
  }

  /**
   * Get workflow-specific configuration
   */
  getWorkflowConfig(): any {
    return {
      baseFolderSuffix: process.env.BASE_FOLDER_SUFFIX,
      confluenceRootPageSuffix: process.env.CONFLUENCE_ROOT_PAGE_SUFFIX,
      confluenceTicketPageSuffix: process.env.CONFLUENCE_TICKET_PAGE_SUFFIX,
      jiraTicketId: process.env.JIRA_TICKET_ID,
      currentAnalysisPath: process.env.CURRENT_ANALYSIS_PATH,
      saveToFile: process.env.SAVE_TO_FILE === 'true',
      // File names
      jiraFileName: process.env.JIRA_FILE_NAME || 'Jira.md',
      confluenceFileName: process.env.CONFLUENCE_FILE_NAME || 'Confluence.md',
      requirementsFileName: process.env.REQUIREMENTS_FILE_NAME || 'Requirements.md',
    };
  }

  /**
   * Check if required environment variables are set
   */
  validateRequired(requiredVars: string[]): string[] {
    const missing: string[] = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
    
    return missing;
  }
}