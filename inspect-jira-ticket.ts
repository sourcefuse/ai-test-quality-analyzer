/**
 * Inspect Jira Ticket - See what data is available for filtering
 *
 * This script shows:
 * 1. Raw Jira ticket structure
 * 2. Extracted metadata
 * 3. Keywords that would be used for filtering
 * 4. Technical terms detected
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import {JiraService, ConfluenceSmartFilterService} from './src/services';
import {JiraConfigDto} from './src/dtos';

// Load environment variables
dotenv.config();
dotenvExt.load({
  schema: '.env.example',
  errorOnMissing: false,
  includeProcessEnv: true,
});

async function main() {
  console.log('='.repeat(70));
  console.log('JIRA TICKET INSPECTION');
  console.log('='.repeat(70));

  // Check required variables
  const ticketId = process.env.JIRA_TICKET_ID;
  if (!ticketId) {
    console.error('\n❌ Error: JIRA_TICKET_ID not set in .env');
    process.exit(1);
  }

  try {
    // Initialize Jira service
    console.log('\n[1/2] Fetching Jira ticket...');
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

    console.log('\n' + '='.repeat(70));
    console.log('BASIC TICKET INFO');
    console.log('='.repeat(70));
    console.log(`\n📋 Ticket ID: ${ticketDetails.issue.key}`);
    console.log(`📝 Summary: ${ticketDetails.issue.fields.summary}`);
    console.log(`🏷️  Type: ${ticketDetails.issue.fields.issuetype?.name}`);
    console.log(`📊 Status: ${ticketDetails.issue.fields.status?.name}`);
    console.log(`👤 Assignee: ${ticketDetails.issue.fields.assignee?.displayName || 'Unassigned'}`);
    console.log(`📅 Created: ${ticketDetails.issue.fields.created}`);

    // Labels
    console.log('\n' + '='.repeat(70));
    console.log('METADATA - LABELS');
    console.log('='.repeat(70));
    const labels = ticketDetails.issue.fields.labels || [];
    if (labels.length > 0) {
      console.log(`\n✅ Found ${labels.length} label(s):`);
      labels.forEach((label: string, i: number) => {
        console.log(`   ${i + 1}. ${label}`);
      });
    } else {
      console.log('\n❌ No labels found');
    }

    // Components
    console.log('\n' + '='.repeat(70));
    console.log('METADATA - COMPONENTS');
    console.log('='.repeat(70));
    const components = ticketDetails.issue.fields.components || [];
    if (components.length > 0) {
      console.log(`\n✅ Found ${components.length} component(s):`);
      components.forEach((comp: any, i: number) => {
        console.log(`   ${i + 1}. ${comp.name}`);
      });
    } else {
      console.log('\n❌ No components found');
    }

    // Description
    console.log('\n' + '='.repeat(70));
    console.log('DESCRIPTION');
    console.log('='.repeat(70));
    const description = ticketDetails.issue.fields.description;
    console.log('\nRaw Description Type:', typeof description);
    if (description) {
      if (typeof description === 'string') {
        console.log('\nDescription (string):');
        console.log(description.substring(0, 500) + (description.length > 500 ? '...' : ''));
      } else {
        console.log('\nDescription (ADF format):');
        console.log(JSON.stringify(description, null, 2).substring(0, 1000) + '...');
      }
    } else {
      console.log('\n❌ No description');
    }

    // Extract keywords using smart filter service
    console.log('\n' + '='.repeat(70));
    console.log('SMART FILTER ANALYSIS');
    console.log('='.repeat(70));

    const smartFilter = new ConfluenceSmartFilterService();

    // Use reflection to access private method (for inspection purposes)
    const extractJiraContext = (smartFilter as any).extractJiraContext.bind(smartFilter);
    const context = extractJiraContext(ticketDetails.issue);

    console.log('\n📊 Extracted Context:');
    console.log(`\n1. Title (lowercase):`);
    console.log(`   ${context.title}`);

    console.log(`\n2. Description (extracted from ADF, first 300 chars):`);
    console.log(`   ${context.description.substring(0, 300)}${context.description.length > 300 ? '...' : ''}`);

    console.log(`\n3. Labels: ${context.labels.length > 0 ? context.labels.join(', ') : 'None'}`);
    console.log(`\n4. Components: ${context.components.length > 0 ? context.components.join(', ') : 'None'}`);

    console.log(`\n5. Keywords Extracted (top 20):`);
    if (context.keywords.length > 0) {
      console.log(`   ${context.keywords.slice(0, 20).join(', ')}`);
      console.log(`   (Total: ${context.keywords.length} keywords)`);
    } else {
      console.log(`   ❌ No keywords extracted`);
    }

    console.log(`\n6. Technical Terms Detected:`);
    if (context.technicalTerms.length > 0) {
      console.log(`   ${context.technicalTerms.join(', ')}`);
      console.log(`   (Total: ${context.technicalTerms.length} technical terms)`);
    } else {
      console.log(`   ❌ No technical terms detected`);
    }

    // Show how filtering would work
    console.log('\n' + '='.repeat(70));
    console.log('FILTERING STRATEGY');
    console.log('='.repeat(70));
    console.log('\nConfluence pages will be scored based on:');
    console.log('  1. Ticket ID Matching (40% weight) - ALWAYS ENABLED:');
    console.log(`     - Looking for pages containing: "${context.ticketId}"`);
    console.log(`     - Checks both page title and content`);
    console.log('  2. Keyword Matching (30% weight):');
    console.log(`     - Looking for: ${context.keywords.slice(0, 10).join(', ')}...`);
    console.log('  3. Title Similarity (20% weight):');
    console.log(`     - Comparing with: "${ticketDetails.issue.fields.summary}"`);
    if (context.labels.length > 0) {
      console.log('  4. Label Matching (5% weight):');
      console.log(`     - Looking for pages labeled: ${context.labels.join(', ')}`);
    }
    if (context.components.length > 0) {
      console.log('  5. Component Matching (5% weight):');
      console.log(`     - Looking for mentions of: ${context.components.join(', ')}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('FILTERING CONFIGURATION');
    console.log('='.repeat(70));
    console.log(`\nCurrent settings from .env:`);
    console.log(`  - USE_SMART_FILTER: ${process.env.USE_SMART_FILTER}`);
    console.log(`  - SMART_FILTER_MAX_PAGES: ${process.env.SMART_FILTER_MAX_PAGES}`);
    console.log(`  - SMART_FILTER_MIN_SCORE: ${process.env.SMART_FILTER_MIN_SCORE}`);
    console.log(`  - SMART_FILTER_USE_KEYWORDS: ${process.env.SMART_FILTER_USE_KEYWORDS}`);
    console.log(`  - SMART_FILTER_USE_TITLE: ${process.env.SMART_FILTER_USE_TITLE}`);
    console.log(`  - SMART_FILTER_USE_LABELS: ${process.env.SMART_FILTER_USE_LABELS}`);
    console.log(`  - SMART_FILTER_USE_COMPONENTS: ${process.env.SMART_FILTER_USE_COMPONENTS}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ INSPECTION COMPLETE');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Review the extracted keywords and technical terms above');
    console.log('2. Verify they make sense for finding related Confluence pages');
    console.log('3. Run "npm run test-smart-filter" to see actual filtering results');
    console.log('');

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

// Run the inspection
main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
