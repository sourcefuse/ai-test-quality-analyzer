/**
 * Confluence Indexer Service
 * Service class for indexing Confluence documents into vector database
 * Follows SourceFuse design patterns with separation of concerns
 */

import {ConfluenceService} from './confluence.service';
import {EmbeddingService} from './embedding.service';
import {PostgresVectorService} from './postgres-vector.service';
import {HybridPIIDetectorService} from './hybrid-pii-detector.service';
import * as cheerio from 'cheerio';

export interface IndexStats {
  spaceKey: string;
  totalPages: number;
  totalChunks: number;
  processingTime: number;
  errors: string[];
}

export interface TextChunk {
  text: string;
  metadata: {
    pageId: string;
    pageTitle: string;
    chunkIndex: number;
  };
}

/**
 * Confluence Indexer Service Class
 * Handles indexing of Confluence documents into PostgreSQL vector database
 */
export class ConfluenceIndexerService {
  private readonly confluenceService: ConfluenceService;
  private readonly embeddingService: EmbeddingService;
  private readonly vectorService: PostgresVectorService;
  private readonly piiDetector?: HybridPIIDetectorService;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  /**
   * Constructor
   * @param confluenceService - Confluence service instance
   * @param embeddingService - Embedding service instance
   * @param vectorService - PostgreSQL vector service instance
   * @param chunkSize - Size of text chunks (default: 1000)
   * @param chunkOverlap - Overlap between chunks (default: 200)
   * @param piiDetector - Optional PII detector for sanitizing data before storage
   */
  constructor(
    confluenceService: ConfluenceService,
    embeddingService: EmbeddingService,
    vectorService: PostgresVectorService,
    chunkSize: number = 1000,
    chunkOverlap: number = 200,
    piiDetector?: HybridPIIDetectorService,
  ) {
    this.confluenceService = confluenceService;
    this.embeddingService = embeddingService;
    this.vectorService = vectorService;
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.piiDetector = piiDetector;
  }

  /**
   * Strip HTML tags from content
   * @param html - HTML content
   * @returns Plain text
   */
  private stripHtml(html: string): string {
    const $ = cheerio.load(html);
    return $.text();
  }

  /**
   * Process text into chunks
   * @param text - Text to chunk
   * @param pageId - Page ID
   * @param pageTitle - Page title
   * @returns Array of text chunks
   */
  private chunkText(text: string, pageId: string, pageTitle: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();

    if (cleanText.length === 0) {
      return chunks;
    }

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < cleanText.length) {
      const endIndex = Math.min(startIndex + this.chunkSize, cleanText.length);
      const chunkText = cleanText.substring(startIndex, endIndex);

      chunks.push({
        text: chunkText,
        metadata: {
          pageId,
          pageTitle,
          chunkIndex,
        },
      });

      chunkIndex++;
      startIndex += this.chunkSize - this.chunkOverlap;
    }

