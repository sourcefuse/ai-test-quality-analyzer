/**
 * Workflow Executor Service
 * Main orchestrator that loads and executes branch-specific workflows
 */

import {BaseWorkflowInterface} from '../workflows/base-workflow.interface';
import {EnvironmentManagerService} from './environment-manager.service';
import {FolderManagerService} from './folder-manager.service';
import {ConsoleLoggerUtil} from '../utils/console-logger.util';

export class WorkflowExecutorService {
  private environmentManager = new EnvironmentManagerService();
  private folderManager = new FolderManagerService();
  private logger = new ConsoleLoggerUtil();

  /**
   * Execute workflow based on branch configuration
   */
  async execute(): Promise<void> {
    try {
      // Load environment and detect workflow type
      this.environmentManager.loadEnvironment();
      this.logger.logHeader();

      // Get workflow configuration
      const workflowConfig = this.getWorkflowConfig();
      
      // Load dynamic workflow
      const workflow = await this.loadWorkflow(workflowConfig.workflowType);
      
      // Execute workflow steps
      await workflow.execute({
        environmentManager: this.environmentManager,
        folderManager: this.folderManager,
        logger: this.logger,
        config: workflowConfig
      });

      this.logger.logSuccess('Workflow completed successfully!');
    } catch (error) {
      this.logger.logError('Workflow failed:', error);
      throw error;
    }
  }

  /**
   * Get workflow configuration based on environment
   */
  private getWorkflowConfig(): any {
    const workflowType = process.env.WORKFLOW_TYPE || this.detectWorkflowType();
    
    return {
      workflowType,
      baseFolderSuffix: process.env.BASE_FOLDER_SUFFIX,
      confluenceRootPageSuffix: process.env.CONFLUENCE_ROOT_PAGE_SUFFIX,
      confluenceTicketPageSuffix: process.env.CONFLUENCE_TICKET_PAGE_SUFFIX,
      // Add other common config
    };
  }

  /**
   * Detect workflow type from environment or branch
   */
  private detectWorkflowType(): string {
    // Could detect from git branch, package.json, or environment
    const packageJson = require('../../package.json');
    
    if (packageJson.name.includes('generate')) return 'generate-unit-tests';
    if (packageJson.name.includes('check')) return 'check-unit-tests';
    
    // Default fallback
    return 'generate-unit-tests';
  }

  /**
   * Dynamically load workflow implementation
   */
  private async loadWorkflow(workflowType: string): Promise<BaseWorkflowInterface> {
    try {
      const workflowModule = await import(`../workflows/${workflowType}-workflow`);
      const WorkflowClass = workflowModule.default || workflowModule[Object.keys(workflowModule)[0]];
      return new WorkflowClass();
    } catch (error) {
      throw new Error(`Failed to load workflow: ${workflowType}. Error: ${error.message}`);
    }
  }
}