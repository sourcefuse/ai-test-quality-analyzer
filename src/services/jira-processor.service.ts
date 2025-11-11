/**
 * JIRA Processor Service
 * Service class for processing JIRA tickets and finding related Confluence documents
 * Follows SourceFuse design patterns with separation of concerns
 */

import {JiraService} from './jira.service';
import {ConfluenceService} from './confluence.service';
import {EmbeddingService} from './embedding.service';
import {PostgresVectorService, SearchResult} from './postgres-vector.service';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

export interface JiraTicketResult {
  ticketKey: string;
  ticketTitle: string;
  ticketDescription: string;
  ticketType: string;
  ticketStatus: string;
  ticketUrl: string;
  relatedDocuments: Array<{
    title: string;
    url: string;
    similarity: number;
    excerpt: string;
  }>;
  timestamp: string;
}

/**
 * JIRA Processor Service Class
 * Processes JIRA tickets and finds related Confluence documentation
 */
export class JiraProcessorService {
  private readonly jiraService: JiraService;
  private readonly confluenceService: ConfluenceService;
  private readonly embeddingService: EmbeddingService;
  private readonly vectorService: PostgresVectorService;

  /**
   * Constructor
   * @param jiraService - JIRA service instance
   * @param confluenceService - Confluence service instance
   * @param embeddingService - Embedding service instance
   * @param vectorService - PostgreSQL vector service instance
   */
  constructor(
    jiraService: JiraService,
    confluenceService: ConfluenceService,
    embeddingService: EmbeddingService,
    vectorService: PostgresVectorService,
  ) {
    this.jiraService = jiraService;
    this.confluenceService = confluenceService;
    this.embeddingService = embeddingService;
    this.vectorService = vectorService;
  }

  /**
   * Extract plain text from JIRA ADF (Atlassian Document Format)
   * @param adf - ADF object or string
   * @returns Plain text
   */
  private extractTextFromADF(adf: any): string {
    if (!adf) return '';
    if (typeof adf === 'string') return adf;

    let text = '';

    const traverse = (node: any) => {
      if (!node) return;

      // Extract text content
      if (node.text) {
        text += node.text + ' ';
      }

      // Traverse content array
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach((child: any) => traverse(child));
      }

      // Add line breaks for paragraphs
      if (node.type === 'paragraph') {
        text += '\n';
      }
    };

