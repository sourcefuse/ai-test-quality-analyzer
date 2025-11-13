/**
 * Confluence HTML Utility
 * Utilities for processing Confluence HTML content
 */

import {HTML_PATTERNS} from '../constants';

/**
 * Strip HTML tags and clean up content
 * Removes HTML tags, URLs, and special characters
 *
 * @param htmlString - HTML string to clean
 * @returns Cleaned text content
 *
 * @example
 * stripHtmlTags('<p>Hello <b>World</b></p>')
 * // Returns: 'Hello World'
 */
export function stripHtmlTags(htmlString: string): string {
  if (!htmlString) {
    return '';
  }

  return htmlString
    // Remove HTML tags
    .replace(HTML_PATTERNS.TAGS, '')
    // Remove URLs
    .replace(HTML_PATTERNS.URLS, '')
    // Remove email domain
    .replace(HTML_PATTERNS.EMAIL_DOMAIN, '')
    // Remove curly braces
    .replace(HTML_PATTERNS.BRACES, '')
    // Normalize multiple newlines to single newline
    .replace(HTML_PATTERNS.DOUBLE_NEWLINES, '\n')
    .trim();
}

/**
 * Extract plain text from Confluence storage format
 * Handles Confluence-specific HTML structures
 *
 * @param confluenceHtml - Confluence HTML content
 * @returns Plain text content
 */
export function extractPlainText(confluenceHtml: string): string {
  if (!confluenceHtml) {
    return '';
  }

  let text = confluenceHtml;

  // Replace common HTML entities with their text equivalents
  text = text
    // Whitespace entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    // Quotation marks
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&sbquo;/g, "'")
    .replace(/&lsaquo;/g, '<')
    .replace(/&rsaquo;/g, '>')
    // Dashes
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '--')
    .replace(/&minus;/g, '-')
    // Arrows
    .replace(/&larr;/g, '<-')
    .replace(/&rarr;/g, '->')
    .replace(/&uarr;/g, '^')
    .replace(/&darr;/g, 'v')
    .replace(/&harr;/g, '<->')
    .replace(/&lArr;/g, '<=')
    .replace(/&rArr;/g, '=>')
    .replace(/&hArr;/g, '<=>')
    // Mathematical symbols
    .replace(/&times;/g, 'x')
    .replace(/&divide;/g, '/')
    .replace(/&plusmn;/g, '+/-')
    .replace(/&ne;/g, '!=')
    .replace(/&equiv;/g, '==')
    .replace(/&asymp;/g, '~=')
    // Comparison operators
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&le;/g, '<=')
    .replace(/&ge;/g, '>=')
    // Fractions
    .replace(/&frac14;/g, '1/4')
    .replace(/&frac12;/g, '1/2')
    .replace(/&frac34;/g, '3/4')
    // Currency
    .replace(/&cent;/g, 'c')
    .replace(/&pound;/g, 'GBP')
    .replace(/&yen;/g, 'JPY')
    .replace(/&euro;/g, 'EUR')
    // Ampersand (do this last to avoid double-replacing)
    .replace(/&amp;/g, '&')
    // Misc symbols
    .replace(/&copy;/g, '(c)')
    .replace(/&reg;/g, '(R)')
    .replace(/&trade;/g, '(TM)')
    .replace(/&deg;/g, 'deg')
    .replace(/&para;/g, 'P')
    .replace(/&sect;/g, 'S')
    .replace(/&bull;/g, '*')
    .replace(/&middot;/g, '.')
    .replace(/&hellip;/g, '...')
    .replace(/&prime;/g, "'")
    .replace(/&Prime;/g, '"')
    .replace(/&permil;/g, 'o/oo')
    .replace(/&dagger;/g, '+')
    .replace(/&Dagger;/g, '++')
    // Numeric entities (common ones)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Strip all HTML tags
  text = stripHtmlTags(text);

  // Clean up whitespace - preserve newlines for readability
  text = text
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
    .replace(/\n\s+/g, '\n') // Remove spaces after newlines
    .trim();

  return text;
}

/**
 * Convert HTML to markdown-like format
 * Preserves basic formatting structure
 *
 * @param htmlContent - HTML content to convert
 * @returns Markdown-like text
 */
export function htmlToMarkdown(htmlContent: string): string {
  if (!htmlContent) {
    return '';
  }

  let markdown = htmlContent;

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');

  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/p>/gi, '\n\n');

  // Convert lists
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Remove remaining HTML tags
  markdown = stripHtmlTags(markdown);

  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  return markdown.trim();
}

/**
 * Clean content for storage in files
 * Removes problematic characters and normalizes whitespace
 *
 * @param content - Content to clean
 * @returns Cleaned content
 */
export function cleanContentForStorage(content: string): string {
  if (!content) {
    return '';
  }

  return content
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove null bytes
    .replace(/\0/g, '')
    // Normalize whitespace
    .replace(/\t/g, '  ')
    .replace(/ +/g, ' ')
    .trim();
}

/**
 * Check if content is empty or contains only whitespace/HTML tags
 *
 * @param htmlContent - HTML content to check
 * @returns True if content is effectively empty
 */
export function isContentEmpty(htmlContent: string): boolean {
  if (!htmlContent) {
    return true;
  }

  const plainText = extractPlainText(htmlContent);
  return plainText.length === 0;
}

/**
 * Truncate content to specified length
 * Preserves word boundaries
 *
 * @param content - Content to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated content
 */
export function truncateContent(content: string, maxLength: number, suffix: string = '...'): string {
  if (!content || content.length <= maxLength) {
    return content;
  }

  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + suffix;
  }

  return truncated + suffix;
}