    return chunks;
  }

  /**
   * Process a batch of pages: chunk, embed, and save to DB
   * @param pages - Array of Confluence pages
   * @param stats - Index statistics object
   */
  private async processBatch(pages: any[], stats: IndexStats): Promise<void> {
    // 1. Apply PII detection if enabled
    if (this.piiDetector) {
      console.log('   🔒 Applying PII detection...');
      for (const page of pages) {
        if (page.content) {
          const piiResult = await this.piiDetector.detectAndRedact(page.content);
          if (piiResult.hasPII) {
            page.content = piiResult.redactedText;
            console.log(`      🔒 ${page.title}: PII redacted via ${piiResult.method}`);
          }
        }
      }
      console.log('   ✅ PII detection complete');
    }

    // 2. Chunk all pages in batch
    console.log('   🔄 Chunking text...');
    const allChunks: TextChunk[] = [];

    for (const page of pages) {
      const chunks = this.chunkText(page.content, page.id, page.title);
      allChunks.push(...chunks);
    }

    console.log(`   ✅ Created ${allChunks.length} chunks`);

    // 3. Generate embeddings for all chunks in batch (parallel)
    console.log('   🔄 Generating embeddings...');
    const embeddings = await this.embeddingService.batchGenerateEmbeddings(
      allChunks.map(c => c.text),
    );
    console.log(`   ✅ Generated ${embeddings.length} embeddings`);

    // 4. Save to database
    console.log('   🔄 Saving to database...');
    for (let i = 0; i < pages.length; i++) {
      try {
        const page = pages[i];
        const pageChunks = allChunks.filter(
          c => c.metadata.pageId === page.id,
        );

        if (pageChunks.length === 0) {
          console.log(`   ⚠️  No chunks for: ${page.title}`);
          continue;
        }

        // Find embeddings for this page
        const startIdx = allChunks.findIndex(
          c => c.metadata.pageId === page.id,
        );
        const pageEmbeddings = embeddings.slice(
          startIdx,
          startIdx + pageChunks.length,
        );

        // Strip HTML from content before saving
        const cleanContent = this.stripHtml(page.content);

        // Upsert document
        const documentId = await this.vectorService.upsertDocument(
          page.id,
          page.title,
          cleanContent,
          page.url || '',
        );

        // Prepare chunks with embeddings
        const chunksWithEmbeddings = pageChunks.map((chunk, idx) => ({
          text: chunk.text,
          embedding: pageEmbeddings[idx],
          metadata: chunk.metadata,
        }));

        // Upsert chunks
        await this.vectorService.upsertChunks(documentId, chunksWithEmbeddings);

        stats.totalChunks += pageChunks.length;
      } catch (error) {
        const errorMsg = `Failed to process page ${pages[i].title}: ${error}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // Log summary after all pages saved
    const savedPages = pages.length - stats.errors.length;
    console.log(`   ✅ Saved ${savedPages} pages (${stats.totalChunks} chunks) to database`);
  }

  /**
   * Index a Confluence space
   * @param spaceKey - Confluence space key
   * @param batchSize - Number of pages to process in each batch
   * @returns Index statistics
   */
  async indexSpace(spaceKey: string, batchSize: number = 10): Promise<IndexStats> {
    const startTime = Date.now();
    const stats: IndexStats = {
      spaceKey,
      totalPages: 0,
      totalChunks: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      console.log(`\n📚 Fetching pages from Confluence space: ${spaceKey}`);

      // Get all pages from space using existing Confluence service
      const result = await this.confluenceService.listPages({
        spaceKey,
        expand: ['body.storage'],
      });

      const pages = result.pages.map((p: any) => ({
        id: p.id,
        title: p.title,
        content: p.body?.storage?.value || '',
        url: p._links?.webui ? `${this.confluenceService['config'].host}${p._links.webui}` : '',
      }));

      const totalPages = pages.length;
      console.log(`✅ Fetched ${totalPages} pages from space ${spaceKey}\n`);

      if (totalPages === 0) {
        console.log(
          `⚠️  No pages found in space ${spaceKey}. Please check the space key.`,
        );
        return stats;
      }

      // Process in batches to save incrementally
      console.log(
        `🔄 Processing ${totalPages} pages in batches of ${batchSize}...\n`,
      );

      for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalPages);
        const batchPages = pages.slice(batchStart, batchEnd);
        const batchNum = Math.floor(batchStart / batchSize) + 1;
        const totalBatches = Math.ceil(totalPages / batchSize);

        console.log(
          `\n📦 Batch ${batchNum}/${totalBatches} - Processing pages ${batchStart + 1} to ${batchEnd}`,
        );

        try {
          // Process this batch
          await this.processBatch(batchPages, stats);
        } catch (error) {
          console.error(`❌ Error processing batch ${batchNum}:`, error);
          stats.errors.push(`Batch ${batchNum} failed: ${error}`);
        }

        // Show progress
        stats.totalPages = batchEnd;
        const elapsed = (Date.now() - startTime) / 1000;
        const pagesPerSecond = stats.totalPages / elapsed;
        const remainingPages = totalPages - stats.totalPages;
        const estimatedTimeRemaining = remainingPages / pagesPerSecond;

        console.log(`\n📊 Progress:`);
        console.log(`   Pages: ${stats.totalPages}/${totalPages}`);
        console.log(`   Chunks: ${stats.totalChunks}`);
        console.log(`   Speed: ${pagesPerSecond.toFixed(2)} pages/sec`);
        console.log(
          `   Estimated time remaining: ${Math.ceil(estimatedTimeRemaining)}s`,
        );
      }

      stats.processingTime = Date.now() - startTime;

      console.log('\n✅ Indexing complete!');
      console.log(`   Space: ${spaceKey}`);
      console.log(`   Pages processed: ${stats.totalPages}`);
      console.log(`   Total chunks: ${stats.totalChunks}`);
      console.log(`   Processing time: ${(stats.processingTime / 1000).toFixed(2)}s`);
      console.log(`   Errors: ${stats.errors.length}`);

      if (stats.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        stats.errors.forEach((err, idx) => {
          console.log(`   ${idx + 1}. ${err}`);
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ Error during indexing:', error);
      stats.errors.push(`Indexing failed: ${error}`);
      stats.processingTime = Date.now() - startTime;
      throw error;
    }
  }
}
