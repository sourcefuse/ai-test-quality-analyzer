/**
 * Main entry point for CheckUnitTestCases
 * Demonstrates JIRA and Confluence integration following SourceFuse design patterns
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import * as fs from 'fs';
import {randomUUID} from 'crypto';
import {JiraService, ConfluenceService} from './src/services';
import {JiraConfigDto, JiraTicketQueryDto, ConfluenceConfigDto, ConfluenceSearchRequestDto} from './src/dtos';
import {stripHtmlTags, extractPlainText, createAIService} from './src/utils';

/**
 * Load environment variables with dotenv-extended
 * This ensures all required environment variables from .env.example are loaded
 */
function loadEnvironment(): void {
    const baseEnvPath = '.env';
    const envExamplePath = '.env.example';
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Load base .env first
    if (fs.existsSync(baseEnvPath)) {
        dotenv.config({path: baseEnvPath});
    }

    // Use dotenv-extended to validate against .env.example
    dotenvExt.load({
        schema: envExamplePath,
        errorOnMissing: false, // Set to true in production to enforce all variables
        includeProcessEnv: true,
        silent: false,
        path: baseEnvPath,
        defaults: envExamplePath,
    });

    console.log(`✅ Environment loaded: ${nodeEnv}`);
}

/**
 * Get JIRA configuration from environment variables
 * @returns JIRA configuration DTO
 */
function getJiraConfig(): JiraConfigDto {
    const fetchFields = process.env.JIRA_FETCH_FIELDS
        ? process.env.JIRA_FETCH_FIELDS.split(',').map(f => f.trim())
        : undefined;

    return {
        url: process.env.JIRA_URL || '',
        email: process.env.JIRA_EMAIL || '',
        apiToken: process.env.JIRA_API_TOKEN || '',
        projectKey: process.env.JIRA_PROJECT_KEY,
        maxResult: process.env.JIRA_MAX_RESULT ? parseInt(process.env.JIRA_MAX_RESULT) : undefined,
        fetchFields,
    };
}

/**
 * Get Confluence configuration from environment variables
 * @returns Confluence configuration DTO
 */
function getConfluenceConfig(): ConfluenceConfigDto {
    return {
        host: process.env.CONFLUENCE_URL || '',
        email: process.env.CONFLUENCE_EMAIL || '',
        apiToken: process.env.CONFLUENCE_API_TOKEN || '',
        spaceKey: process.env.CONFLUENCE_SPACE_KEY,
    };
}

/**
 * Main application function
 * Demonstrates JIRA and Confluence service usage
 */
