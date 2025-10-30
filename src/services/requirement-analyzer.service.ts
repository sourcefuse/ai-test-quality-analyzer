/**
 * Requirement Analyzer Service
 * Orchestrates JIRA and Confluence integration using Vector DB and LLM strategies
 * Follows SourceFuse design patterns with separation of concerns
 */

import {
  RequirementAnalysisRequestDto,
  RequirementAnalysisResponseDto,
  SyncConfluenceRequestDto,
  SyncConfluenceResponseDto,
  UpsertDocumentRequestDto,
  VectorSearchRequestDto,
  RequirementDetail,
  TechnicalDesignDocument,
} from '../dtos';
import {VectorDocument} from '../models';
import {JiraService} from './jira.service';
import {ConfluenceService} from './confluence.service';
import {VectorStoreService} from './vector-store.service';
import {OpenRouterAIService} from './openrouter-ai.service';
import {BedrockAIService} from './bedrock-ai.service';
import {ANALYSIS_PROMPTS, BEDROCK_ANALYSIS_PROMPTS} from '../constants';
import {stripHtmlTags} from '../utils';

/**
 * AI Service Type (supports both OpenRouter and Bedrock)
 */
export type AIService = OpenRouterAIService | BedrockAIService;

/**
 * Requirement Analyzer Service Class
 * Integrates JIRA, Confluence, Vector DB, and LLM for requirement analysis
 */
