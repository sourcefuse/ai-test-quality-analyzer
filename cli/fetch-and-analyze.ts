/**
 * Main entry point for CheckUnitTestCases
 * Demonstrates JIRA and Confluence integration following SourceFuse design patterns
 *
 * Features:
 * - Fetch JIRA ticket details and save to file
 * - Fetch Confluence pages and save to file
 * - Search related documents using RAG (process-jira-with-rag-search.ts)
 *
 * Note: Use process-jira-with-rag-search.ts for RAG functionality with PostgreSQL + pgvector.
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import * as fs from 'fs';
import {randomUUID} from 'crypto';
import {JiraService, ConfluenceService, HybridPIIDetectorService} from '../src/services';
import {JiraConfigDto, JiraTicketQueryDto, ConfluenceConfigDto, ConfluenceSearchRequestDto} from '../src/dtos';
import {stripHtmlTags, extractPlainText} from '../src/utils';

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
        // Initialize Hybrid PII Detector
        console.log('\n🔒 Initializing PII Detection...');
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
                // Create folder with naming convention:
                // If CURRENT_ANALYSIS_PATH is set: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{CURRENT_ANALYSIS_PATH}
                // Otherwise: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{TICKET_ID}-{TICKET_FOLDER_SUFFIX}/{date-time-TIMESTAMP_FOLDER_SUFFIX}
                const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'DEFAULT';
                const ticketKey = ticketDetails.issue.key;
                const baseFolderSuffix = process.env.BASE_FOLDER_SUFFIX || 'Quality-Check-Via-AI';
                const ticketFolderSuffix = process.env.TICKET_FOLDER_SUFFIX || 'Via-AI';
                const timestampFolderSuffix = process.env.TIMESTAMP_FOLDER_SUFFIX || 'Via-AI';

                const baseDir = `./${spaceKey}-${baseFolderSuffix}`;

                // Check if CURRENT_ANALYSIS_PATH is set in environment
                let tmpDir = '';
                const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;

                if (currentAnalysisPath) {
                    // Use the analysis path directly under base folder (skip ticket folder level)
                    tmpDir = `${baseDir}/${currentAnalysisPath}`;
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true });
                        console.log(`✅ Created analysis folder from CURRENT_ANALYSIS_PATH: ${tmpDir}`);
                    } else {
                        console.log(`ℹ️  Using existing analysis folder from CURRENT_ANALYSIS_PATH: ${currentAnalysisPath}`);
                    }
                } else {
                    // Create traditional 3-level structure
                    const ticketDir = `${baseDir}/${ticketKey}-${ticketFolderSuffix}`;
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

        // Confluence Integration
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
                // Create folder with naming convention:
                // If CURRENT_ANALYSIS_PATH is set: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{CURRENT_ANALYSIS_PATH}
                // Otherwise: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{TICKET_ID}-{TICKET_FOLDER_SUFFIX}/{date-time-TIMESTAMP_FOLDER_SUFFIX}
                const spaceKey = confluenceConfig.spaceKey || 'DEFAULT';
                const baseFolderSuffix = process.env.BASE_FOLDER_SUFFIX || 'Quality-Check-Via-AI';
                const ticketFolderSuffix = process.env.TICKET_FOLDER_SUFFIX || 'Via-AI';
                const timestampFolderSuffix = process.env.TIMESTAMP_FOLDER_SUFFIX || 'Via-AI';
                const baseDir = `./${spaceKey}-${baseFolderSuffix}`;

                // Check if CURRENT_ANALYSIS_PATH is set in environment
                let tmpDir = '';
                const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;

                if (currentAnalysisPath) {
                    // Use the analysis path directly under base folder (skip ticket folder level)
                    tmpDir = `${baseDir}/${currentAnalysisPath}`;
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true });
                        console.log(`✅ Created analysis folder from CURRENT_ANALYSIS_PATH: ${tmpDir}`);
                    } else {
                        console.log(`ℹ️  Using existing analysis folder from CURRENT_ANALYSIS_PATH: ${currentAnalysisPath}`);
                    }
                } else {
                    // Create traditional 3-level structure
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

                    // Check for existing timestamp folders or create new one
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
                    process.env.CONFLUENCE_ROOT_PAGE_SUFFIX || 'Quality-Check-Via-AI',
                    process.env.CONFLUENCE_TICKET_PAGE_SUFFIX || 'Via-AI',
                ];

                // Build regex pattern to match timestamp-based analysis pages (e.g., "2025-01-30-Via-AI" or "20250130-14-30-45-Via-AI")
                const timestampPagePattern = new RegExp(`^\\d{4}[-\\d]*-${timestampFolderSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

                // Track PII detection statistics across all batches
                let totalPIIDetected = 0;
                let totalPagesWithPII = 0;
                const piiSummaryByType: {[key: string]: number} = {};

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

                        let cleanContent = extractPlainText(page.body.storage.value);
                        if (!cleanContent || cleanContent.trim().length === 0) {
                            if (!silentMode) {
                                console.log(`   ⊘ Skipping page with empty content: ${page.title}`);
                            }
                            pagesWithoutContent++;
                            totalPagesSkipped++;
                            continue;
                        }

                        // Detect and redact PII from page content using hybrid detector
                        const piiResult = await piiDetector.detectAndRedact(cleanContent);
                        if (piiResult.hasPII) {
                            totalPagesWithPII++;

                            // Calculate PII count based on detection method
                            let piiCount = 0;
                            if (piiResult.method === 'presidio' && piiResult.presidioEntities) {
                                piiCount = piiResult.presidioEntities.length;
                                // Aggregate PII types from Presidio entities
                                const summary = HybridPIIDetectorService.getPresidioSummary(piiResult.presidioEntities);
                                for (const [type, count] of Object.entries(summary)) {
                                    piiSummaryByType[type] = (piiSummaryByType[type] || 0) + count;
                                }
                            } else if (piiResult.method === 'regex' && piiResult.regexMatches) {
                                piiCount = piiResult.regexMatches.length;
                                // Aggregate PII types from regex matches
                                for (const [type, count] of Object.entries(piiResult.summary || {})) {
                                    piiSummaryByType[type] = (piiSummaryByType[type] || 0) + count;
                                }
                            }

                            totalPIIDetected += piiCount;

                            // Use redacted content from hybrid detector
                            cleanContent = piiResult.redactedText;

                            if (!silentMode) {
                                console.log(`   🔒 ${page.id}: ${page.title} (${piiCount} PII item(s) redacted via ${piiResult.method})`);
                            }
                        } else {
                            if (!silentMode) {
                                console.log(`   - ${page.id}: ${page.title}`);
                            }
                        }

                        // Page has content, add it to batch (with PII redacted)
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
                }

                console.log('\n' + '='.repeat(60));
                console.log('✅ Incremental processing completed!');
                console.log('='.repeat(60));
                console.log(`Total batches processed: ${batchCount}`);
                console.log(`Total pages with content: ${totalPagesProcessed}`);
                console.log(`Total pages skipped (no content): ${totalPagesSkipped - totalAIReportsSkipped}`);
                console.log(`Total AI-generated reports excluded: ${totalAIReportsSkipped}`);
                console.log(`Output file: ${confluenceFilePath}`);

                // Append summary to Confluence.md (including PII stats)
                const summary = `\n\n---\n\n# Processing Summary

- Total batches processed: ${batchCount}
- Total pages with content: ${totalPagesProcessed}
- Total pages skipped (no content/folders): ${totalPagesSkipped - totalAIReportsSkipped}
- AI-generated reports excluded: ${totalAIReportsSkipped}
- Completed: ${new Date().toISOString()}

## PII Detection & Redaction

- Total PII items detected: ${totalPIIDetected}
- Pages with PII: ${totalPagesWithPII}
- PII redaction: ${totalPIIDetected > 0 ? '✅ Applied' : 'N/A'}

${totalPIIDetected > 0 ? `### PII Types Found:\n${Object.entries(piiSummaryByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}\n` : ''}

**Note:**
- AI-generated analysis reports are automatically excluded to prevent feedback loops.
- All PII data has been automatically detected and redacted from this document.
`;
                fs.appendFileSync(confluenceFilePath, summary);
                console.log(`✅ Confluence pages saved to ${confluenceFilePath}`);

                // Save detailed PII report if PII was detected
                if (totalPIIDetected > 0) {
                    console.log('\n\n' + '='.repeat(60));
                    console.log('PII DETECTION SUMMARY');
                    console.log('='.repeat(60));
                    console.log(`\n🔒 PII Detection Results:`);
                    console.log(`   Total PII items detected: ${totalPIIDetected}`);
                    console.log(`   Pages with PII: ${totalPagesWithPII}/${totalPagesProcessed}`);
                    console.log(`\n📊 PII Types:`);
                    for (const [type, count] of Object.entries(piiSummaryByType)) {
                        console.log(`   - ${type}: ${count}`);
                    }

                    // Save detailed PII report
                    const piiReportPath = `${tmpDir}/PII-Detection-Report.md`;
                    const piiReport = `# PII Detection & Redaction Report

**File:** ${confluenceFilePath}
**Scanned:** ${new Date().toISOString()}
**Detection Method:** ${detectionMethod.toUpperCase()}${detectionMethod === 'regex' ? ' (Presidio unavailable)' : ' (Presidio active)'}

## Summary

- Total PII items detected: ${totalPIIDetected}
- Pages with PII: ${totalPagesWithPII}
- Total pages processed: ${totalPagesProcessed}
- PII redaction status: ✅ Applied to all detected items

## PII Types Detected

${Object.entries(piiSummaryByType).map(([type, count]) => `- **${type}**: ${count} occurrence(s)`).join('\n')}

## Detection Method Details

${detectionMethod === 'presidio' ? `
### Presidio (Microsoft PII Detection)
- **Analyzer:** ${piiStatus.presidioConfigured ? process.env.PRESIDIO_ANALYZE_URL : 'Not configured'}
- **Anonymizer:** ${piiStatus.presidioConfigured ? process.env.PRESIDIO_ANONYMIZE_URL : 'Not configured'}
- **Advantages:** Context-aware ML-based detection, lower false positives
- **Method:** Uses Named Entity Recognition (NER) models
` : `
### Regex-based Detection (Fallback)
- **Method:** Pattern-matching using regular expressions
- **Patterns:** 15+ PII types including email, SSN, credit cards, API keys, etc.
- **Note:** ${piiStatus.presidioConfigured ? 'Presidio was unavailable, using fallback method' : 'Presidio not configured'}
`}

## Redaction Method

${detectionMethod === 'presidio' ? `
All PII data was redacted using Presidio's masking anonymizer:
- Complete masking with asterisks (*)
- Original structure preserved

Example: \`user@example.com\` → \`*****************\`
` : `
All PII data was automatically redacted using pattern matching:
- First 2 characters visible
- Middle characters replaced with asterisks (*)
- Last 2 characters visible

Example: \`user@example.com\` → \`us***********om\`
`}

## Next Steps

✅ Safe to use: Both Confluence.md and PostgreSQL vector DB contain redacted content.
⚠️  Review: Check the redacted content to ensure business-critical information wasn't over-redacted.
${detectionMethod === 'regex' && piiStatus.presidioConfigured ? `
💡 **Tip:** Start Presidio services for improved PII detection:
   \`\`\`bash
   docker run -d -p 5002:3000 mcr.microsoft.com/presidio-analyzer
   docker run -d -p 5001:3000 mcr.microsoft.com/presidio-anonymizer
   \`\`\`
` : ''}
`;
                    fs.writeFileSync(piiReportPath, piiReport);
                    console.log(`\n📄 Detailed PII report saved to ${piiReportPath}`);
                }

                // Step: Push to PostgreSQL Vector DB (if enabled)
                const usePostgresVectorDB = process.env.USE_POSTGRES_VECTOR_DB === 'true';
                if (usePostgresVectorDB) {
                    console.log('\n\n' + '='.repeat(60));
                    console.log('PUSHING CONFLUENCE DATA TO POSTGRESQL VECTOR DB');
                    console.log('='.repeat(60));

                    try {
                        // Initialize services
                        const {EmbeddingService, PostgresVectorService, ConfluenceIndexerService} = await import('./src/services');
                        const {getRequiredEnv, getOptionalEnvAsNumber} = await import('./src/utils/env-validator.util');

                        console.log('\n🔧 Initializing services...');
                        const embeddingService = new EmbeddingService({
                            apiKey: getRequiredEnv('OPENAI_API_KEY', 'OpenAI API key for embeddings'),
                            model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
                            provider: (process.env.EMBEDDING_PROVIDER as 'openai' | 'openrouter') || 'openai',
                            concurrency: getOptionalEnvAsNumber('EMBEDDING_CONCURRENCY', 20),
                            silentMode: silentMode,
                        });
                        const vectorService = new PostgresVectorService({
                            host: process.env.DATABASE_HOST || 'localhost',
                            port: parseInt(process.env.DATABASE_PORT || '5432'),
                            database: process.env.DATABASE_NAME || 'postgres-pgvector',
                            user: process.env.DATABASE_USER || 'postgres',
                            password: process.env.DATABASE_PASSWORD || 'admin',
                        });

                        // Initialize database
                        console.log('🔧 Initializing database...');
                        await vectorService.initialize();
                        console.log('✅ Database initialized');

                        // Create indexer service
                        const chunkSize = getOptionalEnvAsNumber('CHUNK_SIZE', 1000);
                        const chunkOverlap = getOptionalEnvAsNumber('CHUNK_OVERLAP', 200);
                        const batchSize = getOptionalEnvAsNumber('INDEXER_BATCH_SIZE', 10);
                        const maxPages = getOptionalEnvAsNumber('CONFLUENCE_MAX_PAGES', 0); // 0 means fetch all

                        // Check if PII sanitization is enabled for PostgreSQL data
                        const sanitizePgData = process.env.SANITIZE_PG_DATA !== 'false'; // default true
                        console.log(`\n🔒 PostgreSQL PII Sanitization: ${sanitizePgData ? '✅ ENABLED' : '❌ DISABLED'}`);

                        // Get JIRA project key from environment
                        const projectKey = process.env.JIRA_PROJECT_KEY;

                        // Check if we should verify PostgreSQL before fetching Confluence
                        const checkPgBeforeFetch = process.env.CHECK_PG_BEFORE_CONFLUENCE_FETCH !== 'false'; // default true

                        let shouldFetchConfluence = true;

                        // Check PostgreSQL for existing non-expired records if enabled
                        if (checkPgBeforeFetch && projectKey) {
                            console.log(`\n🔍 Checking PostgreSQL for existing data (project_key: ${projectKey})...`);
                            const existingCount = await vectorService.getDocumentCountByProjectKey(projectKey);
                            console.log(`   Found ${existingCount} non-expired document(s) for project ${projectKey}`);

                            if (existingCount > 0) {
                                shouldFetchConfluence = false;
                                console.log(`   ✅ Using existing data from PostgreSQL - skipping Confluence fetch`);
                            } else {
                                console.log(`   ℹ️  No existing data found - will fetch from Confluence`);
                            }
                        }

                        if (shouldFetchConfluence) {
                            const indexerService = new ConfluenceIndexerService(
                                confluenceService,
                                embeddingService,
                                vectorService,
                                chunkSize,
                                chunkOverlap,
                                sanitizePgData ? piiDetector : undefined, // pass piiDetector only if enabled
                                projectKey, // pass project key from env
                                silentMode, // pass silent mode flag
                            );

                            // Fetch Jira issue for smart filtering if ticket ID is available
                            let jiraIssueForFilter = undefined;
                            const ticketId = process.env.JIRA_TICKET_ID;
                            if (ticketId) {
                                try {
                                    console.log(`\n🎫 Fetching Jira ticket for smart filtering: ${ticketId}`);
                                    const ticketDetails = await jiraService.getTicketDetails({ticketId, includeSubTasks: false});
                                    jiraIssueForFilter = ticketDetails.issue;
                                    console.log(`✅ Jira ticket fetched: ${jiraIssueForFilter.fields.summary}`);
                                } catch (error) {
                                    console.log(`⚠️  Could not fetch Jira ticket for filtering: ${error}`);
                                    console.log(`   Continuing without smart filter...`);
                                }
                            }

                            // Index the space with smart filter
                            console.log(`\n📚 Indexing Confluence space: ${confluenceConfig.spaceKey}`);
                            console.log(`   Max pages to fetch: ${maxPages > 0 ? maxPages : 'All'}`);
                            const stats = await indexerService.indexSpace(
                                confluenceConfig.spaceKey,
                                batchSize,
                                maxPages > 0 ? maxPages : undefined,
                                jiraIssueForFilter  // Pass Jira issue for smart filtering
                            );

                            console.log('\n✅ PostgreSQL Vector DB indexing complete!');
                            console.log(`   Space: ${stats.spaceKey}`);
                            console.log(`   Pages indexed: ${stats.totalPages}`);
                            console.log(`   Total chunks: ${stats.totalChunks}`);
                            console.log(`   Processing time: ${(stats.processingTime / 1000).toFixed(2)}s`);
                            if (stats.errors.length > 0) {
                                console.log(`   Errors: ${stats.errors.length}`);
                            }
                        } else {
                            console.log('\n✅ Skipped Confluence fetch - using existing PostgreSQL data');
                        }

                        // Clean up expired records (general cleanup)
                        console.log('\n🗑️  Cleaning up expired records...');
                        await vectorService.cleanupExpired();

                        // Close database connection and cleanup project-specific expired records
                        await vectorService.close(projectKey);

                    } catch (error: any) {
                        console.error('\n❌ Error pushing to PostgreSQL Vector DB:', error.message);
                        if (error.stack) {
                            console.error('   Stack trace:', error.stack);
                        }
                        console.error('   Confluence.md file was still saved successfully');
                        console.error('   You can manually index to vector DB later using: npm run process:jira');
                    }
                } else {
                    console.log('\nℹ️  PostgreSQL Vector DB indexing disabled (USE_POSTGRES_VECTOR_DB=false)');
                    console.log('   Set USE_POSTGRES_VECTOR_DB=true in .env to enable automatic indexing');
                }

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
