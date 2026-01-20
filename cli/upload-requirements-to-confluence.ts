/**
 * Upload Jira.md, Requirements.md, and AnalysisReport.md to Confluence
 * Uploads all three analysis files to Confluence as a combined page with proper hierarchy
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import * as fs from 'fs';
import {ConfluenceService} from '../src/services';
import {ConfluenceConfigDto} from '../src/dtos';

/**
 * Load environment variables
 */
function loadEnvironment(): void {
    const baseEnvPath = '.env';
    const envExamplePath = '.env.example';

    if (fs.existsSync(baseEnvPath)) {
        dotenv.config({path: baseEnvPath});
    }

    dotenvExt.load({
        schema: envExamplePath,
        errorOnMissing: false,
        includeProcessEnv: true,
        silent: false,
        path: baseEnvPath,
        defaults: envExamplePath,
    });
}

/**
 * Get analysis folder path using environment variables
 */
function getAnalysisFolder(): string {
    // Use ANALYSIS_FOLDER if set, otherwise construct from individual parts
    let analysisFolder = process.env.ANALYSIS_FOLDER;

    if (!analysisFolder) {
        const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'BB';
        const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;
        const baseFolderSuffix = process.env.BASE_FOLDER_SUFFIX || 'Quality-Check-Via-AI';

        if (!currentAnalysisPath) {
            throw new Error('CURRENT_ANALYSIS_PATH or ANALYSIS_FOLDER environment variable is required');
        }

        // Construct 2-level path: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{CURRENT_ANALYSIS_PATH}
        analysisFolder = `./${spaceKey}-${baseFolderSuffix}/${currentAnalysisPath}`;
    } else {
        // Prepend ./ if not already present
        if (!analysisFolder.startsWith('./') && !analysisFolder.startsWith('/')) {
            analysisFolder = `./${analysisFolder}`;
        }
    }

    // Verify the folder exists
    if (!fs.existsSync(analysisFolder)) {
        throw new Error(`Analysis folder not found: ${analysisFolder}`);
    }

    console.log(`✅ Using analysis folder: ${analysisFolder}`);
    return analysisFolder;
}

/**
 * Get Confluence configuration for uploading
 * Uses upload-specific env vars if provided, otherwise falls back to fetch config
 */
function getConfluenceConfig(): ConfluenceConfigDto {
    // Use upload config if provided, otherwise fall back to fetch config
    const uploadUrl = process.env.CONFLUENCE_UPLOAD_URL;
    const uploadEmail = process.env.CONFLUENCE_UPLOAD_EMAIL;
    const uploadApiToken = process.env.CONFLUENCE_UPLOAD_API_TOKEN;
    const uploadSpaceKey = process.env.CONFLUENCE_UPLOAD_SPACE_KEY;

    return {
        host: uploadUrl || process.env.CONFLUENCE_URL || '',
        email: uploadEmail || process.env.CONFLUENCE_EMAIL || '',
        apiToken: uploadApiToken || process.env.CONFLUENCE_API_TOKEN || '',
        spaceKey: uploadSpaceKey || process.env.CONFLUENCE_SPACE_KEY,
    };
}

/**
 * Main function
 */
