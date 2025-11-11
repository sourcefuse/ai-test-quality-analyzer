/**
 * PII Detector Utility
 * Detects Personally Identifiable Information (PII) using regex patterns
 */

export interface PIIMatch {
  type: string;
  value: string;
  position: number;
  line: number;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  matches: PIIMatch[];
  summary: {
    [key: string]: number;
  };
}

/**
 * Regex patterns for common PII types
 */
const PII_PATTERNS: {[key: string]: RegExp} = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // US Social Security Number (SSN)
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Credit Card Numbers (various formats)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // US Phone Numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,

  // IP Address (IPv4)
  ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // US Passport Number
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g,

  // Date of Birth (various formats)
  dateOfBirth: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12][0-9]|3[01])[-\/](?:19|20)\d{2}\b/g,

  // API Keys (common patterns)
  apiKey: /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[\s:=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,

  // AWS Access Key ID
  awsAccessKey: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,

  // AWS Secret Access Key
  awsSecretKey: /\b[A-Za-z0-9/+=]{40}\b/g,

  // Generic Secret/Password patterns
  secret: /\b(?:password|passwd|pwd|secret)[\s:=]+['"]?([^\s'"]{8,})['"]?/gi,

  // National ID patterns (generic)
  nationalId: /\b(?:national[_-]?id|citizen[_-]?id)[\s:=]+['"]?([A-Z0-9\-]{8,})['"]?/gi,

  // Driver's License (US format, varies by state)
  driversLicense: /\b(?:DL|CDL)[-.\s]?[A-Z0-9]{7,15}\b/g,

  // Bank Account Number (generic)
  bankAccount: /\b\d{8,17}\b/g,

  // Healthcare/Medical Record Number
  medicalRecord: /\b(?:MRN|Medical[_-]?Record)[\s:#]+([A-Z0-9\-]{6,})/gi,
};

/**
 * Detect PII in text content
 * @param content - Text content to scan
 * @returns Detection result with matches and summary
 */
export function detectPII(content: string): PIIDetectionResult {
  const matches: PIIMatch[] = [];
  const summary: {[key: string]: number} = {};

  // Split content into lines for line number tracking
  const lines = content.split('\n');

  // Check each PII pattern
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      pattern.lastIndex = 0; // Reset regex

      let match;
      while ((match = pattern.exec(line)) !== null) {
        matches.push({
          type,
          value: match[0],
          position: match.index,
          line: lineNumber,
        });

        // Update summary
        summary[type] = (summary[type] || 0) + 1;
      }
    }
  }

  return {
    hasPII: matches.length > 0,
    matches,
    summary,
  };
}

/**
 * Redact PII from content
 * @param content - Text content to redact
 * @param redactionChar - Character to use for redaction (default: *)
 * @returns Redacted content
 */
export function redactPII(content: string, redactionChar: string = '*'): string {
  let redactedContent = content;

  // Apply each PII pattern
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    pattern.lastIndex = 0; // Reset regex
    redactedContent = redactedContent.replace(pattern, (match) => {
      // Keep first 2 and last 2 characters visible for context
      if (match.length <= 4) {
        return redactionChar.repeat(match.length);
      }
      const visibleChars = 2;
      const redactedLength = match.length - visibleChars * 2;
      return (
        match.substring(0, visibleChars) +
        redactionChar.repeat(redactedLength) +
        match.substring(match.length - visibleChars)
      );
    });
  }

  return redactedContent;
}

/**
 * Generate PII detection report
 * @param result - PII detection result
 * @returns Formatted report string
 */
export function generatePIIReport(result: PIIDetectionResult): string {
  if (!result.hasPII) {
    return '✅ No PII detected in content\n';
  }

  let report = '⚠️  PII DETECTED IN CONTENT\n';
  report += '='.repeat(60) + '\n\n';

  // Summary section
  report += '📊 Summary:\n';
  for (const [type, count] of Object.entries(result.summary)) {
    report += `   - ${type}: ${count} occurrence(s)\n`;
  }
  report += '\n';

  // Detailed matches (limit to first 10 for readability)
  report += '🔍 Detailed Matches (first 10):\n';
  const limitedMatches = result.matches.slice(0, 10);
  for (const match of limitedMatches) {
    const redactedValue =
      match.value.length > 20
        ? match.value.substring(0, 8) + '...' + match.value.substring(match.value.length - 8)
        : match.value;
    report += `   Line ${match.line}: [${match.type}] ${redactedValue}\n`;
  }

  if (result.matches.length > 10) {
    report += `   ... and ${result.matches.length - 10} more\n`;
  }

  report += '\n';
  report += '⚠️  Please review and remove PII before sharing this content\n';
  report += '='.repeat(60) + '\n';

  return report;
}

/**
 * Check if content should be flagged based on PII threshold
 * @param result - PII detection result
 * @param threshold - Minimum number of PII matches to flag (default: 5)
 * @returns True if content should be flagged
 */
export function shouldFlagContent(
  result: PIIDetectionResult,
  threshold: number = 5,
): boolean {
  return result.matches.length >= threshold;
}