export class RequirementAnalyzerService {
  constructor(
    private readonly jiraService: JiraService,
    private readonly confluenceService: ConfluenceService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Get analysis prompts based on AI service type
   * @returns Appropriate prompts for the AI service
   */
  private getPrompts() {
    // Use Bedrock prompts if using Bedrock service, otherwise use general prompts
    return this.aiService instanceof BedrockAIService
      ? BEDROCK_ANALYSIS_PROMPTS
      : ANALYSIS_PROMPTS;
  }

  /**
   * Analyze requirements using selected strategy
   *
   * @param request - Analysis request
   * @returns Analysis response
   */
  async analyzeRequirements(
    request: RequirementAnalysisRequestDto,
  ): Promise<RequirementAnalysisResponseDto> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Starting Requirement Analysis`);
    console.log(`   Ticket: ${request.ticketId}`);
    console.log(`   Strategy: ${request.strategy}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Fetch JIRA ticket details
      const jiraDetails = await this.jiraService.getTicketDetails({
        ticketId: request.ticketId,
        projectKey: request.projectKey,
        includeSubTasks: true,
      });

      console.log(`✅ JIRA ticket fetched: ${jiraDetails.issue.key}`);
      console.log(`   Summary: ${jiraDetails.issue.fields.summary}`);

      // Step 2: Execute strategy-specific analysis
      let relatedDocuments: VectorDocument[] = [];

      const jiraContentText = jiraDetails.formattedText || '';

      switch (request.strategy) {
        case 'vector_db':
          relatedDocuments = await this.analyzeWithVectorDB(request, jiraContentText);
          break;

        case 'llm':
          relatedDocuments = await this.analyzeWithLLM(
            request,
            jiraContentText,
          );
          break;

        case 'hybrid':
          relatedDocuments = await this.analyzeWithHybrid(
            request,
            jiraContentText,
          );
          break;

        default:
          throw new Error(`Unknown strategy: ${request.strategy}`);
      }

      // Step 3: Extract requirements and TDD using LLM
      const confluenceContent = this.formatConfluenceContent(relatedDocuments);
      const requirements = await this.extractRequirements(
        jiraContentText,
        confluenceContent,
      );
      const technicalDesign = await this.extractTDD(confluenceContent, relatedDocuments);
      const implementationDetails = await this.generateImplementationGuidance(
        jiraContentText,
        confluenceContent,
      );

      // Step 4: Generate summary
      const summary = this.generateSummary(
        jiraDetails.issue,
        relatedDocuments,
        requirements,
      );

      console.log(`\n✅ Requirement Analysis Completed`);
      console.log(`   Related Documents: ${relatedDocuments.length}`);
      console.log(`   Requirements Found: ${requirements.length}`);
      console.log(`   TDD Found: ${technicalDesign ? 'Yes' : 'No'}`);

      return {
        ticketId: request.ticketId,
        ticketSummary: jiraDetails.issue.fields.summary,
        strategy: request.strategy,
        relatedDocuments,
        requirements,
        technicalDesign,
        implementationDetails,
        summary,
      };
    } catch (error) {
      console.error('❌ Error analyzing requirements:', error);
      throw error;
    }
  }

  /**
   * Analyze using Vector DB strategy
   * Searches vector store for similar documents
   */
  private async analyzeWithVectorDB(
    request: RequirementAnalysisRequestDto,
    jiraContent: string,
  ): Promise<VectorDocument[]> {
    console.log(`\n📊 Using Vector DB Strategy`);

    // Generate embedding for JIRA content
    const embedding = await this.aiService.generateEmbedding({
      text: jiraContent,
    });

    // Search vector store
    const searchRequest: VectorSearchRequestDto = {
      query: jiraContent,
      limit: request.maxVectorResults || 10,
      minScore: request.minSimilarityScore || 0.7,
      filter: {
        spaceKey: request.confluenceSpaceKey,
      },
    };

    const searchResults = await this.vectorStoreService.search(
      searchRequest,
      embedding.embedding,
    );

    console.log(`✅ Vector search completed: ${searchResults.results.length} results`);

    return searchResults.results;
  }

  /**
   * Analyze using LLM strategy
   * Fetches all Confluence pages and uses LLM to find relevant ones
   */
  private async analyzeWithLLM(
    request: RequirementAnalysisRequestDto,
    jiraContent: string,
  ): Promise<VectorDocument[]> {
    console.log(`\n🤖 Using LLM Strategy`);

    // Fetch Confluence pages
    const pagesResponse = await this.confluenceService.listPages({
      spaceKey: request.confluenceSpaceKey,
      maxPages: request.maxConfluencePages || 50,
      expand: ['body.storage'],
    });

    console.log(`   Fetched ${pagesResponse.pages.length} Confluence pages`);

    // Convert to vector documents (filter out pages without IDs)
    const documents: VectorDocument[] = pagesResponse.pages
      .filter(page => page.id) // Only include pages with valid IDs
      .map(page => ({
        id: page.id!,
        content: stripHtmlTags(page.body?.storage?.value || ''),
        metadata: {
          source: 'confluence',
          sourceId: page.id!,
          title: page.title,
          spaceKey: request.confluenceSpaceKey,
          type: page.type,
        },
      }));

    // Use LLM to score relevance for each document
    const scoredDocuments = await this.scoreDocumentsWithLLM(
      jiraContent,
      documents,
    );

    // Filter by minimum score and return top results
    const maxResults = request.maxVectorResults || 10;
    const minScore = request.minSimilarityScore || 0.7;

    const relevant = scoredDocuments
      .filter(doc => (doc.score || 0) >= minScore)
      .slice(0, maxResults);

    console.log(`✅ LLM analysis completed: ${relevant.length} relevant documents`);

    return relevant;
  }

  /**
   * Analyze using Hybrid strategy
   * Combines Vector DB and LLM approaches
   */
  private async analyzeWithHybrid(
    request: RequirementAnalysisRequestDto,
    jiraContent: string,
  ): Promise<VectorDocument[]> {
    console.log(`\n🔀 Using Hybrid Strategy`);

    // Step 1: Get initial candidates from Vector DB
    const vectorResults = await this.analyzeWithVectorDB(request, jiraContent);
    console.log(`   Vector DB returned ${vectorResults.length} candidates`);

    // Step 2: Re-rank using LLM
    const reranked = await this.scoreDocumentsWithLLM(
      jiraContent,
      vectorResults,
    );

    // Step 3: Sort by LLM score and return
    const sorted = reranked.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`✅ Hybrid analysis completed: ${sorted.length} documents`);

    return sorted;
  }

  /**
   * Score documents using LLM for relevance
   */
  private async scoreDocumentsWithLLM(
    jiraContent: string,
    documents: VectorDocument[],
  ): Promise<VectorDocument[]> {
    console.log(`   Scoring ${documents.length} documents with LLM...`);

    const scoredDocuments: VectorDocument[] = [];

    for (const doc of documents) {
      try {
        const prompt = `${ANALYSIS_PROMPTS.RELEVANCE_SCORING}

JIRA Ticket:
${jiraContent}

Confluence Page Title: ${doc.metadata.title}
Confluence Page Content (first 1000 chars):
${doc.content.substring(0, 1000)}`;

        const result = await this.aiService.chatCompletion({
          system: this.getPrompts().RELEVANCE_SCORING,
          messages: [
            {role: 'user', content: prompt},
          ],
          temperature: 0.3, // Lower temperature for consistent scoring
        } as any);

        // Parse JSON response
        const scoreData = JSON.parse(result.response);
        doc.score = scoreData.relevanceScore;

        scoredDocuments.push(doc);
      } catch (error) {
        console.warn(`   Warning: Failed to score document ${doc.id}`);
        doc.score = 0.5; // Default score
        scoredDocuments.push(doc);
      }
    }

    return scoredDocuments;
  }

  /**
   * Extract requirements from content using LLM
   */
  private async extractRequirements(
    jiraContent: string,
    confluenceContent: string,
  ): Promise<RequirementDetail[]> {
    console.log(`\n📋 Extracting requirements...`);

    try {
      const result = await this.aiService.analyzeContent(
        jiraContent,
        confluenceContent,
        this.getPrompts().REQUIREMENT_EXTRACTION,
      );

      const parsed = JSON.parse(result);
      console.log(`✅ Extracted ${parsed.requirements.length} requirements`);

      return parsed.requirements;
    } catch (error) {
      console.error('❌ Error extracting requirements:', error);
      return [];
    }
  }

  /**
   * Extract Technical Design Document from Confluence content
   */
  private async extractTDD(
    confluenceContent: string,
    documents: VectorDocument[],
  ): Promise<TechnicalDesignDocument | undefined> {
    console.log(`\n📐 Extracting Technical Design Document...`);

    try {
      // Find document most likely to be TDD
      const tddDoc = documents.find(
        doc =>
          doc.metadata.title.toLowerCase().includes('tdd') ||
          doc.metadata.title.toLowerCase().includes('technical design') ||
          doc.metadata.title.toLowerCase().includes('design document'),
      );

      if (!tddDoc) {
        console.log(`   No TDD document found`);
        return undefined;
      }

      const result = await this.aiService.chatCompletion({
        system: this.getPrompts().TDD_EXTRACTION,
        messages: [
          {role: 'user', content: tddDoc.content},
        ],
      } as any);

      const parsed = JSON.parse(result.response);
      console.log(`✅ TDD extracted from: ${tddDoc.metadata.title}`);

      return {
        title: tddDoc.metadata.title,
        pageId: tddDoc.id,
        ...parsed,
      };
    } catch (error) {
      console.error('❌ Error extracting TDD:', error);
      return undefined;
    }
  }

  /**
   * Generate implementation guidance
   */
  private async generateImplementationGuidance(
    jiraContent: string,
    confluenceContent: string,
  ): Promise<string> {
    console.log(`\n💡 Generating implementation guidance...`);

    try {
      const result = await this.aiService.analyzeContent(
        jiraContent,
        confluenceContent,
        this.getPrompts().IMPLEMENTATION_ANALYSIS,
      );

      console.log(`✅ Implementation guidance generated`);
      return result;
    } catch (error) {
      console.error('❌ Error generating implementation guidance:', error);
      return 'No implementation guidance available';
    }
  }

  /**
   * Sync Confluence space to Vector DB
   *
   * @param request - Sync request
   * @returns Sync response
   */
  async syncConfluenceToVectorDB(
    request: SyncConfluenceRequestDto,
  ): Promise<SyncConfluenceResponseDto> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Syncing Confluence to Vector DB`);
    console.log(`   Space: ${request.spaceKey}`);
    console.log(`${'='.repeat(60)}\n`);

    const errors: string[] = [];
    let pagesSynced = 0;
    let pagesSkipped = 0;
    let documentsCreated = 0;

    try {
      // Delete existing if force resync
      if (request.forceResync) {
        console.log(`🗑️  Force resync: Deleting existing documents...`);
        await this.vectorStoreService.deleteByFilter({
          spaceKey: request.spaceKey,
        });
      }

      // Fetch Confluence pages
      const pagesResponse = await this.confluenceService.listPages({
        spaceKey: request.spaceKey,
        maxPages: request.maxPages,
        expand: ['body.storage'],
      });

      console.log(`📚 Fetched ${pagesResponse.pages.length} pages`);

      // Process pages in batches
      const batchSize = 10;
      for (let i = 0; i < pagesResponse.pages.length; i += batchSize) {
        const batch = pagesResponse.pages.slice(i, i + batchSize);
        const upsertRequests: UpsertDocumentRequestDto[] = [];
        const texts: string[] = [];

        for (const page of batch) {
          // Skip project-specific pages if needed
          if (
            request.projectKey &&
            page.title
              .toLowerCase()
              .startsWith(request.projectKey.toLowerCase() + '-')
          ) {
            pagesSkipped++;
            continue;
          }

          const content = stripHtmlTags(page.body?.storage?.value || '');
          if (!content.trim()) {
            pagesSkipped++;
            continue;
          }

          // Skip pages without IDs
          if (!page.id) {
            pagesSkipped++;
            continue;
          }

          upsertRequests.push({
            id: page.id,
            content,
            metadata: {
              source: 'confluence',
              sourceId: page.id,
              title: page.title,
              spaceKey: request.spaceKey,
              type: page.type,
              modifiedAt: page.version?.when,
            },
          });

          texts.push(content);
        }

        if (upsertRequests.length > 0) {
          try {
            // Generate embeddings
            const embeddings = await this.aiService.generateEmbeddings(texts);

            // Upsert to vector store
            await this.vectorStoreService.upsertBatch(
              upsertRequests,
              embeddings,
            );

            pagesSynced += upsertRequests.length;
            documentsCreated += upsertRequests.length;

            console.log(`   Processed batch ${i / batchSize + 1}: ${upsertRequests.length} pages`);
          } catch (error: any) {
            errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
          }
        }
      }

      const duration = Date.now() - startTime;

      console.log(`\n✅ Sync completed in ${duration}ms`);
      console.log(`   Pages synced: ${pagesSynced}`);
      console.log(`   Pages skipped: ${pagesSkipped}`);
      console.log(`   Documents created: ${documentsCreated}`);

      return {
        pagesSynced,
        documentsCreated,
        pagesSkipped,
        errors,
        duration,
      };
    } catch (error: any) {
      console.error('❌ Error syncing Confluence:', error);
      throw error;
    }
  }

  /**
   * Format Confluence documents for LLM context
   */
  private formatConfluenceContent(documents: VectorDocument[]): string {
    return documents
      .map(
        (doc, index) => `
## Document ${index + 1}: ${doc.metadata.title}
**Source**: Confluence Page ID ${doc.id}
**Relevance Score**: ${doc.score ? doc.score.toFixed(2) : 'N/A'}

${doc.content.substring(0, 2000)}${doc.content.length > 2000 ? '...' : ''}
`,
      )
      .join('\n---\n');
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(
    jiraIssue: any,
    relatedDocs: VectorDocument[],
    requirements: RequirementDetail[],
  ): string {
    return `
Analysis Summary for ${jiraIssue.key}:
- JIRA Summary: ${jiraIssue.fields.summary}
- Related Confluence Documents: ${relatedDocs.length}
- Requirements Identified: ${requirements.length}
- Functional Requirements: ${requirements.filter(r => r.type === 'functional').length}
- Non-Functional Requirements: ${requirements.filter(r => r.type === 'non-functional').length}
- Technical Requirements: ${requirements.filter(r => r.type === 'technical').length}
`.trim();
  }
}