async function main(): Promise<void> {
    // Load environment variables first
    loadEnvironment();

    console.log('='.repeat(60));
    console.log('CheckUnitTestCases - JIRA & Confluence Integration Demo');
    console.log('='.repeat(60));
    console.log('Node version:', process.version);
    console.log('Current directory:', process.cwd());
    console.log('Environment:', process.env.NODE_ENV);
    console.log('='.repeat(60));

    try {
        // Get JIRA configuration from environment
        const jiraConfig = getJiraConfig();

        console.log('\n📋 JIRA Configuration:');
        console.log('- URL:', jiraConfig.url);
        console.log('- Email:', jiraConfig.email);
        console.log('- Project Key:', jiraConfig.projectKey || 'Not set');
        console.log('- Max Results:', jiraConfig.maxResult || 'Default (100)');

        // Create JIRA service instance
        console.log('\n🔧 Initializing JIRA service...');
        const jiraService = new JiraService(jiraConfig);

        // Validate configuration
        jiraService.validateConfig();
        console.log('✅ JIRA configuration validated');

        // Test authentication before proceeding
        try {
            await jiraService.testAuthentication();
        } catch (authError: any) {
            console.error('\n' + '='.repeat(60));
            console.error('❌ Cannot proceed - Authentication failed');
            console.error('='.repeat(60));
            process.exit(1);
        }

        // Example 1: Fetch a specific ticket (if JIRA_TICKET_ID is set)
        const ticketId = process.env.JIRA_TICKET_ID;
        if (ticketId && jiraConfig.projectKey) {
            console.log(`\n📄 Example: Fetching JIRA ticket details...`);
            console.log('-'.repeat(60));

            const query: JiraTicketQueryDto = {
                ticketId,
                // Don't pass projectKey - let buildTicketJQL extract it from the ticket ID
                includeSubTasks: true,
            };

            const ticketDetails = await jiraService.getTicketDetails(query);

            console.log('\n✅ Ticket Details Retrieved:');
            console.log('- Ticket Key:', ticketDetails.issue.key);
            console.log('- Summary:', ticketDetails.issue.fields.summary);
            console.log('- Sub-tasks:', ticketDetails.subIssues?.length || 0);

            if (ticketDetails.formattedText) {
                console.log('\n📝 Formatted Text:');
                console.log('-'.repeat(60));
                console.log(ticketDetails.formattedText);
                console.log('-'.repeat(60));
            }

            // Save Jira details to file if SAVE_TO_FILE flag is enabled
            if (process.env.SAVE_TO_FILE === 'true') {
                // Create folder with naming convention: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{TICKET_ID}-{TICKET_FOLDER_SUFFIX}/{date-time-TIMESTAMP_FOLDER_SUFFIX}
                const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'DEFAULT';
                const ticketKey = ticketDetails.issue.key;
                const baseFolderSuffix = process.env.BASE_FOLDER_SUFFIX || 'Generate-Unit-Tests-Via-AI';
                const ticketFolderSuffix = process.env.TICKET_FOLDER_SUFFIX || 'Via-AI';
                const timestampFolderSuffix = process.env.TIMESTAMP_FOLDER_SUFFIX || 'Via-AI';

                const baseDir = `./${spaceKey}-${baseFolderSuffix}`;
                const ticketDir = `${baseDir}/${ticketKey}-${ticketFolderSuffix}`;

                // Check if CURRENT_ANALYSIS_PATH is set in environment
                let tmpDir = '';
                const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;

                if (currentAnalysisPath) {
                    // Use the analysis path from environment variable
                    tmpDir = `${ticketDir}/${currentAnalysisPath}`;
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true });
                        console.log(`✅ Created analysis folder from CURRENT_ANALYSIS_PATH: ${tmpDir}`);
                    } else {
                        console.log(`ℹ️  Using existing analysis folder from CURRENT_ANALYSIS_PATH: ${currentAnalysisPath}`);
                    }
                } else {
                    // Create new timestamp folder
                    const now = new Date();
                    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                    const timestampFolderName = `${timestamp}-${timestampFolderSuffix}`;
                    tmpDir = `${ticketDir}/${timestampFolderName}`;
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true });
                        console.log(`✅ Created folder: ${tmpDir}`);
                        console.log(`\n💡 TIP: Add this to your .env file to reuse this folder:`);
                        console.log(`   CURRENT_ANALYSIS_PATH="${timestampFolderName}"`);
                    }
                }

                const jiraFileName = process.env.JIRA_FILE_NAME || 'Jira.md';
                const jiraContent = `# Jira Ticket Details\n\n**Ticket ID:** ${ticketDetails.issue.key}\n\n**Summary:** ${ticketDetails.issue.fields.summary}\n\n**Formatted Text:**\n\n${ticketDetails.formattedText || 'N/A'}\n`;
                fs.writeFileSync(`${tmpDir}/${jiraFileName}`, jiraContent);
                console.log(`✅ Jira details saved to ${tmpDir}/${jiraFileName}`);
            }
        } else {
            console.log('\n⚠️  Skipping ticket fetch - JIRA_TICKET_ID or JIRA_PROJECT_KEY not set');
            console.log('   Set these variables in .env to test ticket retrieval');
        }

        // Example 2: Search for issues by JQL
        if (jiraConfig.projectKey) {
            console.log(`\n🔍 Example: Searching for issues in project ${jiraConfig.projectKey}...`);
            console.log('-'.repeat(60));

            const jql = `project = '${jiraConfig.projectKey}' ORDER BY created DESC`;
            const searchResults = await jiraService.searchIssues({
                jql,
                maxResults: 5,
                fields: ['key', 'summary', 'status'],
            });

            console.log(`\n✅ Found ${searchResults.total} total issue(s)`);
            console.log(`   Showing first ${searchResults.issues.length} issue(s):\n`);

            for (const issue of searchResults.issues) {
                const summary = issue.fields?.summary || 'No summary';
                console.log(`   - ${issue.key}: ${summary}`);
            }
        } else {
            console.log('\n⚠️  Skipping search - JIRA_PROJECT_KEY not set');
        }

        // Example 3: Confluence Integration
        console.log('\n\n' + '='.repeat(60));
        console.log('CONFLUENCE INTEGRATION TESTS');
        console.log('='.repeat(60));

        const confluenceConfig = getConfluenceConfig();

        console.log('\n📋 Confluence Configuration:');
        console.log('- URL:', confluenceConfig.host);
        console.log('- Email:', confluenceConfig.email);
        console.log('- Space Key:', confluenceConfig.spaceKey || 'Not set');

        // Create Confluence service instance
        console.log('\n🔧 Initializing Confluence service...');
        const confluenceService = new ConfluenceService(confluenceConfig);

        // Enable silent mode during page downloads if flag is set
        const silentMode = process.env.CONFLUENCE_SILENT_MODE === 'true';
        if (silentMode) {
            confluenceService.setSilentMode(true);
            console.log('🔇 Silent mode enabled - suppressing download logs');
        }

        // Validate configuration
        confluenceService.validateConfig();
        console.log('✅ Confluence configuration validated');

        // Example: List pages in the space with incremental processing
        if (confluenceConfig.spaceKey) {
            console.log(`\n📚 Example: Listing pages in Confluence space ${confluenceConfig.spaceKey}...`);
            console.log('-'.repeat(60));

            // Get max pages from environment variable (0 or undefined means fetch all)
            const maxPages = process.env.CONFLUENCE_MAX_PAGES
                ? parseInt(process.env.CONFLUENCE_MAX_PAGES)
                : 0;

            // Get page limit from environment variable (default 50)
            const pageLimit = process.env.CONFLUENCE_PAGE_LIMIT
                ? parseInt(process.env.CONFLUENCE_PAGE_LIMIT)
                : 50;

            console.log(`   Max pages to fetch: ${maxPages > 0 ? maxPages : 'All'}`);
            console.log(`   Page limit per API call: ${pageLimit}`);

            const searchRequest: ConfluenceSearchRequestDto = {
                spaceKey: confluenceConfig.spaceKey,
                limit: pageLimit, // Batch size per API call
                maxPages: maxPages, // Total maximum pages to fetch
                expand: ['body.storage'], // Expand to get page content
            };

            // Start incremental processing if SAVE_TO_FILE is enabled
            if (process.env.SAVE_TO_FILE === 'true') {
                // Create folder with naming convention
                const spaceKey = confluenceConfig.spaceKey || 'DEFAULT';
                const baseFolderSuffix = process.env.BASE_FOLDER_SUFFIX || 'Generate-Unit-Tests-Via-AI';
                const ticketFolderSuffix = process.env.TICKET_FOLDER_SUFFIX || 'Via-AI';
                const timestampFolderSuffix = process.env.TIMESTAMP_FOLDER_SUFFIX || 'Via-AI';
                const baseDir = `./${spaceKey}-${baseFolderSuffix}`;

                // Get ticket ID from environment or scan for existing folders
                let ticketKey = process.env.JIRA_TICKET_ID || '';

                // If no ticket ID in env, try to find existing ticket folder
                if (!ticketKey && fs.existsSync(baseDir)) {
                    const folders = fs.readdirSync(baseDir).filter(f => {
                        const fullPath = `${baseDir}/${f}`;
                        return fs.statSync(fullPath).isDirectory() && f.includes(`-${ticketFolderSuffix}`);
                    });
                    if (folders.length > 0) {
                        // Use the first ticket folder found
                        const folderName = folders[0];
                        ticketKey = folderName.replace(`-${ticketFolderSuffix}`, '');
                        console.log(`ℹ️  Using existing ticket folder: ${folderName}`);
                    }
                }

                if (!ticketKey) {
                    ticketKey = 'UNKNOWN';
                    console.log('⚠️  No JIRA_TICKET_ID found, using UNKNOWN');
                }

                const ticketDir = `${baseDir}/${ticketKey}-${ticketFolderSuffix}`;

                // Check if CURRENT_ANALYSIS_PATH is set in environment
                let tmpDir = '';
                const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;

                if (currentAnalysisPath) {
                    // Use the analysis path from environment variable
                    tmpDir = `${ticketDir}/${currentAnalysisPath}`;
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true });
                        console.log(`✅ Created analysis folder from CURRENT_ANALYSIS_PATH: ${tmpDir}`);
                    } else {
                        console.log(`ℹ️  Using existing analysis folder from CURRENT_ANALYSIS_PATH: ${currentAnalysisPath}`);
                    }
                } else {
                    // Fallback: Check for existing timestamp folders or create new one
                    if (fs.existsSync(ticketDir)) {
                        // Look for existing timestamp folders - match pattern with suffix
                        const timestampPattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-${timestampFolderSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
                        const timestampFolders = fs.readdirSync(ticketDir).filter(f => {
                            const fullPath = `${ticketDir}/${f}`;
                            return fs.statSync(fullPath).isDirectory() && timestampPattern.test(f);
                        }).sort().reverse(); // Sort descending to get latest

                        if (timestampFolders.length > 0) {
                            // Use the latest timestamp folder
                            tmpDir = `${ticketDir}/${timestampFolders[0]}`;
                            console.log(`ℹ️  Using existing analysis folder: ${timestampFolders[0]}`);
                        }
                    }

                    // If no existing timestamp folder found, create new one
                    if (!tmpDir) {
                        const now = new Date();
                        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                        const timestampFolderName = `${timestamp}-${timestampFolderSuffix}`;
                        tmpDir = `${ticketDir}/${timestampFolderName}`;
                        fs.mkdirSync(tmpDir, { recursive: true });
                        console.log(`✅ Created analysis folder: ${tmpDir}`);
                        console.log(`\n💡 TIP: Add this to your .env file to reuse this folder:`);
                        console.log(`   CURRENT_ANALYSIS_PATH="${timestampFolderName}"`);
                    }
                }

                // Check if Jira file exists for analysis
                const jiraFileName = process.env.JIRA_FILE_NAME || 'Jira.md';
                const jiraFilePath = `${tmpDir}/${jiraFileName}`;
                if (!fs.existsSync(jiraFilePath)) {
                    console.log(`\n⚠️  ${jiraFileName} not found - will save all Confluence content without filtering`);
                }

                const jiraContent = fs.existsSync(jiraFilePath)
                    ? fs.readFileSync(jiraFilePath, 'utf-8')
                    : '';

                // Extract ticket ID from Jira content
                let ticketInfo = '';
                if (jiraContent) {
                    const ticketIdMatch = jiraContent.match(/\*\*Ticket ID:\*\*\s*([A-Z]+-\d+)/);
                    const summaryMatch = jiraContent.match(/\*\*Summary:\*\*\s*(.+)/);
                    if (ticketIdMatch) {
                        ticketInfo = `\nJIRA Ticket: ${ticketIdMatch[1]}`;
                        if (summaryMatch) {
                            ticketInfo += `\nSummary: ${summaryMatch[1].trim()}`;
                        }
                    }
                }

                // AI service will be created later only if needed for vector DB operations
                let aiService: any = null;

                // Initialize Confluence file
                const confluenceFileName = process.env.CONFLUENCE_FILE_NAME || 'Confluence.md';
                const confluenceFilePath = `${tmpDir}/${confluenceFileName}`;
                const confluenceHeader = `# Confluence Pages (Raw Content)
${ticketInfo}
Space Key: ${confluenceConfig.spaceKey}
Generated on: ${new Date().toISOString()}
Strategy: Incremental batch processing - saving raw content to file

---

`;
                fs.writeFileSync(confluenceFilePath, confluenceHeader);

                console.log('\n\n' + '='.repeat(60));
                console.log('SAVING CONFLUENCE PAGES TO FILE');
                console.log('='.repeat(60));
                console.log('\n💾 Saving all Confluence content directly to file (no AI filtering)');

                let totalPagesProcessed = 0;
                let totalPagesSkipped = 0;
                let totalAIReportsSkipped = 0;
                let batchCount = 0;

                // Get AI-generated report title patterns to exclude from processing
                const excludeTitlePatterns = [
                    process.env.CONFLUENCE_ROOT_PAGE_SUFFIX || 'Generate-Unit-Tests-Via-AI',
                    process.env.CONFLUENCE_TICKET_PAGE_SUFFIX || 'Via-AI',
                ];

                // Build regex pattern to match timestamp-based analysis pages (e.g., "2025-01-30-Via-AI" or "20250130-14-30-45-Via-AI")
                const timestampPagePattern = new RegExp(`^\\d{4}[-\\d]*-${timestampFolderSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

                // Process Confluence pages in batches
                for await (const batch of confluenceService.listPagesInBatches(searchRequest)) {
                    batchCount++;
                    if (!silentMode) {
                        console.log(`\n📦 Processing batch ${batch.batchNumber}/${batch.totalBatches > 0 ? batch.totalBatches : '?'}...`);
                        console.log(`   Pages in this batch: ${batch.pages.length}`);
                    }

                    // Build batch content
                    let batchContent = '';
                    let pagesWithContent = 0;
                    let pagesWithoutContent = 0;

                    for (const page of batch.pages) {
                        // Skip AI-generated reports to prevent feedback loop
                        // Check for: 1) suffix patterns, 2) timestamp pattern
                        const matchesSuffix = excludeTitlePatterns.some(pattern =>
                            page.title.includes(pattern) || page.title.endsWith(pattern)
                        );
                        const matchesTimestamp = timestampPagePattern.test(page.title);
                        const isAIReport = matchesSuffix || matchesTimestamp;

                        if (isAIReport) {
                            if (!silentMode) {
                                console.log(`   🤖 Skipping AI-generated report: ${page.title}`);
                            }
                            totalAIReportsSkipped++;
                            totalPagesSkipped++;
                            continue;
                        }

                        // Check if page has body content
                        if (!page.body?.storage?.value) {
                            if (!silentMode) {
                                console.log(`   ⊘ Skipping page without content (folder/container): ${page.title}`);
                            }
                            pagesWithoutContent++;
                            totalPagesSkipped++;
                            continue;
                        }

                        const cleanContent = extractPlainText(page.body.storage.value);
                        if (!cleanContent || cleanContent.trim().length === 0) {
                            if (!silentMode) {
                                console.log(`   ⊘ Skipping page with empty content: ${page.title}`);
                            }
                            pagesWithoutContent++;
                            totalPagesSkipped++;
                            continue;
                        }

                        // Page has content, add it to batch
                        if (!silentMode) {
                            console.log(`   - ${page.id}: ${page.title}`);
                        }
                        batchContent += `## ${page.title}\n\n`;
                        batchContent += `${cleanContent}\n\n`;
                        batchContent += `---\n\n`;
                        pagesWithContent++;
                    }

                    totalPagesProcessed += pagesWithContent;

                    // Save batch content directly to file (only if there's content)
                    if (batchContent.trim().length > 0) {
                        if (!silentMode) {
                            console.log(`   💾 Saving batch ${batch.batchNumber} content to file...`);
                        }
                        const batchSeparator = `\n<!-- BATCH ${batch.batchNumber} - ${new Date().toISOString()} -->\n\n`;
                        fs.appendFileSync(confluenceFilePath, batchSeparator + batchContent + '\n\n');
                        if (!silentMode) {
                            console.log(`   ✅ Batch ${batch.batchNumber} saved: ${pagesWithContent} page(s) with content${pagesWithoutContent > 0 ? `, ${pagesWithoutContent} skipped (no content)` : ''}`);
                        }
                    } else {
                        if (!silentMode) {
                            console.log(`   ⊘ Batch ${batch.batchNumber}: All ${pagesWithoutContent} page(s) skipped (no content)`);
                        }
                    }

                    /*
                    // ========================================
                    // AI FILTERING (COMMENTED OUT FOR NOW)
                    // ========================================
                    // Analyze batch with AI if available
                    if (aiService && jiraContent && batchContent.trim()) {
                        console.log(`\n🔍 Analyzing batch ${batch.batchNumber} for relevance and removing PII...`);

                        const systemPrompt = `You are a technical requirements analyst with expertise in identifying relevant project documentation and ensuring data privacy.

Your task is to:
1. Analyze the JIRA ticket requirements provided
2. From the Confluence batch content, extract ONLY the pages/sections that are relevant to these requirements
3. Remove ALL Personally Identifiable Information (PII) from the output, including:
   - Names of individuals (replace with roles like "QA Engineer", "Developer", etc.)
   - Email addresses, phone numbers, meeting passcodes
   - Employee IDs, specific locations
   - Any other personal identifiers

IMPORTANT OUTPUT FORMAT:
- Remove the content which you think is a analysis report, like having text GenerateTestCasesReport_
- If NO content is relevant, return ONLY the word "EMPTY" (without quotes)
- If content IS relevant, return ONLY the relevant sections with PII removed as clean markdown
- Do NOT include explanations, summaries, or metadata - only the filtered content or "EMPTY"
- Keep the original structure with ## headings and --- separators`;

                        const userPrompt = `# JIRA Requirements:
${jiraContent}

# Confluence Batch Content:
${batchContent}

Return only relevant content with PII removed, or "EMPTY" if nothing is relevant.`;

                        try {
                            const result = await aiService.chatCompletion({
                                system: systemPrompt,
                                messages: [
                                    {
                                        role: 'user',
                                        content: userPrompt,
                                    },
                                ],
                                temperature: 0.3,
                            } as any);

                            const filteredContent = result.response.trim();

                            // Check if content is relevant
                            if (filteredContent && filteredContent !== 'EMPTY' && filteredContent.length > 10) {
                                console.log(`   ✅ Relevant content found in batch ${batch.batchNumber}`);
                                totalRelevantPages += batch.pages.length;

                                // Append to Confluence.md with batch separator
                                const batchSeparator = `\n<!-- BATCH ${batch.batchNumber} - ${new Date().toISOString()} -->\n\n`;
                                fs.appendFileSync(confluenceFilePath, batchSeparator + filteredContent + '\n\n');
                            } else {
                                console.log(`   ⊘ No relevant content in batch ${batch.batchNumber}`);
                            }

                            // Display token usage if available
                            if (result.tokensUsed && result.tokensUsed.total) {
                                console.log(`   📊 Tokens used: ${result.tokensUsed.total}`);
                            }
                        } catch (error: any) {
                            console.error(`   ❌ Error analyzing batch ${batch.batchNumber}:`, error.message);
                            console.log(`   ⚠️  Saving batch content without filtering`);
                            const batchSeparator = `\n<!-- BATCH ${batch.batchNumber} - UNFILTERED -->\n\n`;
                            fs.appendFileSync(confluenceFilePath, batchSeparator + batchContent + '\n\n');
                        }
                    }
                    */
                }

                console.log('\n' + '='.repeat(60));
                console.log('✅ Incremental processing completed!');
                console.log('='.repeat(60));
                console.log(`Total batches processed: ${batchCount}`);
                console.log(`Total pages with content: ${totalPagesProcessed}`);
                console.log(`Total pages skipped (no content): ${totalPagesSkipped - totalAIReportsSkipped}`);
                console.log(`Total AI-generated reports excluded: ${totalAIReportsSkipped}`);
                console.log(`Output file: ${confluenceFilePath}`);

                // Append summary to Confluence.md
                const summary = `\n\n---\n\n# Processing Summary

- Total batches processed: ${batchCount}
- Total pages with content: ${totalPagesProcessed}
- Total pages skipped (no content/folders): ${totalPagesSkipped - totalAIReportsSkipped}
- AI-generated reports excluded: ${totalAIReportsSkipped}
- Completed: ${new Date().toISOString()}

**Note:** AI-generated analysis reports are automatically excluded to prevent feedback loops.
`;
                fs.appendFileSync(confluenceFilePath, summary);
                console.log(`✅ Confluence pages saved to ${confluenceFilePath}`);

                // Step: Push Confluence.md to Vector Database
                // Enable vector DB when CLAUDE_CODE_USE_BEDROCK is '0'
                const enableVectorDB = process.env.CLAUDE_CODE_USE_BEDROCK === '0';

                if (!enableVectorDB) {
                    console.log('\n\n' + '='.repeat(60));
                    console.log('VECTOR DATABASE OPERATIONS DISABLED');
                    console.log('='.repeat(60));
                    console.log('\n⚠️  Vector database operations are disabled');
                    console.log('   Set CLAUDE_CODE_USE_BEDROCK=0 in .env to enable vector database features');
                    console.log('   Skipping: Push to VectorDB and Requirements search');
                } else {
                    console.log('\n\n' + '='.repeat(60));
                    console.log('PUSHING CONFLUENCE DATA TO VECTOR DATABASE');
                    console.log('='.repeat(60));

                try {
                    // Read the Confluence.md file
                    console.log('\n📖 Reading Confluence.md file...');
                    const confluenceDocContent = fs.readFileSync(confluenceFilePath, 'utf-8');
                    console.log(`✅ File read successfully (${confluenceDocContent.length} characters)`);

                    // Check if content is too large for single embedding (Titan limit ~8K tokens)
                    const MAX_CHARS_PER_CHUNK = 20000; // ~5K tokens (safe margin for token density variance)
                    const contentSizeKB = (confluenceDocContent.length / 1024).toFixed(2);
                    console.log(`   File size: ${contentSizeKB} KB`);

                    if (confluenceDocContent.length > MAX_CHARS_PER_CHUNK) {
                        console.log(`\n⚠️  Content too large for single embedding (${contentSizeKB} KB > 30 KB limit)`);
                        console.log(`   Chunking content for batch processing...`);

                        // Create vector store service with custom collection name based on Confluence space
                        console.log('\n🔧 Initializing Vector Store...');
                        const {createVectorStoreService} = await import('./src/utils');

                        // Override collection name to use Confluence space key
                        const collectionName = `${confluenceConfig.spaceKey}-index`;
                        process.env.VECTOR_STORE_COLLECTION_NAME = collectionName;

                        const vectorStore = createVectorStoreService();
                        vectorStore.validateConfig();
                        console.log(`   Using collection name: ${collectionName}`);

                        // Delete existing collection if it exists
                        console.log('🗑️  Deleting existing collection (if any)...');
                        try {
                            const collectionInfo = await vectorStore.getCollectionInfo();
                            console.log(`   Found existing collection: ${collectionInfo.name} (${collectionInfo.documentCount} docs)`);

                            // Delete via direct Qdrant API call
                            const qdrantUrl = process.env.VECTOR_STORE_URL || 'http://127.0.0.1:6333';
                            const deleteResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
                                method: 'DELETE',
                            });

                            if (deleteResponse.ok) {
                                console.log(`   ✅ Collection deleted successfully`);
                            } else {
                                console.log(`   ⚠️  Failed to delete collection`);
                            }
                        } catch (error: any) {
                            console.log(`   ℹ️  No existing collection found (clean start)`);
                        }

                        // Create fresh collection
                        console.log('🔨 Creating fresh collection...');
                        await vectorStore.initializeCollection();

                        // Create or reuse AI service for embeddings
                        const embeddingService = aiService || createAIService();

                        // Split content into chunks
                        const chunks: string[] = [];
                        for (let i = 0; i < confluenceDocContent.length; i += MAX_CHARS_PER_CHUNK) {
                            chunks.push(confluenceDocContent.substring(i, i + MAX_CHARS_PER_CHUNK));
                        }

                        console.log(`   Content split into ${chunks.length} chunk(s)`);

                        // Batch processing: Generate all embeddings first, then batch upsert
                        console.log(`\n🔢 Generating embeddings for all chunks...`);
                        const startTime = Date.now();

                        const embeddings: number[][] = [];
                        const upsertRequests: any[] = [];

                        // Generate embeddings for all chunks (sequential to avoid rate limits)
                        for (let i = 0; i < chunks.length; i++) {
                            console.log(`   Generating embedding ${i + 1}/${chunks.length}...`);
                            const embeddingResult = await embeddingService.generateEmbedding({
                                text: chunks[i],
                            });
                            embeddings.push(embeddingResult.embedding);

                            // Prepare upsert request
                            upsertRequests.push({
                                id: randomUUID(),
                                content: chunks[i],
                                metadata: {
                                    source: 'confluence',
                                    sourceId: ticketId || 'unknown',
                                    title: ticketId ? `${ticketId} - Confluence Documentation (Chunk ${i + 1}/${chunks.length})` : `Confluence Documentation (Chunk ${i + 1})`,
                                    spaceKey: confluenceConfig.spaceKey || '',
                                    projectKey: jiraConfig.projectKey || '',
                                    type: 'confluence-pages',
                                    chunkIndex: i + 1,
                                    totalChunks: chunks.length,
                                    createdAt: new Date().toISOString(),
                                    modifiedAt: new Date().toISOString(),
                                },
                            });
                        }

                        const embeddingTime = ((Date.now() - startTime) / 1000).toFixed(2);
                        console.log(`   ✅ All embeddings generated in ${embeddingTime}s`);

                        // Batch upsert to vector store
                        console.log(`\n📤 Batch upserting ${chunks.length} chunks to vector DB...`);
                        const upsertStartTime = Date.now();
                        await vectorStore.upsertBatch(upsertRequests, embeddings);
                        const upsertTime = ((Date.now() - upsertStartTime) / 1000).toFixed(2);
                        console.log(`   ✅ Batch upsert completed in ${upsertTime}s`);

                        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                        console.log(`   ⚡ Total processing time: ${totalTime}s`);
                        console.log(`   ⚡ Average per chunk: ${(Number(totalTime) / chunks.length).toFixed(2)}s`);

                        // Get collection info
                        const collectionInfo = await vectorStore.getCollectionInfo();
                        console.log('\n✅ Vector Database Update Complete!');
                        console.log(`   Collection: ${collectionInfo.name}`);
                        console.log(`   Total documents: ${collectionInfo.documentCount}`);
                        console.log(`   Vector dimensions: ${collectionInfo.vectorSize}`);
                        console.log(`   Chunks uploaded: ${chunks.length}`);

                    } else {
                        // Content is small enough for single embedding
                        console.log(`   Content size OK for single embedding`);

                        // Create vector store service with custom collection name based on Confluence space
                        console.log('\n🔧 Initializing Vector Store...');
                        const {createVectorStoreService} = await import('./src/utils');

                        // Override collection name to use Confluence space key
                        const collectionName = `${confluenceConfig.spaceKey}-index`;
                        process.env.VECTOR_STORE_COLLECTION_NAME = collectionName;

                        const vectorStore = createVectorStoreService();
                        vectorStore.validateConfig();
                        console.log(`   Using collection name: ${collectionName}`);

                        // Delete existing collection if it exists
                        console.log('🗑️  Deleting existing collection (if any)...');
                        try {
                            const collectionInfo = await vectorStore.getCollectionInfo();
                            console.log(`   Found existing collection: ${collectionInfo.name} (${collectionInfo.documentCount} docs)`);

                            // Delete via direct Qdrant API call
                            const qdrantUrl = process.env.VECTOR_STORE_URL || 'http://127.0.0.1:6333';
                            const deleteResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
                                method: 'DELETE',
                            });

                            if (deleteResponse.ok) {
                                console.log(`   ✅ Collection deleted successfully`);
                            } else {
                                console.log(`   ⚠️  Failed to delete collection`);
                            }
                        } catch (error: any) {
                            console.log(`   ℹ️  No existing collection found (clean start)`);
                        }

                        // Create fresh collection
                        console.log('🔨 Creating fresh collection...');
                        await vectorStore.initializeCollection();

                        // Create or reuse AI service for embeddings
                        const embeddingService = aiService || createAIService();

                        // Generate embedding using Bedrock AI service
                        console.log('\n🔢 Generating embedding for Confluence content...');
                        const embeddingResult = await embeddingService.generateEmbedding({
                            text: confluenceDocContent,
                        });
                        console.log(`✅ Embedding generated (${embeddingResult.dimensions} dimensions)`);

                        // Prepare document for vector store (use UUID for Qdrant compatibility)
                        const documentId = randomUUID();
                        const upsertRequest = {
                            id: documentId,
                            content: confluenceDocContent,
                            metadata: {
                                source: 'confluence',
                                sourceId: ticketId || 'unknown',
                                title: ticketId ? `${ticketId} - Confluence Documentation` : 'Confluence Documentation',
                                spaceKey: confluenceConfig.spaceKey || '',
                                projectKey: jiraConfig.projectKey || '',
                                type: 'confluence-pages',
                                createdAt: new Date().toISOString(),
                                modifiedAt: new Date().toISOString(),
                            },
                        };

                        // Upsert document to vector store
                        console.log('\n📤 Pushing document to vector database...');
                        await vectorStore.upsertDocument(upsertRequest, embeddingResult.embedding);

                        // Get collection info
                        const collectionInfo = await vectorStore.getCollectionInfo();
                        console.log('\n✅ Vector Database Update Complete!');
                        console.log(`   Collection: ${collectionInfo.name}`);
                        console.log(`   Total documents: ${collectionInfo.documentCount}`);
                        console.log(`   Vector dimensions: ${collectionInfo.vectorSize}`);
                        console.log(`   Document ID: ${documentId}`);
                    }

                } catch (error: any) {
                    console.error('\n❌ Error pushing to vector database:', error.message);
                    if (error.stack) {
                        console.error('   Stack trace:', error.stack);
                    }
                    console.error('   Confluence.md file was still saved successfully');
                    console.error('   You can manually push to vector DB later if needed');
                }

                // Step: Search Vector DB using JIRA content and save to Requirements.md
                console.log('\n\n' + '='.repeat(60));
                console.log('SEARCHING VECTOR DB FOR RELATED REQUIREMENTS');
                console.log('='.repeat(60));

                try {
                    // Use the same folder as before (variables already declared in parent scope)
                    const baseDir = `./${spaceKey}-${baseFolderSuffix}`;

                    // Get ticket ID from environment or scan for existing folders
                    let ticketKey = process.env.JIRA_TICKET_ID || '';

                    // If no ticket ID in env, try to find existing ticket folder
                    if (!ticketKey && fs.existsSync(baseDir)) {
                        const folders = fs.readdirSync(baseDir).filter(f => {
                            const fullPath = `${baseDir}/${f}`;
                            return fs.statSync(fullPath).isDirectory() && f.includes(`-${ticketFolderSuffix}`);
                        });
                        if (folders.length > 0) {
                            // Use the first ticket folder found
                            const folderName = folders[0];
                            ticketKey = folderName.replace(`-${ticketFolderSuffix}`, '');
                            console.log(`ℹ️  Using existing ticket folder: ${folderName}`);
                        }
                    }

                    if (!ticketKey) {
                        ticketKey = 'UNKNOWN';
                    }

                    const ticketDir = `${baseDir}/${ticketKey}-${ticketFolderSuffix}`;

                    // Check if CURRENT_ANALYSIS_PATH is set in environment, otherwise find the latest
                    let tmpDir = '';
                    const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;

                    if (currentAnalysisPath) {
                        tmpDir = `${ticketDir}/${currentAnalysisPath}`;
                        console.log(`ℹ️  Using analysis folder from CURRENT_ANALYSIS_PATH: ${currentAnalysisPath}`);
                    } else {
                        // Fallback: Find the latest timestamp folder
                        if (fs.existsSync(ticketDir)) {
                            const timestampPattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-${timestampFolderSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
                            const timestampFolders = fs.readdirSync(ticketDir).filter(f => {
                                const fullPath = `${ticketDir}/${f}`;
                                return fs.statSync(fullPath).isDirectory() && timestampPattern.test(f);
                            }).sort().reverse(); // Sort descending to get latest

                            if (timestampFolders.length > 0) {
                                tmpDir = `${ticketDir}/${timestampFolders[0]}`;
                                console.log(`ℹ️  Using analysis folder: ${timestampFolders[0]}`);
                            }
                        }
                    }

                    if (!tmpDir || !fs.existsSync(tmpDir)) {
                        console.log('\n⚠️  No analysis folder found - skipping requirements search');
                        throw new Error('No analysis folder found');
                    }

                    // Check if Jira file exists
                    const jiraFileName = process.env.JIRA_FILE_NAME || 'Jira.md';
                    const jiraFilePath = `${tmpDir}/${jiraFileName}`;
                    if (!fs.existsSync(jiraFilePath)) {
                        console.log(`\n⚠️  ${jiraFileName} not found - skipping requirements search`);
                    } else {
                        // Read JIRA content to use as query
                        console.log(`\n📖 Reading ${jiraFileName} for query...`);
                        const jiraQueryContent = fs.readFileSync(jiraFilePath, 'utf-8');
                        console.log(`✅ JIRA content read (${jiraQueryContent.length} characters)`);

                        // Extract ticket ID and summary
                        let queryTicketId = 'unknown';
                        let querySummary = '';
                        const ticketIdMatch = jiraQueryContent.match(/\*\*Ticket ID:\*\*\s*([A-Z]+-\d+)/);
                        const summaryMatch = jiraQueryContent.match(/\*\*Summary:\*\*\s*(.+)/);
                        if (ticketIdMatch) {
                            queryTicketId = ticketIdMatch[1];
                        }
                        if (summaryMatch) {
                            querySummary = summaryMatch[1].trim();
                        }

                        console.log(`   Query Ticket: ${queryTicketId}`);
                        console.log(`   Summary: ${querySummary}`);

                        // Initialize vector store and AI service
                        console.log('\n🔧 Initializing Vector Store for search...');
                        const {createVectorStoreService} = await import('./src/utils');

                        // Use the same collection name as before
                        const collectionName = `${confluenceConfig.spaceKey}-index`;
                        process.env.VECTOR_STORE_COLLECTION_NAME = collectionName;

                        const vectorStore = createVectorStoreService();
                        console.log(`   Using collection: ${collectionName}`);

                        const searchService = aiService || createAIService();

                        // Generate embedding for JIRA query
                        console.log('\n🔢 Generating embedding for JIRA query...');
                        const queryEmbeddingResult = await searchService.generateEmbedding({
                            text: jiraQueryContent,
                        });
                        console.log(`✅ Query embedding generated (${queryEmbeddingResult.dimensions} dimensions)`);

                        // Search vector database
                        console.log('\n🔍 Searching vector database for related content...');
                        const searchLimit = parseInt(process.env.MAX_VECTOR_RESULTS || '10');
                        const minScore = parseFloat(process.env.MIN_SIMILARITY_SCORE || '0.7');

                        console.log(`   Search limit: ${searchLimit} results`);
                        console.log(`   Min similarity score: ${minScore}`);

                        const searchResults = await vectorStore.search(
                            {
                                query: `${queryTicketId}: ${querySummary}`,
                                limit: searchLimit,
                                minScore: minScore,
                            },
                            queryEmbeddingResult.embedding,
                        );

                        console.log(`✅ Found ${searchResults.results.length} matching document(s)`);

                        // ============================================
                        // STEP 4: LLM SUMMARIZATION (RAG Completion)
                        // ============================================
                        let llmExtractedContent = '';
                        let llmProcessingTime = 0;

                        if (searchResults.results.length > 0) {
                            console.log('\n🤖 Step 4: Using LLM to extract relevant requirements from retrieved chunks...');

                            try {
                                const llmStartTime = Date.now();

                                // Combine all chunks with metadata
                                let combinedChunks = '';
                                for (let i = 0; i < searchResults.results.length; i++) {
                                    const result = searchResults.results[i];
                                    const score = ((result.score || 0) * 100).toFixed(2);
                                    combinedChunks += `\n### Document Chunk ${i + 1} (Similarity: ${score}%)\n`;
                                    combinedChunks += `Source: ${result.metadata.title || 'Untitled'}\n\n`;
                                    combinedChunks += result.content + '\n\n';
                                    combinedChunks += `---\n`;
                                }

                                // Ask LLM to extract only relevant info
                                const systemPrompt = `You are a technical requirements analyst. Your task is to extract ONLY information relevant to the provided JIRA ticket from the documentation chunks retrieved from a vector database.

**Analysis Structure:**
Return a structured markdown report with these sections:

1. **Relevant Requirements** - Requirements, features, or specifications related to this ticket
2. **Implementation Details** - Technical details, APIs, design patterns, architecture decisions
3. **Test Scenarios** - Existing test patterns, quality standards, or testing approaches
4. **Dependencies** - Related components, services, libraries, or tickets mentioned
5. **Additional Context** - Any other relevant information (error handling, edge cases, etc.)

**Important Guidelines:**
- Extract and summarize ONLY information directly relevant to the JIRA ticket
- If a section has no relevant information, write "No relevant information found in retrieved documents."
- Keep technical details precise and actionable
- Reference specific patterns, APIs, or approaches when mentioned
- Be concise but comprehensive`;

                                const userPrompt = `# JIRA Ticket Information
${jiraQueryContent}

# Documentation Chunks Retrieved from Vector Database
${combinedChunks}

Extract and structure the relevant information according to the analysis framework.`;

                                console.log('   Sending request to LLM...');
                                const llmResult = await searchService.chatCompletion({
                                    system: systemPrompt,
                                    messages: [{role: 'user', content: userPrompt}],
                                    temperature: 0.3,
                                } as any);

                                llmExtractedContent = llmResult.response;
                                llmProcessingTime = ((Date.now() - llmStartTime) / 1000);

                                console.log(`✅ LLM extraction completed in ${llmProcessingTime.toFixed(2)}s`);
                                if (llmResult.tokensUsed && llmResult.tokensUsed.total) {
                                    console.log(`   Tokens used: ${llmResult.tokensUsed.total}`);
                                }
                            } catch (error: any) {
                                console.error(`❌ LLM extraction failed: ${error.message}`);
                                console.log('   Falling back to raw chunks...');
                                llmExtractedContent = ''; // Will use fallback below
                            }
                        }

                        // Write results to Requirements file
                        const requirementsFileName = process.env.REQUIREMENTS_FILE_NAME || 'Requirements.md';
                        const requirementsFilePath = `${tmpDir}/${requirementsFileName}`;
                        console.log(`\n📝 Writing results to ${requirementsFilePath}...`);

                        let requirementsContent = `# Related Requirements from Vector DB\n\n`;
                        requirementsContent += `**JIRA Ticket:** ${queryTicketId}\n`;
                        requirementsContent += `**Summary:** ${querySummary}\n`;
                        requirementsContent += `**Generated:** ${new Date().toISOString()}\n`;
                        requirementsContent += `**Collection:** ${collectionName}\n`;
                        requirementsContent += `**Search Results:** ${searchResults.results.length} of ${searchLimit} requested\n`;
                        requirementsContent += `**Min Similarity Score:** ${minScore}\n`;
                        requirementsContent += `**Processing:** Vector Search + LLM Extraction (RAG)\n\n`;
                        requirementsContent += `---\n\n`;

                        if (searchResults.results.length === 0) {
                            requirementsContent += `## No Related Requirements Found\n\n`;
                            requirementsContent += `No documents were found with similarity score >= ${minScore}.\n`;
                            requirementsContent += `Try lowering the MIN_SIMILARITY_SCORE in .env or adding more documents to the vector database.\n`;
                        } else if (llmExtractedContent && llmExtractedContent.trim().length > 0) {
                            // Use LLM-extracted content (Step 4 complete!)
                            requirementsContent += `## AI-Extracted Requirements Analysis\n\n`;
                            requirementsContent += `*The following analysis was generated by an LLM after retrieving ${searchResults.results.length} relevant document chunks from the vector database.*\n\n`;
                            requirementsContent += llmExtractedContent + '\n\n';

                            // Add raw chunks as appendix for reference
                            requirementsContent += `\n---\n\n`;
                            requirementsContent += `## Appendix: Raw Retrieved Chunks\n\n`;
                            requirementsContent += `*The following are the raw document chunks retrieved from vector search, before LLM processing.*\n\n`;

                            for (let i = 0; i < searchResults.results.length; i++) {
                                const result = searchResults.results[i];
                                const resultNum = i + 1;
                                const similarityPercent = ((result.score || 0) * 100).toFixed(2);

                                requirementsContent += `### ${resultNum}. ${result.metadata.title || 'Untitled'}\n\n`;
                                requirementsContent += `**Similarity Score:** ${similarityPercent}%\n`;
                                if (result.metadata.chunkIndex) {
                                    requirementsContent += `**Chunk:** ${result.metadata.chunkIndex} of ${result.metadata.totalChunks}\n`;
                                }
                                requirementsContent += `\n<details>\n<summary>Click to view raw content</summary>\n\n`;
                                requirementsContent += `\`\`\`\n${result.content.substring(0, 500)}...\n\`\`\`\n\n`;
                                requirementsContent += `</details>\n\n`;
                            }
                        } else {
                            // Fallback to raw chunks if LLM fails
                            requirementsContent += `## Related Documentation (${searchResults.results.length} results)\n\n`;
                            requirementsContent += `*Note: LLM extraction unavailable. Showing raw chunks from vector search.*\n\n`;

                            for (let i = 0; i < searchResults.results.length; i++) {
                                const result = searchResults.results[i];
                                const resultNum = i + 1;
                                const similarityPercent = ((result.score || 0) * 100).toFixed(2);

                                requirementsContent += `### ${resultNum}. ${result.metadata.title || 'Untitled'}\n\n`;
                                requirementsContent += `**Similarity Score:** ${similarityPercent}%\n`;
                                requirementsContent += `**Source:** ${result.metadata.source}\n`;
                                requirementsContent += `**Type:** ${result.metadata.type}\n`;
                                if (result.metadata.chunkIndex) {
                                    requirementsContent += `**Chunk:** ${result.metadata.chunkIndex} of ${result.metadata.totalChunks}\n`;
                                }
                                requirementsContent += `\n**Content:**\n\n`;
                                requirementsContent += `\`\`\`\n${result.content}\n\`\`\`\n\n`;
                                requirementsContent += `---\n\n`;
                            }
                        }

                        // Add search metadata
                        requirementsContent += `\n## Search Metadata\n\n`;
                        requirementsContent += `- **Query Length:** ${jiraQueryContent.length} characters\n`;
                        requirementsContent += `- **Embedding Dimensions:** ${queryEmbeddingResult.dimensions}\n`;
                        requirementsContent += `- **Total Results:** ${searchResults.total}\n`;
                        requirementsContent += `- **Collection:** ${collectionName}\n`;
                        if (llmProcessingTime > 0) {
                            requirementsContent += `- **LLM Processing Time:** ${llmProcessingTime.toFixed(2)}s\n`;
                        }
                        requirementsContent += `- **Timestamp:** ${new Date().toISOString()}\n`;

                        // Write to file
                        fs.writeFileSync(requirementsFilePath, requirementsContent);
                        console.log(`✅ Requirements saved to ${requirementsFilePath}`);
                        console.log(`   Total results: ${searchResults.results.length}`);
                        console.log(`   Average similarity: ${(searchResults.results.reduce((sum, r) => sum + (r.score || 0), 0) / searchResults.results.length * 100).toFixed(2)}%`);
                    }

                } catch (error: any) {
                    console.error('\n❌ Error searching vector database:', error.message);
                    if (error.stack) {
                        console.error('   Stack trace:', error.stack);
                    }
                    const requirementsFileName = process.env.REQUIREMENTS_FILE_NAME || 'Requirements.md';
                    console.error(`   ${requirementsFileName} file may not have been created`);
                }
                } // End of vector DB check (controlled by CLAUDE_CODE_USE_BEDROCK)

            } else {
                // Just list pages without saving
                const pagesResponse = await confluenceService.listPages(searchRequest);
                console.log(`\n✅ Found ${pagesResponse.total} total page(s)`);
                console.log(`   Showing ${pagesResponse.pages.length} page(s):\n`);

                for (const page of pagesResponse.pages) {
                    console.log(`   - ${page.id}: ${page.title}`);
                    console.log(`     Type: ${page.type}, Status: ${page.status}`);
                }
            }
        } else {
            console.log('\n⚠️  Skipping Confluence tests - CONFLUENCE_SPACE_KEY not set');
            console.log('   Set this variable in .env to test Confluence integration');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ CheckUnitTestCases - Completed successfully!');
        console.log('='.repeat(60));

        // Explicitly exit with success code
        process.exit(0);

    } catch (error: any) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ Error occurred:');
        console.error('='.repeat(60));
        console.error('Message:', error.message);

        if (error.statusCode) {
            console.error('Status Code:', error.statusCode);
        }

        if (error.details) {
            console.error('Details:', JSON.stringify(error.details, null, 2));
        }

        console.error('='.repeat(60));

        process.exit(1);
    }
}

// Execute main function
main().catch((error) => {
    console.error('\n❌ Unhandled error in main:', error);
    if (error.stack) {
        console.error('Stack trace:', error.stack);
    }
    process.exit(1);
});
