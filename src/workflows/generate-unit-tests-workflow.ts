/**
 * Generate Unit Tests Workflow
 * Branch-specific implementation for test generation workflow
 */

import {BaseWorkflowInterface, WorkflowContext} from './base-workflow.interface';
import {JiraService, ConfluenceService} from '../services';
import {JiraTicketQueryDto, ConfluenceSearchRequestDto} from '../dtos';
import {stripHtmlTags, extractPlainText, createAIService} from '../utils';

export class GenerateUnitTestsWorkflow implements BaseWorkflowInterface {
  
  async execute(context: WorkflowContext): Promise<void> {
    const {environmentManager, folderManager, logger, config} = context;
    
    logger.logStep(1, 'Initialize Services & Configuration');
    
    // Get configurations
    const jiraConfig = environmentManager.getJiraConfig();
    const confluenceConfig = environmentManager.getConfluenceConfig();
    const workflowConfig = environmentManager.getWorkflowConfig();
    
    // Validate required environment variables
    const requiredVars = [
      'JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_TICKET_ID',
      'CONFLUENCE_URL', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_SPACE_KEY'
    ];
    
    const missingVars = environmentManager.validateRequired(requiredVars);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    logger.logConfig({
      'JIRA URL': jiraConfig.url,
      'JIRA Email': jiraConfig.email,
      'JIRA Project': jiraConfig.projectKey,
      'Confluence URL': confluenceConfig.host,
      'Confluence Space': confluenceConfig.spaceKey,
      'Ticket ID': workflowConfig.jiraTicketId,
    });

    // Create folder structure
    const folderPath = folderManager.createFolderStructure({
      spaceKey: confluenceConfig.spaceKey || 'BB',
      ticketId: workflowConfig.jiraTicketId,
      baseFolderSuffix: workflowConfig.baseFolderSuffix || 'Generate-Unit-Tests-Via-AI',
      currentAnalysisPath: workflowConfig.currentAnalysisPath,
    });

    // Execute workflow steps
    await this.fetchJiraData(context, jiraConfig, folderPath, workflowConfig);
    await this.fetchConfluenceData(context, confluenceConfig, folderPath, workflowConfig);
    await this.generateRequirements(context, folderPath, workflowConfig);
    
    logger.logCompletion();
  }

  async validatePrerequisites(context: WorkflowContext): Promise<boolean> {
    const {environmentManager} = context;
    
    const requiredVars = [
      'JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_TICKET_ID',
      'CONFLUENCE_URL', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_SPACE_KEY'
    ];
    
    const missingVars = environmentManager.validateRequired(requiredVars);
    return missingVars.length === 0;
  }

  getConfigSchema(): any {
    return {
      baseFolderSuffix: 'Generate-Unit-Tests-Via-AI',
      confluenceRootPageSuffix: 'Generate-Unit-Tests-Via-AI',
      confluenceTicketPageSuffix: 'Via-AI',
      reportFileName: 'GeneratedTestsReport.md',
      workflowType: 'generate-unit-tests',
    };
  }

  /**
   * Fetch JIRA ticket data
   */
  private async fetchJiraData(
    context: WorkflowContext, 
    jiraConfig: any, 
    folderPath: string, 
    workflowConfig: any
  ): Promise<void> {
    const {folderManager, logger} = context;
    
    logger.logStep(2, 'Fetch JIRA Ticket Data');
    
    const jiraService = new JiraService(jiraConfig);
    
    if (!workflowConfig.jiraTicketId) {
      logger.logWarning('JIRA_TICKET_ID not set, skipping JIRA data fetch');
      return;
    }

    try {
      const ticketData = await jiraService.getTicket(workflowConfig.jiraTicketId);
      
      if (ticketData) {
        const jiraContent = this.formatJiraContent(ticketData);
        
        if (workflowConfig.saveToFile) {
          folderManager.writeFile(folderPath, workflowConfig.jiraFileName, jiraContent);
        }
        
        logger.logSuccess(`JIRA ticket ${workflowConfig.jiraTicketId} fetched successfully`);
      }
    } catch (error) {
      logger.logError('Failed to fetch JIRA data', error);
      throw error;
    }
  }