async function main(): Promise<void> {
    loadEnvironment();

    console.log('='.repeat(60));
    console.log('UPLOAD JIRA + REQUIREMENTS + ANALYSIS TO CONFLUENCE');
    console.log('='.repeat(60));

    try {
        // Get analysis folder from environment variables
        const analysisFolder = getAnalysisFolder();

        // Get Confluence configuration and show which account is being used
        const confluenceConfig = getConfluenceConfig();
        
        // Check if using separate upload account
        const usingUploadAccount = !!(
            process.env.CONFLUENCE_UPLOAD_URL || 
            process.env.CONFLUENCE_UPLOAD_EMAIL || 
            process.env.CONFLUENCE_UPLOAD_API_TOKEN || 
            process.env.CONFLUENCE_UPLOAD_SPACE_KEY
        );
        
        if (usingUploadAccount) {
            console.log('📤 Using separate Confluence account for upload:');
            console.log(`   URL: ${confluenceConfig.host}`);
            console.log(`   Email: ${confluenceConfig.email}`);
            console.log(`   Space: ${confluenceConfig.spaceKey}`);
        } else {
            console.log('📤 Using same Confluence account for upload as fetching');
            console.log(`   URL: ${confluenceConfig.host}`);
            console.log(`   Email: ${confluenceConfig.email}`);
            console.log(`   Space: ${confluenceConfig.spaceKey}`);
        }
        // Define files to upload in sequence (Confluence.md is excluded)
        const filesToUpload = [
            {name: process.env.JIRA_FILE_NAME || 'Jira.md', title: 'JIRA Ticket Details'},
            {name: process.env.CONFLUENCE_RAG_FILE_NAME || 'Confluence-Rag.md', title: 'Confluence Pages (RAG)'},
            {name: 'Requirements-Rag.md', title: 'Requirements Analysis'},
            {name: 'PII-Detection-Report.md', title: 'PII Detection Report'},
        ];

        // Check which files exist and read them
        console.log('\n📖 Checking and reading files...');
        const filesData: Array<{name: string; title: string; content: string}> = [];

        for (const file of filesToUpload) {
            const filePath = `${analysisFolder}/${file.name}`;
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                filesData.push({name: file.name, title: file.title, content});
                console.log(`   ✅ ${file.name} read successfully (${(content.length / 1024).toFixed(2)} KB)`);
            } else {
                console.log(`   ⚠️  ${file.name} not found - skipping`);
            }
        }

        // At least one file must exist
        if (filesData.length === 0) {
            throw new Error(`No analysis files found in ${analysisFolder}. Expected: ${filesToUpload.map(f => f.name).join(', ')}`);
        }

        console.log(`\n✅ Found ${filesData.length} file(s) to upload`)

        const confluenceService = new ConfluenceService(confluenceConfig);
        confluenceService.validateConfig();

        // Extract info from folder path
        const pathParts = analysisFolder.split('/');
        const spaceKey = confluenceConfig.spaceKey || 'BB';
        const ticketKey = process.env.JIRA_TICKET_ID || '';
        const timestampFolderName = process.env.CURRENT_ANALYSIS_PATH || '';

        console.log('\n\n' + '='.repeat(60));
        console.log('UPLOADING TO CONFLUENCE');
        console.log('='.repeat(60));
        console.log(`\n📤 Uploading to Confluence...`);
        console.log(`   Space: ${spaceKey}`);
        console.log(`   Ticket: ${ticketKey}`);
        console.log(`   Timestamp: ${timestampFolderName}`);

        // Log score if available
        const testQualityScore = process.env.TEST_QUALITY_SCORE || 'N/A';
        const minimumThreshold = process.env.MINIMUM_SCORE_THRESHOLD || 'N/A';
        const scorePassed = process.env.SCORE_PASSED === 'true';

        if (testQualityScore !== 'N/A') {
            const scoreIcon = scorePassed ? '✅' : '⚠️';
            console.log(`   ${scoreIcon} Score: ${testQualityScore}/10 (Threshold: ${minimumThreshold}/10)`);
        }

        // Create Confluence page hierarchy: Root → Ticket → Timestamp
        const confluenceRootSuffix = process.env.CONFLUENCE_ROOT_PAGE_SUFFIX || 'Generate-Unit-Tests-Via-AI';
        const confluenceTicketSuffix = process.env.CONFLUENCE_TICKET_PAGE_SUFFIX || 'UT-Via-AI';
        const confluenceTimestampSuffix = process.env.CONFLUENCE_TIMESTAMP_PAGE_SUFFIX || 'UT-Via-AI';

        // Step 1: Create/Get root page
        const rootPageTitle = `${spaceKey}-${confluenceRootSuffix}`;
        console.log(`\n📄 Step 1/3: Creating/Getting root page: ${rootPageTitle}`);
        const rootPageResponse = await confluenceService.createPage({
            title: rootPageTitle,
            content: `<p>This page contains AI-generated unit test reports for ${spaceKey} space.</p>`,
            spaceKey: spaceKey,
        });
        console.log(`   ✅ Root page ID: ${rootPageResponse.pageId}`);

        // Step 2: Create/Get ticket page
        const ticketPageTitle = `${ticketKey}-${confluenceTicketSuffix}`;
        console.log(`\n📄 Step 2/3: Creating/Getting ticket page: ${ticketPageTitle}`);
        const ticketPageResponse = await confluenceService.createPage({
            title: ticketPageTitle,
            content: `<p>Unit test reports for ticket ${ticketKey}.</p>`,
            spaceKey: spaceKey,
            parentId: rootPageResponse.pageId,
        });
        console.log(`   ✅ Ticket page ID: ${ticketPageResponse.pageId}`);

        // Step 3: Create/Update analysis page (timestamp with suffix)
        // Extract timestamp part from CURRENT_ANALYSIS_PATH (e.g., "2025-11-13-19-26-55-Via-AI" → "2025-11-13-19-26-55")
        const timestampMatch = timestampFolderName.match(/^(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
        const timestampPart = timestampMatch ? timestampMatch[1] : timestampFolderName;
        const analysisPageTitle = `${timestampPart}-${confluenceTimestampSuffix}`;
        console.log(`\n📄 Step 3/3: Creating/Updating analysis page: ${analysisPageTitle}`);

        // Format score badge (using variables already defined above)
        let scoreBadge = '';
        if (testQualityScore !== 'N/A') {
            const badgeColor = scorePassed ? '#36B37E' : '#FF5630';
            const badgeIcon = scorePassed ? '✅' : '⚠️';
            scoreBadge = `
<p>
    <strong>Test Quality Score:</strong>
    <span style="background-color: ${badgeColor}; color: black; padding: 4px 12px; border-radius: 3px; font-weight: bold;">
        ${badgeIcon} ${testQualityScore}/10
    </span>
    ${minimumThreshold !== 'N/A' ? `<span style="color: #6B778C; margin-left: 8px;">(Threshold: ${minimumThreshold}/10)</span>` : ''}
</p>`;
        }

        // Get branch URL from environment (if provided by GitHub Actions)
        const branchUrl = process.env.BRANCH_URL;
        const branchName = process.env.BRANCH_NAME;

        // Format branch info if available
        let branchInfo = '';
        if (branchUrl && branchName) {
            branchInfo = `<p><strong>Generated Branch:</strong> <a href="${branchUrl}">${branchName}</a></p>`;
        }

        // Format content for Confluence
        let confluenceContent = `<h1>Complete Analysis Report</h1>
<p><strong>Generated:</strong> ${new Date().toISOString()}</p>
<p><strong>Ticket:</strong> ${ticketKey}</p>
<p><strong>Space:</strong> ${spaceKey}</p>
${branchInfo}
${scoreBadge}
<hr />`;

        // Add all uploaded files in sequence
        filesData.forEach((file, index) => {
            confluenceContent += `
<h2>${index + 1}. ${file.title}</h2>
<ac:structured-macro ac:name="code">
<ac:parameter ac:name="language">markdown</ac:parameter>
<ac:plain-text-body><![CDATA[${file.content}]]></ac:plain-text-body>
</ac:structured-macro>`;

            // Add separator if not the last file
            if (index < filesData.length - 1) {
                confluenceContent += '\n<hr />';
            }
        });

        const analysisPageResponse = await confluenceService.createPage({
            title: analysisPageTitle,
            content: confluenceContent,
            spaceKey: spaceKey,
            parentId: ticketPageResponse.pageId,
        });
        console.log(`   ✅ Analysis page ID: ${analysisPageResponse.pageId}`);

        console.log('\n✅ Confluence Upload Complete!');
        console.log(`   Root Page: ${rootPageTitle}`);
        console.log(`   Ticket Page: ${ticketPageTitle}`);
        console.log(`   Analysis Page: ${analysisPageTitle}`);
        console.log(`   Hierarchy: ${rootPageTitle} → ${ticketPageTitle} → ${analysisPageTitle}`);
        console.log(`   Files Uploaded: ${filesData.map(f => f.name).join(', ')}`);
        console.log(`   Note: Confluence.md was excluded from upload`);
        if (analysisPageResponse.url) {
            console.log(`   URL: ${analysisPageResponse.url}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Complete Analysis Upload Completed Successfully!');
        console.log('='.repeat(60));

        // Explicitly exit with success code
        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
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
