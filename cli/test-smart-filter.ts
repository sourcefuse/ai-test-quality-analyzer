/**
 * Standalone Test Script for Smart Filter
 *
 * Tests the smart filter service with real Jira and Confluence data
 * Run: npm run test-smart-filter
 *
 * Prerequisites:
 * 1. Set JIRA_TICKET_ID in .env
 * 2. Configure Jira and Confluence credentials in .env
 * 3. Optionally set USE_SMART_FILTER=true (default for this script)
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import {
  JiraService,
  ConfluenceService,
  ConfluenceSmartFilterService,
} from '../src/services';
import {JiraConfigDto, ConfluenceConfigDto} from '../src/dtos';

// Load environment variables
dotenv.config();
dotenvExt.load({
  schema: '.env.example',
  errorOnMissing: false,
  includeProcessEnv: true,
});

async function main() {
  console.log('='.repeat(70));
  console.log('SMART FILTER STANDALONE TEST');
  console.log('='.repeat(70));

  // Check required variables
  const ticketId = process.env.JIRA_TICKET_ID;
  if (!ticketId) {
    console.error('\n❌ Error: JIRA_TICKET_ID not set in .env');
    console.error('   Please set a valid Jira ticket ID to test with.\n');
    process.exit(1);
  }

  const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
  if (!spaceKey) {
    console.error('\n❌ Error: CONFLUENCE_SPACE_KEY not set in .env');
    console.error('   Please set a valid Confluence space key to test with.\n');
    process.exit(1);
  }

  try {
    // Initialize Jira service
    console.log('\n[1/5] Initializing Jira service...');
    const jiraConfig: JiraConfigDto = {
      url: process.env.JIRA_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
    };

    const jiraService = new JiraService(jiraConfig);
    jiraService.validateConfig();

    // Fetch Jira ticket
    console.log(`\n[2/5] Fetching Jira ticket: ${ticketId}...`);
    const ticketDetails = await jiraService.getTicketDetails({
      ticketId,
      includeSubTasks: false,
    });

    console.log('\n   ✅ Ticket Details:');
    console.log(`      ID: ${ticketDetails.issue.key}`);
    console.log(`      Summary: ${ticketDetails.issue.fields.summary}`);
    console.log(`      Type: ${ticketDetails.issue.fields.issuetype?.name}`);
    console.log(`      Labels: ${ticketDetails.issue.fields.labels?.join(', ') || 'None'}`);
    console.log(`      Components: ${ticketDetails.issue.fields.components?.map((c: any) => c.name).join(', ') || 'None'}`);

    // Initialize Confluence service
    console.log('\n[3/5] Initializing Confluence service...');
    const confluenceConfig: ConfluenceConfigDto = {
      host: process.env.CONFLUENCE_URL || '',
      email: process.env.CONFLUENCE_EMAIL || '',
      apiToken: process.env.CONFLUENCE_API_TOKEN || '',
      spaceKey: spaceKey,
    };

    const confluenceService = new ConfluenceService(confluenceConfig);
    confluenceService.validateConfig();
    confluenceService.setSilentMode(true);

    // Fetch all Confluence pages
    console.log(`\n[4/5] Fetching Confluence pages from space: ${spaceKey}...`);
    const pagesResponse = await confluenceService.listPages({
      spaceKey: spaceKey,
      limit: 100,
      expand: ['body.storage', 'metadata.labels'],
    });

    console.log(`\n   ✅ Fetched ${pagesResponse.pages.length} Confluence pages`);

    // Run smart filter
    console.log('\n[5/5] Running Smart Filter...');
    const smartFilter = new ConfluenceSmartFilterService();

    const debug = process.env.SMART_FILTER_DEBUG === 'true';
    const maxPages = parseInt(process.env.SMART_FILTER_MAX_PAGES || '30');
    const minScore = parseFloat(process.env.SMART_FILTER_MIN_SCORE || '0.3');

    const {results, metrics} = smartFilter.filterPagesWithMetrics(
      ticketDetails.issue,
      pagesResponse.pages,
      {
        maxPages,
        minScoreThreshold: minScore,
        useKeywords: process.env.SMART_FILTER_USE_KEYWORDS !== 'false',
        useTitleMatch: process.env.SMART_FILTER_USE_TITLE !== 'false',
        useLabels: process.env.SMART_FILTER_USE_LABELS !== 'false',
        useComponents: process.env.SMART_FILTER_USE_COMPONENTS !== 'false',
        debug,
      }
    );

    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('SMART FILTER RESULTS');
    console.log('='.repeat(70));

    console.log('\n📊 Metrics:');
    console.log(`   Total pages fetched: ${metrics.totalPages}`);
    console.log(`   Pages after filtering: ${metrics.filteredPages}`);
    console.log(`   Reduction: ${metrics.reductionPercentage.toFixed(1)}%`);
    console.log(`   Average relevance score: ${metrics.averageScore.toFixed(3)}`);
    console.log(`   Execution time: ${metrics.executionTimeMs}ms`);

    console.log('\n🎫 Ticket ID:');
    console.log(`   ${metrics.ticketId || 'N/A'}`);

    console.log('\n🔍 Keywords Extracted from Jira:');
    console.log(`   ${metrics.keywordsExtracted.slice(0, 15).join(', ')}`);

    console.log('\n📈 Match Distribution:');
    console.log(`   - By Ticket ID: ${metrics.matchDistribution.ticketId} pages`);
    console.log(`   - By Keywords: ${metrics.matchDistribution.keywords} pages`);
    console.log(`   - By Title: ${metrics.matchDistribution.title} pages`);
    console.log(`   - By Labels: ${metrics.matchDistribution.labels} pages`);
    console.log(`   - By Components: ${metrics.matchDistribution.components} pages`);

    console.log('\n🏆 Top 10 Filtered Pages:');
    console.log('-'.repeat(70));

    const displayCount = Math.min(10, results.length);
    for (let i = 0; i < displayCount; i++) {
      const result = results[i];
      console.log(`\n${i + 1}. ${result.page.title}`);
      console.log(`   Score: ${result.score.toFixed(3)}`);
      console.log(`   Matched by: ${result.matchedBy.join(', ')}`);

      if (debug && result.details) {
        console.log(`   Details:`);
        if (result.details.ticketIdScore) {
          console.log(`      - Ticket ID score: ${result.details.ticketIdScore.toFixed(3)}`);
        }
        if (result.details.keywordScore) {
          console.log(`      - Keyword score: ${result.details.keywordScore.toFixed(3)}`);
        }
        if (result.details.titleScore) {
          console.log(`      - Title score: ${result.details.titleScore.toFixed(3)}`);
        }
        if (result.details.labelScore) {
          console.log(`      - Label score: ${result.details.labelScore.toFixed(3)}`);
        }
        if (result.details.componentScore) {
          console.log(`      - Component score: ${result.details.componentScore.toFixed(3)}`);
        }
      }

      console.log(`   URL: ${result.page._links?.webui || 'N/A'}`);
    }

    if (results.length === 0) {
      console.log('\n⚠️  No pages matched the filter criteria.');
      console.log('   Try lowering SMART_FILTER_MIN_SCORE in .env');
    }

    console.log('\n' + '='.repeat(70));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(70));

    if (metrics.reductionPercentage < 20) {
      console.log('\n⚠️  Low filtering (< 20% reduction):');
      console.log('   - Consider increasing SMART_FILTER_MIN_SCORE');
      console.log('   - Or decreasing SMART_FILTER_MAX_PAGES');
    } else if (metrics.reductionPercentage > 70) {
      console.log('\n⚠️  Aggressive filtering (> 70% reduction):');
      console.log('   - Verify top results are relevant to the Jira ticket');
      console.log('   - Consider lowering SMART_FILTER_MIN_SCORE if missing important pages');
    } else {
      console.log('\n✅ Filtering looks good (20-70% reduction)');
      console.log('   - Review top results for relevance');
      console.log('   - Adjust thresholds if needed');
    }

    if (metrics.averageScore < 0.4) {
      console.log('\n💡 Low average score (< 0.4):');
      console.log('   - Jira ticket may have limited technical details');
      console.log('   - Consider adding more keywords to the description');
      console.log('   - Or lowering the minimum score threshold');
    }

    console.log('\n' + '='.repeat(70));
    console.log('NEXT STEPS');
    console.log('='.repeat(70));
    console.log('\n1. Review the top filtered pages above - are they relevant?');
    console.log('2. If filtering is too aggressive, lower SMART_FILTER_MIN_SCORE');
    console.log('3. If not filtering enough, raise SMART_FILTER_MIN_SCORE');
    console.log('4. Once satisfied, integrate into main workflow (see IMPLEMENTATION_TODO.md)');
    console.log('5. Set USE_SMART_FILTER=true in .env to enable in production\n');

    console.log('='.repeat(70));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('');

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERROR OCCURRED');
    console.error('='.repeat(70));
    console.error(`\nMessage: ${error.message}`);

    if (error.statusCode) {
      console.error(`Status Code: ${error.statusCode}`);
    }

    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }

    console.error('\n' + '='.repeat(70));
    console.error('');
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
