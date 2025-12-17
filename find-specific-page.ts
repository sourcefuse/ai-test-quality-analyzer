/**
 * Find specific Confluence page by ID
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import {ConfluenceService, ConfluenceSmartFilterService, JiraService} from './src/services';
import {ConfluenceConfigDto, JiraConfigDto} from './src/dtos';

dotenv.config();
dotenvExt.load({
  schema: '.env.example',
  errorOnMissing: false,
  includeProcessEnv: true,
});

async function main() {
  console.log('='.repeat(70));
  console.log('FIND SPECIFIC CONFLUENCE PAGE');
  console.log('='.repeat(70));

  const pageId = '4837539850';
  const ticketId = process.env.JIRA_TICKET_ID || 'TEL-13385';
  const spaceKey = process.env.CONFLUENCE_SPACE_KEY;

  if (!spaceKey) {
    console.error('\n❌ Error: CONFLUENCE_SPACE_KEY not set in .env');
    process.exit(1);
  }

  try {
    // Initialize services
    const confluenceConfig: ConfluenceConfigDto = {
      host: process.env.CONFLUENCE_URL || '',
      email: process.env.CONFLUENCE_EMAIL || '',
      apiToken: process.env.CONFLUENCE_API_TOKEN || '',
      spaceKey: spaceKey,
    };

    const confluenceService = new ConfluenceService(confluenceConfig);

    // Fetch all pages
    console.log(`\n[1/3] Fetching all Confluence pages from space ${spaceKey}...`);
    const pagesResponse = await confluenceService.listPages({
      spaceKey: spaceKey,
      expand: ['body.storage', 'metadata.labels'],
    });

    console.log(`   ✅ Fetched ${pagesResponse.pages.length} total pages`);

    // Find the specific page
    console.log(`\n[2/3] Searching for page ID: ${pageId}...`);
    const targetPage = pagesResponse.pages.find((p: any) => p.id === pageId);

    if (!targetPage) {
      console.log(`   ❌ Page ${pageId} not found in fetched pages`);
      console.log(`\n   This could mean:`);
      console.log(`   - Page is in a different space`);
      console.log(`   - Page is restricted/protected`);
      console.log(`   - Page ID is incorrect`);
      process.exit(1);
    }

    console.log(`   ✅ Found page: ${targetPage.title}`);
    console.log(`      ID: ${targetPage.id}`);
    const webui = targetPage._links?.webui || '';
    console.log(`      URL: ${confluenceConfig.host}${webui}`);

    // Check if it contains ticket ID
    console.log(`\n[3/3] Checking for ticket ID "${ticketId}" in page...`);
    const pageTitle = (targetPage.title || '').toLowerCase();
    const pageContent = (targetPage.body?.storage?.value || '').toLowerCase();

    const titleMatch = pageTitle.includes(ticketId.toLowerCase());
    const contentMatch = pageContent.includes(ticketId.toLowerCase());

    console.log(`\n   Title contains "${ticketId}": ${titleMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`   Content contains "${ticketId}": ${contentMatch ? '✅ YES' : '❌ NO'}`);

    if (contentMatch) {
      // Find occurrences
      const regex = new RegExp(ticketId, 'gi');
      const matches = pageContent.match(regex);
      console.log(`   Occurrences: ${matches?.length || 0}`);

      // Show a snippet
      const index = pageContent.indexOf(ticketId.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 100);
        const end = Math.min(pageContent.length, index + 100);
        console.log(`\n   Snippet around "${ticketId}":`);
        console.log(`   ...${pageContent.substring(start, end)}...`);
      }
    }

    // Now run smart filter on ALL pages to see where this page ranks
    console.log(`\n${'='.repeat(70)}`);
    console.log('RUNNING SMART FILTER ON ALL PAGES');
    console.log('='.repeat(70));

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

    const smartFilter = new ConfluenceSmartFilterService();
    const {results: allFiltered, metrics} = smartFilter.filterPagesWithMetrics(
      ticketDetails.issue,
      pagesResponse.pages,
      {
        maxPages: 50,
        minScoreThreshold: 0.0,
        debug: false,
      }
    );

    console.log(`\n✅ Filtered: ${pagesResponse.pages.length} → ${allFiltered.length} pages`);
    console.log(`   Ticket ID matches: ${metrics.matchDistribution.ticketId || 0}`);

    // Find our specific page in results
    const pageIndex = allFiltered.findIndex((r: any) => r.page.id === pageId);

    if (pageIndex === -1) {
      console.log(`\n❌ Page "${targetPage.title}" (${pageId}) NOT in top 50 filtered results`);
      console.log(`   This suggests it scored very low or zero`);
    } else {
      console.log(`\n✅ Page "${targetPage.title}" found at position ${pageIndex + 1}/${allFiltered.length}`);
      const result = allFiltered[pageIndex];
      console.log(`   Score: ${result.score.toFixed(3)}`);
      console.log(`   Matched by: ${result.matchedBy.join(', ')}`);
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }

    // Show top 10 for comparison
    console.log(`\n${'='.repeat(70)}`);
    console.log('TOP 10 FILTERED PAGES');
    console.log('='.repeat(70));
    for (let i = 0; i < Math.min(10, allFiltered.length); i++) {
      const r = allFiltered[i];
      console.log(`\n${i + 1}. ${r.page.title}`);
      console.log(`   Score: ${r.score.toFixed(3)} | Matched by: ${r.matchedBy.join(', ')}`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
