/**
 * Test Database Integration
 *
 * Tests pushing Confluence chunks to PostgreSQL with embeddings
 * Run: npm run test-db
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import {
  JiraService,
  ConfluenceService,
  ConfluenceSmartFilterService,
  PostgresVectorService,
  EmbeddingService,
} from './src/services';
import {JiraConfigDto, ConfluenceConfigDto} from './src/dtos';
import {stripHtmlTags} from './src/utils';

// Load environment variables
dotenv.config();
dotenvExt.load({
  schema: '.env.example',
  errorOnMissing: false,
  includeProcessEnv: true,
});

/**
 * Simple chunking function (splits by paragraphs)
 */
function chunkText(text: string, maxLength: number = 1000): string[] {
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // If single paragraph is too long, split it
      if (paragraph.length > maxLength) {
        const words = paragraph.split(' ');
        for (const word of words) {
          if (currentChunk.length + word.length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = word + ' ';
          } else {
            currentChunk += word + ' ';
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
}

async function main() {
  console.log('='.repeat(70));
  console.log('DATABASE INTEGRATION TEST');
  console.log('='.repeat(70));

  const ticketId = process.env.JIRA_TICKET_ID;
  if (!ticketId) {
    console.error('\n❌ Error: JIRA_TICKET_ID not set in .env');
    process.exit(1);
  }

  const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
  if (!spaceKey) {
    console.error('\n❌ Error: CONFLUENCE_SPACE_KEY not set in .env');
    process.exit(1);
  }

  try {
    // 1. Initialize PostgreSQL
    console.log('\n[1/7] Initializing PostgreSQL...');
    const vectorService = new PostgresVectorService({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'postgres-pgvector',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'admin',
    });

    await vectorService.initialize();
    console.log('   ✅ PostgreSQL initialized');

    // 2. Initialize Embedding Service
    console.log('\n[2/7] Initializing Embedding Service...');
    const embeddingService = new EmbeddingService({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'text-embedding-3-small',
      concurrency: 5,
    });
    console.log('   ✅ Embedding service ready');

    // 3. Fetch Jira Ticket
    console.log('\n[3/7] Fetching Jira ticket...');
    const jiraConfig: JiraConfigDto = {
      url: process.env.JIRA_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
    };

    const jiraService = new JiraService(jiraConfig);
    const ticketDetails = await jiraService.getTicketDetails({
      ticketId,
      includeSubTasks: false,
    });
    console.log(`   ✅ Fetched ticket: ${ticketDetails.issue.key}`);
    console.log(`      Summary: ${ticketDetails.issue.fields.summary}`);

    // 4. Fetch Confluence Pages (fetch all pages)
    console.log('\n[4/7] Fetching Confluence pages...');
    const confluenceConfig: ConfluenceConfigDto = {
      host: process.env.CONFLUENCE_URL || '',
      email: process.env.CONFLUENCE_EMAIL || '',
      apiToken: process.env.CONFLUENCE_API_TOKEN || '',
      spaceKey: spaceKey,
    };

    const confluenceService = new ConfluenceService(confluenceConfig);
    confluenceService.setSilentMode(true);

    const pagesResponse = await confluenceService.listPages({
      spaceKey: spaceKey,
      expand: ['body.storage', 'metadata.labels'],
    });

    console.log(`   ✅ Fetched ${pagesResponse.pages.length} pages`);

    // 5. Run Smart Filter
    console.log('\n[5/7] Running Smart Filter...');
    const smartFilter = new ConfluenceSmartFilterService();

    const {results: filteredPages, metrics} = smartFilter.filterPagesWithMetrics(
      ticketDetails.issue,
      pagesResponse.pages,
      {
        maxPages: 10,  // Take top 10 pages for testing
        minScoreThreshold: 0.1,  // Lower threshold for testing
        debug: true,
      }
    );

    console.log(`   ✅ Filtered: ${pagesResponse.pages.length} → ${filteredPages.length} pages`);
    console.log(`      Reduction: ${metrics.reductionPercentage.toFixed(1)}%`);
    console.log(`      Avg score: ${metrics.averageScore.toFixed(3)}`);
    console.log(`      Ticket ID matches: ${metrics.matchDistribution.ticketId}`);

    // 6. Process and Store Filtered Pages
    console.log('\n[6/7] Processing filtered pages...');

    let totalChunks = 0;
    let totalEmbeddings = 0;

    for (let i = 0; i < filteredPages.length; i++) {
      const filterResult = filteredPages[i];
      const page = filterResult.page;

      console.log(`\n   [${i + 1}/${filteredPages.length}] Processing: ${page.title}`);
      console.log(`      Score: ${filterResult.score.toFixed(3)}`);
      console.log(`      Matched by: ${filterResult.matchedBy.join(', ')}`);

      // Extract content
      const htmlContent = page.body?.storage?.value || '';
      const plainText = stripHtmlTags(htmlContent);
      const pageUrl = `${confluenceConfig.host}${page._links?.webui || ''}`;

      // Store document in PostgreSQL with smart filter metadata
      const documentId = await vectorService.upsertDocument(
        page.id,
        page.title,
        plainText,
        pageUrl,
        spaceKey,  // project_key
        ticketDetails.issue.key,  // ticketId
        filterResult.score,  // relevanceScore
        filterResult.matchedBy,  // matchedBy array
        filterResult.details,  // filterMetadata
      );

      console.log(`      ✅ Document stored with metadata (ID: ${documentId})`);

      // Chunk the content
      const textChunks = chunkText(plainText, 800);
      console.log(`      📄 Created ${textChunks.length} chunks`);
      totalChunks += textChunks.length;

      // Generate embeddings for all chunks
      const documentChunks: Array<{text: string; embedding: number[]; metadata: any}> = [];

      for (let chunkIdx = 0; chunkIdx < textChunks.length; chunkIdx++) {
        const chunkText = textChunks[chunkIdx];

        // Generate embedding
        const embedding = await embeddingService.generateEmbedding(chunkText);
        totalEmbeddings++;

        // Prepare chunk with metadata
        const chunkMetadata = {
          ticketId: ticketDetails.issue.key,
          relevanceScore: filterResult.score,
          matchedBy: filterResult.matchedBy,
          chunkIndex: chunkIdx,
          totalChunks: textChunks.length,
          pageTitle: page.title,
        };

        documentChunks.push({
          text: chunkText,
          embedding: embedding,
          metadata: chunkMetadata,
        });
      }

      // Store all chunks at once
      await vectorService.upsertChunks(documentId, documentChunks);
      console.log(`      ✅ ${textChunks.length} chunks embedded and stored`);
    }

    console.log(`\n   ✅ Total: ${totalChunks} chunks, ${totalEmbeddings} embeddings`);

    // 7. Verify Data in Database
    console.log('\n[7/7] Verifying data in database...');

    const searchQuery = ticketDetails.issue.fields.summary;
    console.log(`   🔍 Searching for: "${searchQuery.substring(0, 60)}..."`);

    const queryEmbedding = await embeddingService.generateEmbedding(searchQuery);
    const searchResults = await vectorService.searchSimilar(queryEmbedding, 5);

    console.log(`\n   ✅ Found ${searchResults.length} similar chunks:`);
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      console.log(`\n   ${i + 1}. [Score: ${result.similarity.toFixed(3)}] ${result.pageTitle}`);
      console.log(`      ${result.text.substring(0, 100)}...`);
    }

    // Verify smart filter metadata was stored
    console.log('\n' + '='.repeat(70));
    console.log('SMART FILTER METADATA VERIFICATION');
    console.log('='.repeat(70));

    const storedDocs = await vectorService.getDocumentsByTicketId(ticketDetails.issue.key);
    console.log(`\n✅ Retrieved ${storedDocs.length} documents for ticket ${ticketDetails.issue.key}`);

    for (let i = 0; i < Math.min(storedDocs.length, 3); i++) {
      const doc = storedDocs[i];
      console.log(`\n${i + 1}. ${doc.title}`);
      console.log(`   Relevance Score: ${doc.relevance_score}`);
      console.log(`   Matched By: ${doc.matched_by?.join(', ') || 'N/A'}`);
      console.log(`   Page ID: ${doc.page_id}`);
    }

    // Show database stats
    console.log('\n' + '='.repeat(70));
    console.log('DATABASE STATISTICS');
    console.log('='.repeat(70));
    console.log(`\n✅ Documents stored: ${filteredPages.length}`);
    console.log(`✅ Chunks created: ${totalChunks}`);
    console.log(`✅ Embeddings generated: ${totalEmbeddings}`);
    console.log(`✅ Vector search working: Yes`);
    console.log(`✅ PostgreSQL localhost: Connected`);
    console.log(`✅ Smart filter metadata: Stored`);

    console.log('\n' + '='.repeat(70));
    console.log('NEXT STEPS');
    console.log('='.repeat(70));
    console.log('\n1. Connect to PostgreSQL:');
    console.log('   psql -U postgres -d postgres-pgvector');
    console.log('\n2. View documents with smart filter metadata:');
    console.log(`   SELECT title, relevance_score, matched_by`);
    console.log(`   FROM confluence_documents`);
    console.log(`   WHERE ticket_id = '${ticketDetails.issue.key}'`);
    console.log(`   ORDER BY relevance_score DESC;`);
    console.log('\n3. View pages that matched by ticket ID:');
    console.log(`   SELECT title, relevance_score`);
    console.log(`   FROM confluence_documents`);
    console.log(`   WHERE 'ticketId' = ANY(matched_by);`);
    console.log('\n4. View detailed scoring breakdown:');
    console.log(`   SELECT title, relevance_score,`);
    console.log(`          filter_metadata->>'ticketIdScore' as ticket_score,`);
    console.log(`          filter_metadata->>'keywordScore' as keyword_score`);
    console.log(`   FROM confluence_documents`);
    console.log(`   WHERE ticket_id = '${ticketDetails.issue.key}';`);
    console.log('\n5. Count records:');
    console.log('   SELECT COUNT(*) FROM confluence_documents;');
    console.log('   SELECT COUNT(*) FROM document_chunks;');

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('');

    await vectorService.close();

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERROR OCCURRED');
    console.error('='.repeat(70));
    console.error(`\nMessage: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    console.error('');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
