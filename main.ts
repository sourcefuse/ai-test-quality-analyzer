/**
 * Main Entry Point
 * Thin, configurable entry point that works across all branches
 */

import {WorkflowExecutorService} from './src/core/workflow-executor.service';

/**
 * Main application function
 */
async function main(): Promise<void> {
  const executor = new WorkflowExecutorService();
  
  try {
    await executor.execute();
    process.exit(0);
  } catch (error) {
    console.error('❌ Application failed:', error.message);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export default main;