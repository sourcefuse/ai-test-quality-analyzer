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

    console.log('🚀 Starting JIRA Ticket Processing with RAG...\n');

    // Get folder naming configuration
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
      outputDir = `${ticketDir}/${currentAnalysisPath}`;
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

    // 7. Save results to Requirements-Rag.md file
    const requirementsFileName = getOptionalEnv('REQUIREMENTS_RAG_FILE_NAME', 'Requirements-Rag.md');
    const filePath = `${outputDir}/${requirementsFileName}`;

    // Format and save content using the processor's saveToFile method
    // But save to our custom location
    const tempDir = './temp_rag_output';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, {recursive: true});
    }
    const tempPath = await processor.saveToFile(result, tempDir);
    const content = fs.readFileSync(tempPath, 'utf-8');
    fs.writeFileSync(filePath, content, 'utf-8');

    // Cleanup temp files
    fs.unlinkSync(tempPath);
    fs.rmdirSync(tempDir, {recursive: true});

    console.log(`\n💾 RAG search results saved to: ${filePath}`);

    console.log('\n✅ RAG Processing Complete!');
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
