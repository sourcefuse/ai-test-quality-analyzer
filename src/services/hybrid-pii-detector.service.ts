/**
 * Hybrid PII Detector Service
 * Uses Presidio if available, falls back to custom regex-based detection
 */

import {PresidioService, PresidioPIIEntity} from './presidio.service';
import {
  detectPII,
  redactPII,
  PIIDetectionResult,
  PIIMatch,
} from '../utils/pii-detector.util';

export type PIIDetectionMethod = 'presidio' | 'regex' | 'unknown';

export interface HybridPIIResult {
  hasPII: boolean;
  redactedText: string;
  originalText: string;
  method: PIIDetectionMethod;
  // Presidio-specific data
  presidioEntities?: PresidioPIIEntity[];
  // Regex-specific data
  regexMatches?: PIIMatch[];
  summary?: {[key: string]: number};
}

export interface HybridPIIDetectorConfig {
  presidioAnalyzeUrl?: string;
  presidioAnonymizeUrl?: string;
  presidioTimeout?: number;
  preferPresidio?: boolean;
  maskingChar?: string;
}

/**
 * Hybrid PII Detector Service
 * Intelligently switches between Presidio and regex-based detection
 */
export class HybridPIIDetectorService {
  private presidioService: PresidioService | null = null;
  private config: Required<HybridPIIDetectorConfig>;
  private detectionMethod: PIIDetectionMethod = 'unknown';

  constructor(config?: HybridPIIDetectorConfig) {
    this.config = {
      presidioAnalyzeUrl:
        config?.presidioAnalyzeUrl ||
        process.env.PRESIDIO_ANALYZE_URL ||
        'http://localhost:5002/analyze',
      presidioAnonymizeUrl:
        config?.presidioAnonymizeUrl ||
        process.env.PRESIDIO_ANONYMIZE_URL ||
        'http://localhost:5001/anonymize',
      presidioTimeout: config?.presidioTimeout || 5000,
      preferPresidio: config?.preferPresidio !== false, // Default to true
      maskingChar: config?.maskingChar || '*',
    };

    // Initialize Presidio service if URLs are configured
    if (this.config.presidioAnalyzeUrl && this.config.presidioAnonymizeUrl) {
      this.presidioService = new PresidioService({
        analyzeUrl: this.config.presidioAnalyzeUrl,
        anonymizeUrl: this.config.presidioAnonymizeUrl,
        timeout: this.config.presidioTimeout,
      });
    }
  }

  /**
   * Initialize and determine which detection method to use
   * @returns The detection method that will be used
   */
  async initialize(): Promise<PIIDetectionMethod> {
    if (!this.presidioService || !this.config.preferPresidio) {
      this.detectionMethod = 'regex';
      return this.detectionMethod;
    }

    try {
      const isPresidioAvailable =
        await this.presidioService.checkAvailability(true);
      this.detectionMethod = isPresidioAvailable ? 'presidio' : 'regex';
      return this.detectionMethod;
    } catch (error) {
      this.detectionMethod = 'regex';
      return this.detectionMethod;
    }
  }

  /**
   * Detect and redact PII using the best available method
   * @param text - Text to analyze and redact
   * @returns Detection result with redacted text
   */
  async detectAndRedact(text: string): Promise<HybridPIIResult> {
    // Ensure detection method is determined
    if (this.detectionMethod === 'unknown') {
      await this.initialize();
    }

    // Try Presidio first if available and preferred
    if (this.detectionMethod === 'presidio' && this.presidioService) {
      try {
        const result = await this.presidioService.detectAndRedact(
          text,
          this.config.maskingChar,
        );

        return {
          hasPII: result.hasPII,
          redactedText: result.redactedText,
          originalText: result.originalText,
          method: 'presidio',
          presidioEntities: result.entities,
        };
      } catch (error: any) {
        // Presidio failed, fall back to regex
        console.warn(
          `⚠️  Presidio detection failed (${error.message}), falling back to regex`,
        );
        this.detectionMethod = 'regex'; // Switch to regex for future calls
      }
    }

    // Use regex-based detection (either by choice or as fallback)
    return this.detectAndRedactWithRegex(text);
  }

