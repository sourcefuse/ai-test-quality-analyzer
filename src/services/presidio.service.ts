/**
 * Presidio Service
 * Integration with Microsoft Presidio for PII detection and anonymization
 */

export interface PresidioPIIEntity {
  entity_type: string;
  start: number;
  end: number;
  score: number;
  recognition_metadata?: {
    recognizer_name: string;
    recognizer_identifier?: string;
  };
}

export interface PresidioAnalyzeRequest {
  text: string;
  language?: string;
  correlation_id?: string;
  score_threshold?: number;
  entities?: string[];
  return_decision_process?: boolean;
}

export interface PresidioAnalyzeResponse {
  entities: PresidioPIIEntity[];
}

export interface PresidioAnonymizeRequest {
  text: string;
  anonymizers?: {
    [key: string]: {
      type: string;
      new_value?: string;
      masking_char?: string;
      chars_to_mask?: number;
      from_end?: boolean;
    };
  };
  analyzer_results: PresidioPIIEntity[];
}

export interface PresidioAnonymizeResponse {
  text: string;
  items: Array<{
    start: number;
    end: number;
    entity_type: string;
    text: string;
    operator: string;
  }>;
}

export interface PresidioConfig {
  analyzeUrl: string;
  anonymizeUrl: string;
  language?: string;
  scoreThreshold?: number;
  timeout?: number;
}

/**
 * Presidio Service for PII Detection and Anonymization
 */
export class PresidioService {
  private config: Required<PresidioConfig>;
  private isAvailable: boolean | null = null;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000; // 1 minute

  constructor(config: PresidioConfig) {
    this.config = {
      analyzeUrl: config.analyzeUrl,
      anonymizeUrl: config.anonymizeUrl,
      language: config.language || 'en',
      scoreThreshold: config.scoreThreshold || 0.5,
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Check if Presidio services are available
   * @param forceCheck - Force a new health check even if recently checked
   * @returns True if both analyzer and anonymizer are accessible
   */
  async checkAvailability(forceCheck: boolean = false): Promise<boolean> {
    const now = Date.now();

    // Use cached result if checked recently (within healthCheckInterval)
    if (
      !forceCheck &&
      this.isAvailable !== null &&
      now - this.lastHealthCheck < this.healthCheckInterval
    ) {
      return this.isAvailable as boolean; // Already checked !== null above
    }

    try {
      // Test analyzer endpoint with a simple request
      const analyzeTest = await fetch(this.config.analyzeUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          text: 'health check',
          language: this.config.language,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!analyzeTest.ok) {
        this.isAvailable = false;
        this.lastHealthCheck = now;
        return false;
      }

      // Test anonymizer endpoint
      const anonymizeTest = await fetch(this.config.anonymizeUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          text: 'health check',
          analyzer_results: [],
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      this.isAvailable = anonymizeTest.ok;
      this.lastHealthCheck = now;
      return this.isAvailable;
    } catch (error) {
      // Network error, timeout, or service unavailable
      this.isAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Analyze text for PII entities using Presidio Analyzer
   * @param request - Analysis request
   * @returns PII entities found in text
   * @throws Error if Presidio is not available or request fails
   */
  async analyze(
    request: PresidioAnalyzeRequest,
  ): Promise<PresidioAnalyzeResponse> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new Error('Presidio Analyzer service is not available');
    }

    const requestBody: PresidioAnalyzeRequest = {
      text: request.text,
      language: request.language || this.config.language,
      score_threshold: request.score_threshold || this.config.scoreThreshold,
      entities: request.entities,
      return_decision_process: request.return_decision_process || false,
      correlation_id: request.correlation_id,
    };

    try {
      const response = await fetch(this.config.analyzeUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Presidio Analyzer failed: ${response.status} - ${errorText}`,
        );
      }

      const entities = (await response.json()) as PresidioPIIEntity[];
      return {entities};
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Presidio Analyzer request timed out');
      }
      throw error;
    }
  }

  /**
   * Anonymize text using Presidio Anonymizer
   * @param request - Anonymization request
   * @returns Anonymized text
   * @throws Error if Presidio is not available or request fails
   */
  async anonymize(
    request: PresidioAnonymizeRequest,
  ): Promise<PresidioAnonymizeResponse> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new Error('Presidio Anonymizer service is not available');
    }

    try {
      const response = await fetch(this.config.anonymizeUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Presidio Anonymizer failed: ${response.status} - ${errorText}`,
        );
      }

      return (await response.json()) as PresidioAnonymizeResponse;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Presidio Anonymizer request timed out');
      }
      throw error;
    }
  }

  /**
   * Detect and redact PII in one step
   * @param text - Text to analyze and redact
   * @param maskingChar - Character to use for masking (default: *)
   * @returns Object with redacted text, entities found, and original text
   */
  async detectAndRedact(
    text: string,
    maskingChar: string = '*',
  ): Promise<{
    redactedText: string;
    entities: PresidioPIIEntity[];
    hasPII: boolean;
    originalText: string;
  }> {
    // Analyze text for PII
    const analyzeResult = await this.analyze({text});

    if (analyzeResult.entities.length === 0) {
      return {
        redactedText: text,
        entities: [],
        hasPII: false,
        originalText: text,
      };
    }

    // Build anonymizers config - use masking for all entity types
    const anonymizers: PresidioAnonymizeRequest['anonymizers'] = {};
    const uniqueEntityTypes = [
      ...new Set(analyzeResult.entities.map(e => e.entity_type)),
    ];

    for (const entityType of uniqueEntityTypes) {
      anonymizers[entityType] = {
        type: 'mask',
        masking_char: maskingChar,
        chars_to_mask: 0, // Mask all characters
        from_end: false,
      };
    }

    // Anonymize text
    const anonymizeResult = await this.anonymize({
      text,
      analyzer_results: analyzeResult.entities,
      anonymizers,
    });

    return {
      redactedText: anonymizeResult.text,
      entities: analyzeResult.entities,
      hasPII: true,
      originalText: text,
    };
  }

  /**
   * Get the current availability status without triggering a new check
   */
  getAvailabilityStatus(): {
    isAvailable: boolean | null;
    lastChecked: Date | null;
  } {
    return {
      isAvailable: this.isAvailable,
      lastChecked: this.lastHealthCheck > 0 ? new Date(this.lastHealthCheck) : null,
    };
  }
}
