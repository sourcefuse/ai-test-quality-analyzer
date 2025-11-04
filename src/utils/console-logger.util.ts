/**
 * Console Logger Utility
 * Provides consistent logging across workflows
 */

export class ConsoleLoggerUtil {
  private workflowName: string;

  constructor(workflowName?: string) {
    this.workflowName = workflowName || 'Workflow';
  }

  /**
   * Log workflow header
   */
  logHeader(): void {
    console.log('='.repeat(60));
    console.log(`${this.workflowName} - JIRA & Confluence Integration`);
    console.log('='.repeat(60));
    console.log('Node version:', process.version);
    console.log('Current directory:', process.cwd());
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('='.repeat(60));
  }

  /**
   * Log step header
   */
  logStep(stepNumber: number, stepName: string): void {
    console.log(`\n📋 Step ${stepNumber}: ${stepName}`);
    console.log('-'.repeat(40));
  }

  /**
   * Log configuration
   */
  logConfig(config: any): void {
    console.log('\n🔧 Configuration:');
    Object.entries(config).forEach(([key, value]) => {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
        console.log(`- ${key}: ***hidden***`);
      } else {
        console.log(`- ${key}:`, value || 'Not set');
      }
    });
  }

  /**
   * Log success message
   */
  logSuccess(message: string): void {
    console.log(`\n✅ ${message}`);
  }

  /**
   * Log error message
   */
  logError(message: string, error?: any): void {
    console.error(`\n❌ ${message}`);
    if (error) {
      console.error('Error details:', error.message || error);
    }
  }

  /**
   * Log warning message
   */
  logWarning(message: string): void {
    console.log(`\n⚠️  ${message}`);
  }

  /**
   * Log info message
   */
  logInfo(message: string): void {
    console.log(`\nℹ️  ${message}`);
  }

  /**
   * Log progress
   */
  logProgress(current: number, total: number, item: string): void {
    console.log(`   Processing ${current}/${total}: ${item}`);
  }

  /**
   * Log completion footer
   */
  logCompletion(): void {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ ${this.workflowName} - Completed successfully!`);
    console.log('='.repeat(60));
  }
}