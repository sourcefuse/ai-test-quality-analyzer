/**
 * Naming Convention Utility
 * Handles consistent folder and file naming across workflows
 */

export class NamingConventionUtil {
  /**
   * Generate timestamp-based folder name
   */
  generateTimestampFolder(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}-Via-AI`;
  }

  /**
   * Generate base folder name
   */
  generateBaseFolder(spaceKey: string, suffix: string): string {
    return `${spaceKey}-${suffix}`;
  }

  /**
   * Generate ticket folder name
   */
  generateTicketFolder(ticketId: string): string {
    return `${ticketId}-Via-AI`;
  }

  /**
   * Sanitize folder/file name
   */
  sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '-');
  }

  /**
   * Get default file names based on workflow type
   */
  getDefaultFileNames(workflowType: 'generate' | 'check'): any {
    const base = {
      jira: 'Jira.md',
      confluence: 'Confluence.md',
      requirements: 'Requirements.md',
    };

    if (workflowType === 'generate') {
      return {
        ...base,
        report: 'GeneratedTestsReport.md',
      };
    } else {
      return {
        ...base,
        report: 'QualityAnalysisReport.md',
      };
    }
  }
}