/**
 * JIRA Ticket Processor Example
 * Example script showing how to use the JIRA Processor service
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import {
  JiraService,
  ConfluenceService,
  EmbeddingService,
  PostgresVectorService,
  JiraProcessorService,
} from './src/services';
import {JiraConfigDto, ConfluenceConfigDto} from './src/dtos';
import {
  getRequiredEnv,
  getRequiredEnvAsNumber,
  getOptionalEnv,
  getOptionalEnvAsNumber,
} from './src/utils/env-validator.util';

// Load environment variables
dotenv.config();
dotenvExt.load({
  schema: '.env.example',
  errorOnMissing: false,
  includeProcessEnv: true,
});

async function main() {
  try {
    const ticketKey =
      process.env.JIRA_TICKET_ID || process.env.JIRA_TICKET_KEY;
    const topK = getOptionalEnvAsNumber('JIRA_TOP_K', 5);

    if (!ticketKey) {
      console.error(
        '❌ No ticket key provided. Set JIRA_TICKET_ID or JIRA_TICKET_KEY in .env'
      );
      process.exit(1);
    }

    console.log('🚀 Starting JIRA Ticket Processing...\n');

    // 1. Initialize JIRA Service
    const jiraConfig: JiraConfigDto = {
      url: getRequiredEnv('JIRA_URL', 'JIRA instance URL'),
      email:
        process.env.JIRA_USERNAME ||
        getRequiredEnv('JIRA_EMAIL', 'JIRA user email'),
      apiToken: getRequiredEnv('JIRA_API_TOKEN', 'JIRA API token'),
    };

    const jiraService = new JiraService(jiraConfig);

    // 2. Initialize Confluence Service
    const confluenceConfig: ConfluenceConfigDto = {
      host: getRequiredEnv('CONFLUENCE_URL', 'Confluence URL'),
      email:
        process.env.CONFLUENCE_USERNAME ||
        getRequiredEnv('CONFLUENCE_EMAIL', 'Confluence user email'),
      apiToken: getRequiredEnv(
        'CONFLUENCE_API_TOKEN',
        'Confluence API token'
      ),
    };

    const confluenceService = new ConfluenceService(confluenceConfig);
    confluenceService.setSilentMode(true); // Less verbose for individual page fetches

    // 3. Initialize Embedding Service
    const embeddingService = new EmbeddingService({
      apiKey: getRequiredEnv('OPENAI_API_KEY', 'OpenAI API key'),
      model: getOptionalEnv('EMBEDDING_MODEL', 'text-embedding-3-small'),
      concurrency: getOptionalEnvAsNumber('EMBEDDING_CONCURRENCY', 20),
    });

    // 4. Initialize PostgreSQL Vector Service
    const vectorService = new PostgresVectorService({
      host: getRequiredEnv('DATABASE_HOST', 'PostgreSQL host'),
      port: getRequiredEnvAsNumber('DATABASE_PORT', 'PostgreSQL port'),
      database: getRequiredEnv('DATABASE_NAME', 'PostgreSQL database name'),
      user: getRequiredEnv('DATABASE_USER', 'PostgreSQL user'),
      password: getRequiredEnv('DATABASE_PASSWORD', 'PostgreSQL password'),
    });

    await vectorService.initialize();

    // 5. Initialize JIRA Processor Service
    const processor = new JiraProcessorService(
      jiraService,
      confluenceService,
      embeddingService,
      vectorService
    );

    // 6. Process the ticket
    console.log(`🎫 Processing JIRA ticket: ${ticketKey}`);
    const result = await processor.processTicket(ticketKey, topK);

    // 7. Save results to file
    const outputDir = getOptionalEnv('OUTPUT_DIR', './output');
    const filePath = await processor.saveToFile(result, outputDir);

    console.log('\n✅ Processing Complete!');
    console.log(`   Ticket: ${result.ticketKey}`);
    console.log(`   Title: ${result.ticketTitle}`);
    console.log(`   Related Documents: ${result.relatedDocuments.length}`);
    console.log(`   Output: ${filePath}`);

    // 8. Close connections
    await vectorService.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {main};
