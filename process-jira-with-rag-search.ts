/**
 * JIRA Ticket Processor Example
 * Example script showing how to use the JIRA Processor service
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import * as fs from 'fs';
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

    // 5. Initialize Hybrid PII Detector
    console.log('\n🔒 Initializing PII Detection...');
    const HybridPIIDetectorService = (await import('./src/services')).HybridPIIDetectorService;
    const piiDetector = new HybridPIIDetectorService();
    const detectionMethod = await piiDetector.initialize();
    const piiStatus = piiDetector.getStatus();

    console.log('✅ PII Detector initialized');
    console.log(`   Method: ${detectionMethod.toUpperCase()}`);
    if (piiStatus.presidioConfigured) {
      console.log(`   Presidio configured: ${piiStatus.presidioStatus?.isAvailable ? '✅ Available' : '❌ Unavailable'}`);
      if (detectionMethod === 'regex') {
        console.log('   ℹ️  Using fallback regex-based detection');
      }
    } else {
      console.log('   ℹ️  Presidio not configured, using regex-based detection');
    }

    // 6. Get folder naming configuration
    const spaceKey = getRequiredEnv('CONFLUENCE_SPACE_KEY', 'Confluence space key');
    const baseFolderSuffix = getOptionalEnv('BASE_FOLDER_SUFFIX', 'Generate-Unit-Tests-Via-AI');
    const ticketFolderSuffix = getOptionalEnv('TICKET_FOLDER_SUFFIX', 'Via-AI');

    // Construct output directory to match fetch-and-analyze.ts structure
    const baseDir = `./${spaceKey}-${baseFolderSuffix}`;
    const ticketDir = `${baseDir}/${ticketKey}-${ticketFolderSuffix}`;

    // Use CURRENT_ANALYSIS_PATH if set, otherwise use the latest folder
    const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;
    let outputDir = '';

    if (currentAnalysisPath) {
      // Use 2-level structure: {BASE}/{CURRENT_ANALYSIS_PATH} (skip ticket folder level)
      outputDir = `${baseDir}/${currentAnalysisPath}`;
    } else {
      // Find the latest timestamp folder
      if (fs.existsSync(ticketDir)) {
        const timestampFolderSuffix = getOptionalEnv('TIMESTAMP_FOLDER_SUFFIX', 'Via-AI');
        const timestampPattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-${timestampFolderSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
        const folders = fs.readdirSync(ticketDir).filter((f: string) => timestampPattern.test(f));

        if (folders.length > 0) {
          folders.sort().reverse();
          outputDir = `${ticketDir}/${folders[0]}`;
          console.log(`ℹ️  Using existing analysis folder: ${folders[0]}`);
        }
      }

      if (!outputDir) {
        console.error('❌ No analysis folder found. Please run fetch-and-analyze.ts first.');
        process.exit(1);
      }
    }

    console.log(`📂 Output directory: ${outputDir}\n`);

    // 7. Initialize JIRA Processor Service with PII detector (only if Presidio is available)
    const processor = new JiraProcessorService(
      jiraService,
      confluenceService,
      embeddingService,
      vectorService,
      piiStatus.presidioStatus?.isAvailable ? piiDetector : undefined
    );

    // 8. Process the ticket
    console.log(`🎫 Processing JIRA ticket: ${ticketKey}`);
    const result = await processor.processTicket(ticketKey, topK);

    // 9. Save Confluence pages to Confluence-Rag.md
    const confluenceFileName = getOptionalEnv('CONFLUENCE_RAG_FILE_NAME', 'Confluence-Rag.md');
    await processor.saveConfluencePages(result, outputDir, confluenceFileName);

    console.log('\n✅ RAG Processing Complete!');
    console.log(`   Ticket: ${result.ticketKey}`);
    console.log(`   Title: ${result.ticketTitle}`);
    console.log(`   Related Documents: ${result.relatedDocuments.length}`);
    console.log(`   Output: ${outputDir}/${confluenceFileName}`);

    // 10. Extract project key from ticket key (e.g., BB-12345 -> BB)
    const projectKey = ticketKey.split('-')[0];

    // 11. Close connections and cleanup project-specific expired records
    await vectorService.close(projectKey);
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