    traverse(adf);
    return text.trim();
  }

  /**
   * Get full document content from Confluence by page ID (plain text)
   * @param pageId - Confluence page ID
   * @returns Plain text content
   */
  private async getFullDocumentContentFromConfluence(
    pageId: string,
  ): Promise<{content: string} | null> {
    try {
      // Access the internal Confluence client to fetch page by ID
      const client = (this.confluenceService as any).client;

      const response = await client.content.getContentById({
        id: pageId,
        expand: ['body.view', 'body.storage'],
      });

      if (!response) {
        return null;
      }

      let plainContent = '';

      // Use body.view (rendered HTML) and strip tags
      if (response.body?.view?.value) {
        const $ = cheerio.load(response.body.view.value);
        plainContent = $.text();
      } else if (response.body?.storage?.value) {
        // Fallback to storage format and strip HTML
        const $ = cheerio.load(response.body.storage.value);
        plainContent = $.text();
      }

      return {content: plainContent};
    } catch (error) {
      console.error(`Error fetching Confluence page ${pageId}:`, error);
      return null;
    }
  }

  /**
   * Format code blocks in text content
   * @param text - Text content
   * @returns Formatted text with code blocks
   */
  private formatCodeBlocks(text: string): string {
    const lines = text.split('\n');
    let formatted = '';
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect code patterns (lines with common code characters)
      const isCodeLine = /^[\s]*[{}\[\]();:=<>]|^\s*(const|let|var|function|class|export|import|interface|type|async|await|return|if|else|for|while)\s/.test(
        line,
      );

      if (isCodeLine && !inCodeBlock) {
        formatted += '\n```\n';
        inCodeBlock = true;
      } else if (!isCodeLine && inCodeBlock && line.length > 0) {
        formatted += '```\n\n';
        inCodeBlock = false;
      }

      formatted += lines[i] + '\n';
    }

    if (inCodeBlock) {
      formatted += '```\n';
    }

    return formatted;
  }

  /**
   * Format result as readable text
   * @param result - JIRA ticket result
   * @returns Formatted text
   */
  private formatResultAsText(result: JiraTicketResult): string {
    let text = '';

    text += '═'.repeat(80) + '\n';
    text += `JIRA TICKET ANALYSIS\n`;
    text += '═'.repeat(80) + '\n\n';

    text += `📋 TICKET DETAILS\n`;
    text += '─'.repeat(80) + '\n';
    text += `Key:         ${result.ticketKey}\n`;
    text += `Title:       ${result.ticketTitle}\n`;
    text += `Type:        ${result.ticketType}\n`;
    text += `Status:      ${result.ticketStatus}\n`;
    text += `URL:         ${result.ticketUrl}\n`;
    text += `\nDescription:\n${result.ticketDescription || 'No description'}\n\n`;

    // Get unique URLs
    const uniqueUrls = Array.from(
      new Set(result.relatedDocuments.map(doc => doc.url)),
    );

    text += '═'.repeat(80) + '\n';
    text += `📚 RELATED CONFLUENCE DOCUMENTS (${uniqueUrls.length} unique)\n`;
    text += '═'.repeat(80) + '\n\n';

    if (uniqueUrls.length === 0) {
      text += 'No related documents found.\n';
    } else {
      text += `🔗 DOCUMENT URLS:\n`;
      text += '─'.repeat(80) + '\n';
      uniqueUrls.forEach((url, index) => {
        text += `${index + 1}. ${url}\n`;
      });

      text += '\n';
      text += '═'.repeat(80) + '\n';
      text += `📄 FULL DOCUMENT CONTENTS\n`;
      text += '═'.repeat(80) + '\n\n';

      // Group documents by URL and get all content
      const documentsByUrl = new Map<string, any[]>();
      result.relatedDocuments.forEach(doc => {
        if (!documentsByUrl.has(doc.url)) {
          documentsByUrl.set(doc.url, []);
        }
        documentsByUrl.get(doc.url)!.push(doc);
      });

      uniqueUrls.forEach((url, index) => {
        const docs = documentsByUrl.get(url) || [];
        const firstDoc = docs[0];

        text += `\n${index + 1}. ${firstDoc.title}\n`;
        text += '─'.repeat(80) + '\n';
        text += `URL: ${url}\n`;
        text += `Similarity: ${(firstDoc.similarity * 100).toFixed(2)}%\n`;
        text += '\n';

        // Use full document content with code formatting
        text += `CONTENT:\n`;
        text += '─'.repeat(80) + '\n';
        text += this.formatCodeBlocks(firstDoc.excerpt) + '\n\n';
      });
    }

    text += '═'.repeat(80) + '\n';
    text += `Generated: ${result.timestamp}\n`;
    text += '═'.repeat(80) + '\n';

    return text;
  }

  /**
   * Process a JIRA ticket and find related Confluence documents
   * @param ticketKey - JIRA ticket key (e.g., 'BB-12345')
   * @param topK - Number of related documents to find
   * @returns JiraTicketResult with related documents
   */
  async processTicket(
    ticketKey: string,
    topK: number = 5,
  ): Promise<JiraTicketResult> {
    console.log(`\n🎫 Processing JIRA ticket: ${ticketKey}`);

    // 1. Fetch JIRA ticket details
    console.log('🔄 Fetching ticket details from JIRA...');
    const issue = await this.jiraService.getIssueByKey(ticketKey);

    console.log(`✅ Fetched: ${issue.fields.summary}`);
    console.log(`   Type: ${issue.fields.issuetype?.name || 'Unknown'}`);
    console.log(`   Status: ${issue.fields.status?.name || 'Unknown'}`);

    // 2. Create search query from ticket
    const description = this.extractTextFromADF(issue.fields.description);
    const queryText = `${issue.fields.summary} ${description}`;
    console.log('\n🔄 Generating embedding for search query...');
    const queryEmbedding = await this.embeddingService.generateEmbedding(queryText);
    console.log('✅ Query embedding generated');

    // 3. Search for similar documents
    console.log(`\n🔍 Searching for top ${topK} related documents...`);
    const similarDocs = await this.vectorService.searchSimilar(queryEmbedding, topK);
    console.log(`✅ Found ${similarDocs.length} related documents`);

    // 4. Get unique page IDs and fetch full content from Confluence
    console.log('\n🔄 Fetching full document content from Confluence...');
    const uniquePageIds = Array.from(
      new Set(similarDocs.map(doc => doc.pageId)),
    );

    const documentsMap = new Map<string, {content: string}>();
    for (const pageId of uniquePageIds) {
      const fullDoc = await this.getFullDocumentContentFromConfluence(pageId);
      if (fullDoc) {
        // Map by pageId for lookup
        documentsMap.set(pageId, fullDoc);
      }
    }
    console.log(`✅ Fetched ${documentsMap.size} full documents from Confluence`);

    // 5. Format results with full content
    const result: JiraTicketResult = {
      ticketKey: issue.key,
      ticketTitle: issue.fields.summary,
      ticketDescription: description,
      ticketType: issue.fields.issuetype?.name || 'Unknown',
      ticketStatus: issue.fields.status?.name || 'Unknown',
      ticketUrl: `${this.jiraService['config'].url}/browse/${issue.key}`,
      relatedDocuments: similarDocs.map(doc => {
        const fullDoc = documentsMap.get(doc.pageId);
        return {
          title: doc.pageTitle,
          url: doc.pageUrl,
          similarity: doc.similarity,
          excerpt: fullDoc?.content || doc.text.substring(0, 200) + '...',
        };
      }),
      timestamp: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Save results to a text file
   * @param result - JiraTicketResult to save
   * @param outputDir - Directory to save the file (default: ./output)
   * @returns File path
   */
  async saveToFile(
    result: JiraTicketResult,
    outputDir: string = './output',
  ): Promise<string> {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, {recursive: true});
    }

    // Generate filename
    const filename = `${result.ticketKey.replace('/', '-')}_${Date.now()}.txt`;
    const filePath = path.join(outputDir, filename);

    // Format content
    const content = this.formatResultAsText(result);

    // Write to file
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`\n💾 Results saved to: ${filePath}`);

    return filePath;
  }
}
