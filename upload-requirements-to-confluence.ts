/**
 * Upload Jira.md, Requirements.md, and GeneratedTestsReport.md to Confluence
 * Uploads all three analysis files to Confluence as a combined page with proper hierarchy
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import * as fs from 'fs';
import {ConfluenceService} from './src/services';
import {ConfluenceConfigDto} from './src/dtos';

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
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'BB';
    const ticketId = process.env.JIRA_TICKET_ID;
    const currentAnalysisPath = process.env.CURRENT_ANALYSIS_PATH;
    const baseFolderSuffix = process.env.BASE_FOLDER_SUFFIX || 'Generate-Unit-Tests-Via-AI';
    const ticketFolderSuffix = process.env.TICKET_FOLDER_SUFFIX || 'Via-AI';

    if (!ticketId) {
        throw new Error('JIRA_TICKET_ID environment variable is required');
    }

    if (!currentAnalysisPath) {
        throw new Error('CURRENT_ANALYSIS_PATH environment variable is required');
    }

    // Construct the full path: {SPACE_KEY}-{BASE_FOLDER_SUFFIX}/{TICKET_ID}-{TICKET_FOLDER_SUFFIX}/{CURRENT_ANALYSIS_PATH}
    const analysisFolder = `./${spaceKey}-${baseFolderSuffix}/${ticketId}-${ticketFolderSuffix}/${currentAnalysisPath}`;

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
        const jiraFileName = process.env.JIRA_FILE_NAME || 'Jira.md';
        const requirementsFileName = process.env.REQUIREMENTS_FILE_NAME || 'Requirements.md';
        const generatedTestsReportFileName = process.env.GENERATED_TESTS_REPORT_FILE_NAME || 'GeneratedTestsReport.md';

        const jiraFilePath = `${analysisFolder}/${jiraFileName}`;
        const requirementsFilePath = `${analysisFolder}/${requirementsFileName}`;
        const generatedTestsReportFilePath = `${analysisFolder}/${generatedTestsReportFileName}`;

        // Check if files exist
        const jiraExists = fs.existsSync(jiraFilePath);
        const requirementsExists = fs.existsSync(requirementsFilePath);
        const generatedTestsReportExists = fs.existsSync(generatedTestsReportFilePath);

        if (!jiraExists) {
            console.log(`⚠️  Warning: ${jiraFileName} not found: ${jiraFilePath}`);
        }
        if (!requirementsExists) {
            console.log(`⚠️  Warning: ${requirementsFileName} not found: ${requirementsFilePath}`);
        }
        if (!generatedTestsReportExists) {
            console.log(`⚠️  Warning: ${generatedTestsReportFileName} not found: ${generatedTestsReportFilePath}`);
        }

        // At least one file must exist
        if (!jiraExists && !requirementsExists && !generatedTestsReportExists) {
            throw new Error(`No test generation files (${jiraFileName}, ${requirementsFileName}, ${generatedTestsReportFileName}) found in the folder`);
        }

        // Read files
        console.log('\n📖 Reading files...');
        const jiraContent = jiraExists ? fs.readFileSync(jiraFilePath, 'utf-8') : '';
        const requirementsContent = requirementsExists ? fs.readFileSync(requirementsFilePath, 'utf-8') : '';
        const generatedTestsReportContent = generatedTestsReportExists ? fs.readFileSync(generatedTestsReportFilePath, 'utf-8') : '';

        if (jiraContent) {
            console.log(`   ✅ ${jiraFileName} read successfully (${(jiraContent.length / 1024).toFixed(2)} KB)`);
        }
        if (requirementsContent) {
            console.log(`   ✅ ${requirementsFileName} read successfully (${(requirementsContent.length / 1024).toFixed(2)} KB)`);
        }
        if (generatedTestsReportContent) {
            console.log(`   ✅ ${generatedTestsReportFileName} read successfully (${(generatedTestsReportContent.length / 1024).toFixed(2)} KB)`);
        }

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

        // Test generation completed
        console.log(`   ✅ Unit test generation completed successfully`);

        // Step 1: Create/Get root page at root level
        const confluenceRootSuffix = process.env.CONFLUENCE_ROOT_PAGE_SUFFIX || 'Generate-Unit-Tests-Via-AI';
        const confluenceTicketSuffix = process.env.CONFLUENCE_TICKET_PAGE_SUFFIX || 'Via-AI';

        const rootPageTitle = `${spaceKey}-${confluenceRootSuffix}`;
        console.log(`\n📄 Step 1/3: Creating root page: ${rootPageTitle}`);
        const rootPageResponse = await confluenceService.createPage({
            title: rootPageTitle,
            content: `<p>This page contains AI-generated unit test reports for ${spaceKey} space.</p>`,
            spaceKey: spaceKey,
        });
        console.log(`   ✅ Root page ID: ${rootPageResponse.pageId}`);

        // Step 2: Create ticket page under root page
        const ticketPageTitle = `${ticketKey}-${confluenceTicketSuffix}`;
        console.log(`\n📄 Step 2/3: Creating ticket page: ${ticketPageTitle}`);
        const ticketPageResponse = await confluenceService.createPage({
            title: ticketPageTitle,
            content: `<p>Generated unit test reports for ticket ${ticketKey}.</p>`,
            spaceKey: spaceKey,
            parentId: rootPageResponse.pageId,
        });
        console.log(`   ✅ Ticket page ID: ${ticketPageResponse.pageId}`);

        // Step 3: Create analysis page under ticket page (timestamp ensures uniqueness)
        const analysisPageTitle = timestampFolderName;
        console.log(`\n📄 Step 3/3: Creating analysis page: ${analysisPageTitle}`);

        // No scoring for test generation

        // Format content for Confluence
        let confluenceContent = `<h1>Generated Unit Tests Report</h1>
<p><strong>Generated:</strong> ${new Date().toISOString()}</p>
<p><strong>Ticket:</strong> ${ticketKey}</p>
<p><strong>Space:</strong> ${spaceKey}</p>
<p><strong>Analysis Path:</strong> ${timestampFolderName}</p>
<hr />`;

        // Add JIRA content if available
        if (jiraContent) {
            confluenceContent += `
<h2>1. JIRA Ticket Details</h2>
<ac:structured-macro ac:name="code">
<ac:parameter ac:name="language">markdown</ac:parameter>
<ac:plain-text-body><![CDATA[${jiraContent}]]></ac:plain-text-body>
</ac:structured-macro>
<hr />`;
        }

        // Add Requirements content if available
        if (requirementsContent) {
            confluenceContent += `
<h2>2. Requirements Analysis</h2>
<ac:structured-macro ac:name="code">
<ac:parameter ac:name="language">markdown</ac:parameter>
<ac:plain-text-body><![CDATA[${requirementsContent}]]></ac:plain-text-body>
</ac:structured-macro>
<hr />`;
        }

        // Add Generated Tests Report content if available
        if (generatedTestsReportContent) {
            confluenceContent += `
<h2>3. Generated Unit Test Cases</h2>
<ac:structured-macro ac:name="code">
<ac:parameter ac:name="language">markdown</ac:parameter>
<ac:plain-text-body><![CDATA[${generatedTestsReportContent}]]></ac:plain-text-body>
</ac:structured-macro>`;
        }

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
        console.log(`   Files Uploaded: ${[jiraContent && jiraFileName, requirementsContent && requirementsFileName, generatedTestsReportContent && generatedTestsReportFileName].filter(Boolean).join(', ')}`);
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