  /**
   * Detect and redact PII using regex-based detection
   * @param text - Text to analyze and redact
   * @returns Detection result with redacted text
   */
  private detectAndRedactWithRegex(text: string): HybridPIIResult {
    const detectionResult: PIIDetectionResult = detectPII(text);
    const redactedText = detectionResult.hasPII
      ? redactPII(text, this.config.maskingChar)
      : text;

    return {
      hasPII: detectionResult.hasPII,
      redactedText,
      originalText: text,
      method: 'regex',
      regexMatches: detectionResult.matches,
      summary: detectionResult.summary,
    };
  }

  /**
   * Detect PII without redacting (analysis only)
   * @param text - Text to analyze
   * @returns Detection result
   */
  async detect(text: string): Promise<HybridPIIResult> {
    // Ensure detection method is determined
    if (this.detectionMethod === 'unknown') {
      await this.initialize();
    }

    // Try Presidio first if available
    if (this.detectionMethod === 'presidio' && this.presidioService) {
      try {
        const result = await this.presidioService.analyze({text});

        return {
          hasPII: result.entities.length > 0,
          redactedText: text, // Not redacted, just analyzed
          originalText: text,
          method: 'presidio',
          presidioEntities: result.entities,
        };
      } catch (error: any) {
        console.warn(
          `⚠️  Presidio detection failed (${error.message}), falling back to regex`,
        );
        this.detectionMethod = 'regex';
      }
    }

    // Use regex-based detection
    const detectionResult: PIIDetectionResult = detectPII(text);

    return {
      hasPII: detectionResult.hasPII,
      redactedText: text, // Not redacted, just analyzed
      originalText: text,
      method: 'regex',
      regexMatches: detectionResult.matches,
      summary: detectionResult.summary,
    };
  }

  /**
   * Get the current detection method being used
   */
  getDetectionMethod(): PIIDetectionMethod {
    return this.detectionMethod;
  }

  /**
   * Get detailed status of the detector
   */
  getStatus(): {
    detectionMethod: PIIDetectionMethod;
    presidioConfigured: boolean;
    presidioStatus: {isAvailable: boolean | null; lastChecked: Date | null} | null;
  } {
    return {
      detectionMethod: this.detectionMethod,
      presidioConfigured: this.presidioService !== null,
      presidioStatus: this.presidioService
        ? this.presidioService.getAvailabilityStatus()
        : null,
    };
  }

  /**
   * Force a specific detection method
   * @param method - Detection method to use
   */
  setDetectionMethod(method: 'presidio' | 'regex'): void {
    if (method === 'presidio' && !this.presidioService) {
      throw new Error('Cannot set Presidio method - service not configured');
    }
    this.detectionMethod = method;
  }

  /**
   * Convert Presidio entities to a summary format similar to regex results
   * @param entities - Presidio entities
   * @returns Summary by entity type
   */
  static getPresidioSummary(
    entities: PresidioPIIEntity[],
  ): {[key: string]: number} {
    const summary: {[key: string]: number} = {};
    for (const entity of entities) {
      summary[entity.entity_type] = (summary[entity.entity_type] || 0) + 1;
    }
    return summary;
  }

  /**
   * Generate a human-readable report of PII detection
   * @param result - Hybrid PII detection result
   * @returns Formatted report string
   */
  static generateReport(result: HybridPIIResult): string {
    if (!result.hasPII) {
      return `✅ No PII detected (method: ${result.method})\n`;
    }

    let report = `⚠️  PII DETECTED (method: ${result.method})\n`;
    report += '='.repeat(60) + '\n\n';

    if (result.method === 'presidio' && result.presidioEntities) {
      const summary = HybridPIIDetectorService.getPresidioSummary(
        result.presidioEntities,
      );
      report += '📊 Summary:\n';
      for (const [type, count] of Object.entries(summary)) {
        report += `   - ${type}: ${count} occurrence(s)\n`;
      }
      report += '\n';
      report += `🔍 Total entities detected: ${result.presidioEntities.length}\n`;
    } else if (result.method === 'regex' && result.summary) {
      report += '📊 Summary:\n';
      for (const [type, count] of Object.entries(result.summary)) {
        report += `   - ${type}: ${count} occurrence(s)\n`;
      }
      report += '\n';
      if (result.regexMatches) {
        report += `🔍 Total matches: ${result.regexMatches.length}\n`;
      }
    }

    report += '\n';
    report += '⚠️  PII has been redacted from the content\n';
    report += '='.repeat(60) + '\n';

    return report;
  }
}
