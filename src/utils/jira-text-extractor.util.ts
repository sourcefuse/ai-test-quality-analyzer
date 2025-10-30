/**
 * JIRA Text Extractor Utility
 * Utilities for extracting and formatting text from JIRA content structures
 */

import {JiraContentNode} from '../models';
import {JIRA_CONTENT_TYPES} from '../constants';

/**
 * Extracts text content from JIRA description paragraphs
 * Traverses the content tree and collects text from all paragraph nodes
 *
 * @param jiraContent - The JIRA content structure from issue description
 * @returns Array of paragraph text strings
 */
export function extractParagraphText(jiraContent: any): string[] {
  const result: string[] = [];

  /**
   * Recursively traverse content nodes
   * @param node - Current content node
   */
  function traverse(node: JiraContentNode): void {
    if (!node) {
      return;
    }

    // Extract text from paragraph nodes
    if (node.type === JIRA_CONTENT_TYPES.PARAGRAPH && Array.isArray(node.content)) {
      const text = node.content
        .filter(child => child.type === JIRA_CONTENT_TYPES.TEXT)
        .map(child => child.text || '')
        .join('');

      if (text.trim()) {
        result.push(text.trim());
      }
    }

    // Recursively process child content
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  traverse(jiraContent);
  return result;
}

/**
 * Extracts all text content from JIRA description (not just paragraphs)
 * Useful for getting complete text without structure
 *
 * @param jiraContent - The JIRA content structure
 * @returns Complete text as a single string
 */
export function extractAllText(jiraContent: any): string {
  const textParts: string[] = [];

  function traverse(node: JiraContentNode): void {
    if (!node) {
      return;
    }

    // Collect text nodes
    if (node.type === JIRA_CONTENT_TYPES.TEXT && node.text) {
      textParts.push(node.text);
    }

    // Recursively process children
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  traverse(jiraContent);
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Formats JIRA description content to plain text with basic formatting
 * Preserves structure with line breaks
 *
 * @param jiraContent - The JIRA content structure
 * @returns Formatted text with line breaks
 */
export function formatDescriptionToText(jiraContent: any): string {
  const lines: string[] = [];

  function traverse(node: JiraContentNode, indent: number = 0): void {
    if (!node) {
      return;
    }

    const indentation = '  '.repeat(indent);

    switch (node.type) {
      case JIRA_CONTENT_TYPES.PARAGRAPH:
        if (Array.isArray(node.content)) {
          const text = node.content
            .filter(child => child.type === JIRA_CONTENT_TYPES.TEXT)
            .map(child => child.text || '')
            .join('');
          if (text.trim()) {
            lines.push(indentation + text.trim());
          }
        }
        break;

      case JIRA_CONTENT_TYPES.HEADING:
        if (Array.isArray(node.content)) {
          const text = node.content
            .map(child => child.text || '')
            .join('');
          if (text.trim()) {
            lines.push(`\n${indentation}## ${text.trim()}`);
          }
        }
        break;

      case JIRA_CONTENT_TYPES.LIST_ITEM:
        if (Array.isArray(node.content)) {
          node.content.forEach(child => traverse(child, indent));
        }
        break;

      case JIRA_CONTENT_TYPES.BULLET_LIST:
      case JIRA_CONTENT_TYPES.ORDERED_LIST:
        if (Array.isArray(node.content)) {
          node.content.forEach(child => traverse(child, indent + 1));
        }
        break;

      default:
        // Recursively process any children
        if (Array.isArray(node.content)) {
          node.content.forEach(child => traverse(child, indent));
        }
    }
  }

  traverse(jiraContent);
  return lines.join('\n');
}

/**
 * Checks if JIRA description content is empty or null
 *
 * @param jiraContent - The JIRA content structure
 * @returns True if content is empty
 */
export function isDescriptionEmpty(jiraContent: any): boolean {
  if (!jiraContent) {
    return true;
  }

  const text = extractAllText(jiraContent);
  return text.length === 0;
}

/**
 * Sanitizes text by removing problematic characters
 * Removes curly braces and other special characters that might cause issues
 *
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[{}]/g, '') // Remove curly braces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
