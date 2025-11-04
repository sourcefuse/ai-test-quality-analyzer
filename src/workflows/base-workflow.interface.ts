/**
 * Base Workflow Interface
 * Contract that all branch-specific workflows must implement
 */

import {EnvironmentManagerService} from '../core/environment-manager.service';
import {FolderManagerService} from '../core/folder-manager.service';
import {ConsoleLoggerUtil} from '../utils/console-logger.util';

export interface WorkflowContext {
  environmentManager: EnvironmentManagerService;
  folderManager: FolderManagerService;
  logger: ConsoleLoggerUtil;
  config: any;
}

export interface BaseWorkflowInterface {
  /**
   * Execute the workflow with provided context
   */
  execute(context: WorkflowContext): Promise<void>;

  /**
   * Get workflow-specific configuration schema
   */
  getConfigSchema(): any;

  /**
   * Validate workflow prerequisites
   */
  validatePrerequisites(context: WorkflowContext): Promise<boolean>;
}