  /**
   * Fetch Confluence documentation
   */
  private async fetchConfluenceData(
    context: WorkflowContext,
    confluenceConfig: any,
    folderPath: string,
    workflowConfig: any
  ): Promise<void> {
    const {folderManager, logger} = context;
    
    logger.logStep(3, 'Fetch Confluence Documentation');
    
    const confluenceService = new ConfluenceService(confluenceConfig);
    
    try {
      // Search for relevant pages
      const searchRequest: ConfluenceSearchRequestDto = {
        spaceKey: confluenceConfig.spaceKey,
        query: workflowConfig.jiraTicketId || '',
        maxResults: 50,
      };
      
      const pages = await confluenceService.searchPages(searchRequest);
      
      if (pages && pages.length > 0) {
        const confluenceContent = await this.processConfluencePages(confluenceService, pages);
        
        if (workflowConfig.saveToFile) {
          folderManager.writeFile(folderPath, workflowConfig.confluenceFileName, confluenceContent);
        }
        
        logger.logSuccess(`Found and processed ${pages.length} Confluence pages`);
      } else {
        logger.logWarning('No relevant Confluence pages found');
      }
    } catch (error) {
      logger.logError('Failed to fetch Confluence data', error);
      throw error;
    }
  }

  /**
   * Generate requirements document
   */
  private async generateRequirements(
    context: WorkflowContext,
    folderPath: string,
    workflowConfig: any
  ): Promise<void> {
    const {folderManager, logger} = context;
    
    logger.logStep(4, 'Generate Requirements Document');
    
    try {
      // Read JIRA and Confluence content
      const jiraContent = folderManager.fileExists(folderPath, workflowConfig.jiraFileName) 
        ? folderManager.readFile(folderPath, workflowConfig.jiraFileName) 
        : '';
        
      const confluenceContent = folderManager.fileExists(folderPath, workflowConfig.confluenceFileName)
        ? folderManager.readFile(folderPath, workflowConfig.confluenceFileName)
        : '';

      // Generate requirements from JIRA and Confluence content
      const requirements = this.generateRequirementsContent(
        jiraContent, 
        confluenceContent, 
        workflowConfig.jiraTicketId
      );
      
      if (workflowConfig.saveToFile) {
        folderManager.writeFile(folderPath, workflowConfig.requirementsFileName, requirements);
      }
      
      logger.logSuccess('Requirements document generated successfully');
    } catch (error) {
      logger.logError('Failed to generate requirements', error);
      throw error;
    }
  }

  /**
   * Format JIRA content for output
   */
  private formatJiraContent(ticketData: any): string {
    return `# JIRA Ticket: ${ticketData.key}

## Summary
${ticketData.fields?.summary || 'No summary available'}

## Description
${stripHtmlTags(ticketData.fields?.description || 'No description available')}

## Status
- **Status**: ${ticketData.fields?.status?.name || 'Unknown'}
- **Priority**: ${ticketData.fields?.priority?.name || 'Unknown'}
- **Assignee**: ${ticketData.fields?.assignee?.displayName || 'Unassigned'}

## Type
${ticketData.fields?.issuetype?.name || 'Unknown'}

---
*Fetched: ${new Date().toISOString()}*
`;
  }

  /**
   * Process Confluence pages content
   */
  private async processConfluencePages(confluenceService: any, pages: any[]): Promise<string> {
    let content = `# Confluence Documentation\n\n`;
    content += `**Found ${pages.length} relevant pages**\n\n`;
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      content += `## ${i + 1}. ${page.title}\n\n`;
      
      try {
        const pageContent = await confluenceService.getPageContent(page.id);
        const cleanContent = stripHtmlTags(extractPlainText(pageContent.body || ''));
        content += `${cleanContent}\n\n---\n\n`;
      } catch (error) {
        content += `*Error fetching page content: ${error.message}*\n\n---\n\n`;
      }
    }
    
    content += `\n*Processed: ${new Date().toISOString()}*\n`;
    return content;
  }

  /**
   * Generate requirements content
   */
  private generateRequirementsContent(jiraContent: string, confluenceContent: string, ticketId: string): string {
    return `# Requirements Analysis for ${ticketId}

## JIRA Ticket Requirements
${jiraContent ? 'Based on JIRA ticket information:' : 'No JIRA content available'}

${jiraContent || ''}

## Confluence Documentation Context
${confluenceContent ? 'Additional context from Confluence:' : 'No Confluence content available'}

${confluenceContent || ''}

## Test Generation Scope
Based on the above requirements, the following unit tests should be generated:

1. **Core Functionality Tests**
   - Test main business logic functions
   - Test input validation
   - Test error handling

2. **Edge Cases Tests**
   - Test boundary conditions
   - Test null/undefined inputs
   - Test invalid data scenarios

3. **Integration Tests**
   - Test service interactions
   - Test database operations
   - Test external API calls

## Test Framework Requirements
- Use existing project test framework
- Follow existing test patterns
- Maintain consistent naming conventions
- Include proper mocking strategies

---
*Generated: ${new Date().toISOString()}*
`;
  }
}

export default GenerateUnitTestsWorkflow;