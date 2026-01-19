# Implementation TODO - Cost Optimization & Smart Filtering

**Created**: December 17, 2025
**Project**: Generate Unit Test Cases via AI
**Goal**: Reduce costs by 76% while maintaining quality

---

## 📋 Context & Background

### Current Architecture
- **Language**: TypeScript/Node.js
- **Runtime**: GitHub Actions
- **Jira Integration**: ✅ Working
- **Confluence Integration**: ✅ Working
- **RAG System**: PostgreSQL + pgvector (Docker, ephemeral)
- **Embeddings**: OpenAI text-embedding-3-small ($0.02/1M tokens)
- **AI Generation**: AWS Bedrock Claude Sonnet ($3/$15 per 1M tokens)
- **Test Generation**: Claude Code CLI

### Current Costs (Estimated - 100 runs/month)
```
PostgreSQL (Docker):     $0.00 ✅ (ephemeral, no hosting cost)
OpenAI Embeddings:       $0.30 💰 (COST DRIVER #1)
Claude Sonnet API:      $12.00 💰💰 (COST DRIVER #2)
GitHub Actions:          $2.00
─────────────────────────────
TOTAL:                  ~$14.30/month
```

### Target After Optimization
```
PostgreSQL (Docker):     $0.00 (unchanged)
Free Embeddings:         $0.00 🎉 (Transformers.js)
Claude Haiku API:        $1.80 🎉 (switch from Sonnet)
GitHub Actions:          $1.60 (faster execution)
─────────────────────────────
TOTAL:                   ~$3.40/month
SAVINGS:                 76% ($10.90/month)
```

---

## 🎯 Implementation Phases

### Phase 1: Smart Filtering (Week 1) - Foundation
**Goal**: Pre-filter Confluence pages before embedding
**Benefit**: Quality improvement + 20-30% speed boost
**Cost Impact**: Modest ($0.12/month savings)
**Effort**: 6-8 hours
**Risk**: Low (can toggle on/off)

### Phase 2: Free Embeddings (Week 2) - Major Cost Reduction
**Goal**: Replace OpenAI embeddings with free Transformers.js
**Benefit**: 100% embedding cost elimination
**Cost Impact**: Major ($0.30/month → $0)
**Effort**: 8-10 hours
**Risk**: Medium (test quality carefully)

### Phase 3: Claude Haiku (Week 2-3) - AI Cost Reduction
**Goal**: Switch from Claude Sonnet to Haiku
**Benefit**: 67% reduction in AI generation costs
**Cost Impact**: Major ($12/month → $1.80)
**Effort**: 2-3 hours (config + testing)
**Risk**: Low-Medium (validate test quality)

---

## 📝 PHASE 1: Smart Filtering Implementation

### Task 1.1: Environment Variables
**File**: `.env.example`
**Status**: ⬜ TODO
**Estimated Time**: 15 minutes

**Actions**:
- [ ] Add `USE_SMART_FILTER` flag (default: false)
- [ ] Add `SMART_FILTER_MAX_PAGES` (default: 30)
- [ ] Add `SMART_FILTER_MIN_SCORE` (default: 0.3)
- [ ] Add individual strategy flags (labels, components, keywords, title)
- [ ] Add `SMART_FILTER_DEBUG` flag
- [ ] Add comprehensive comments explaining each setting

**Configuration to Add**:
```bash
# ===================================================================
# SMART FILTERING CONFIGURATION (Cost Optimization)
# ===================================================================
USE_SMART_FILTER=false
SMART_FILTER_MAX_PAGES=30
SMART_FILTER_MIN_SCORE=0.3
SMART_FILTER_USE_LABELS=true
SMART_FILTER_USE_COMPONENTS=true
SMART_FILTER_USE_KEYWORDS=true
SMART_FILTER_USE_TITLE=true
SMART_FILTER_DEBUG=false
```

---

### Task 1.2: Smart Filter Service
**File**: `src/services/confluence-smart-filter.service.ts`
**Status**: ⬜ TODO
**Estimated Time**: 3-4 hours

**Actions**:
- [ ] Create interface `FilterConfig`
- [ ] Create interface `FilterResult`
- [ ] Create interface `FilterMetrics`
- [ ] Implement `ConfluenceSmartFilterService` class
- [ ] Implement `filterPages()` method
- [ ] Implement `filterPagesWithMetrics()` method (includes timing)
- [ ] Implement `extractJiraContext()` - extract labels, components, keywords
- [ ] Implement `scorePage()` - calculate relevance score
- [ ] Implement `calculateLabelScore()` - exact label matching
- [ ] Implement `calculateComponentScore()` - fuzzy component matching
- [ ] Implement `calculateKeywordScore()` - keyword frequency
- [ ] Implement `calculateTitleScore()` - Jaccard similarity
- [ ] Implement `extractKeywords()` - NLP keyword extraction from Jira
- [ ] Add comprehensive JSDoc comments
- [ ] Add logging (respect silent mode)

**Key Methods**:
```typescript
class ConfluenceSmartFilterService {
  filterPages(jiraIssue, allPages, config?): FilterResult[]
  filterPagesWithMetrics(jiraIssue, allPages, config?): {results, metrics}
  private extractJiraContext(jiraIssue): {labels, components, keywords, title}
  private scorePage(page, context, config): {score, matchedBy[]}
  private calculateLabelScore(page, labels): number  // 0.0-1.0
  private calculateComponentScore(page, components): number
  private calculateKeywordScore(page, keywords): number
  private calculateTitleScore(page, title): number
  private extractKeywords(jiraIssue): string[]
}
```

**Scoring Algorithm** (Updated - Content-Based):
```
Since Jira may not have metadata, we extract technical keywords from content:

1. Extract technical keywords from Jira title + description:
   - Technical terms (API, service, component names)
   - Action verbs (create, update, delete, validate)
   - Domain entities (user, order, payment, invoice)
   - Framework/tech stack terms (React, LoopBack, PostgreSQL)

2. Score Confluence pages:
   Total Score = (Keyword Match × 0.5) +      # Primary signal
                 (Title Similarity × 0.3) +   # Important
                 (Label Match × 0.1) +        # Optional (if available)
                 (Component Match × 0.1)      # Optional (if available)

Threshold: Default 0.3 (configurable)

Note: This works even if Jira has NO metadata fields!
```

---

### Task 1.3: Export Service
**File**: `src/services/index.ts`
**Status**: ⬜ TODO
**Estimated Time**: 2 minutes

**Actions**:
- [ ] Add: `export * from './confluence-smart-filter.service';`

---

### Task 1.4: Unit Tests
**File**: `src/services/__tests__/confluence-smart-filter.service.unit.ts`
**Status**: ⬜ TODO
**Estimated Time**: 2-3 hours

**Test Coverage**:
- [ ] Test: `filterPages()` with exact label match
- [ ] Test: `filterPages()` with component matching
- [ ] Test: `filterPages()` with keyword matching
- [ ] Test: `filterPages()` with title similarity
- [ ] Test: `filterPages()` respects `maxPages` limit
- [ ] Test: `filterPages()` respects `minScoreThreshold`
- [ ] Test: `extractKeywords()` removes stopwords
- [ ] Test: `extractKeywords()` returns top 10 by frequency
- [ ] Test: `calculateLabelScore()` exact match
- [ ] Test: `calculateComponentScore()` fuzzy match
- [ ] Test: `calculateTitleScore()` Jaccard similarity
- [ ] Test: Score calculation with multiple matching strategies
- [ ] Test: Empty input handling
- [ ] Test: Jira issue with no labels/components
- [ ] Test: Metrics calculation accuracy

**Target Coverage**: >80%

---

### Task 1.5: Standalone Test Script
**File**: `test-smart-filter.ts`
**Status**: ⬜ TODO
**Estimated Time**: 1 hour

**Purpose**: Test smart filter in isolation before integration

**Actions**:
- [ ] Create script to load Jira ticket
- [ ] Fetch Confluence pages
- [ ] Run smart filter
- [ ] Display results with metrics
- [ ] Show top 10 filtered pages with scores
- [ ] Log match distribution (labels, components, keywords, title)
- [ ] Format output nicely for review

**Usage**:
```bash
# Set in .env:
# JIRA_TICKET_ID=BB-12345
# USE_SMART_FILTER=true

npm run test-smart-filter
```

**Expected Output**:
```
=============================================================
SMART FILTER RESULTS
=============================================================
Total pages: 52
Filtered pages: 28
Reduction: 46.2%
Average score: 0.51
Execution time: 342ms

Match Distribution:
  - Labels: 18 pages
  - Components: 22 pages
  - Keywords: 15 pages
  - Title: 8 pages

Top 10 Results:
1. Backend API Authentication Guide
   Score: 0.875 | Matched by: labels, components, keywords
2. JWT Token Implementation
   Score: 0.720 | Matched by: components, keywords, title
...
```

---

### Task 1.6: Add npm Script
**File**: `package.json`
**Status**: ⬜ TODO
**Estimated Time**: 2 minutes

**Actions**:
- [ ] Add to `scripts` section:
  ```json
  "test-smart-filter": "ts-node test-smart-filter.ts"
  ```

---

### Task 1.7: Testing & Validation
**Status**: ⬜ TODO
**Estimated Time**: 2-3 hours

**Test Cases**:
- [ ] Test with Jira ticket that has labels → verify label matching works
- [ ] Test with Jira ticket that has components → verify component matching
- [ ] Test with Jira ticket with rich description → verify keyword extraction
- [ ] Test with Jira ticket with minimal metadata → verify graceful handling
- [ ] Test with small Confluence space (<20 pages) → verify no over-filtering
- [ ] Test with large Confluence space (50+ pages) → verify reduction %
- [ ] A/B Test: Compare filtered results vs all pages → measure overlap
- [ ] Performance test: Measure filtering time with 100+ pages

**Acceptance Criteria**:
- ✅ Filtering reduces pages by 30-60%
- ✅ Top results are relevant to Jira ticket (manual review)
- ✅ Execution time <1 second for 50 pages
- ✅ No TypeScript compilation errors
- ✅ All unit tests pass
- ✅ Overlap with "all pages" approach >70%

---

## 📝 PHASE 2: Free Embeddings (Future)

### Task 2.1: Install Transformers.js
**Status**: ⬜ TODO (Phase 2)
**Estimated Time**: 5 minutes

```bash
npm install @xenova/transformers
```

---

### Task 2.2: Create Local Embedding Service
**File**: `src/services/local-embedding.service.ts`
**Status**: ⬜ TODO (Phase 2)
**Estimated Time**: 2-3 hours

**Actions**:
- [ ] Create `LocalEmbeddingService` class
- [ ] Implement `initialize()` - load model
- [ ] Implement `generateEmbedding(text)` - returns 384-dim vector
- [ ] Implement `generateEmbeddings(texts[])` - batch processing
- [ ] Add model caching
- [ ] Add progress logging
- [ ] Handle errors gracefully
- [ ] Match interface of existing `EmbeddingService`

**Model**: `Xenova/all-MiniLM-L6-v2`
**Dimensions**: 384 (vs 1536 for OpenAI)
**Quality**: ~95% as good as OpenAI for retrieval tasks

---

### Task 2.3: Update Service Factory
**File**: `src/utils/service-factory.util.ts`
**Status**: ⬜ TODO (Phase 2)
**Estimated Time**: 30 minutes

**Actions**:
- [ ] Add logic to select embedding provider
- [ ] Support `EMBEDDING_PROVIDER=local|openai`
- [ ] Return appropriate service based on config

---

### Task 2.4: Update PostgreSQL Vector Service
**File**: `src/services/postgres-vector.service.ts`
**Status**: ⬜ TODO (Phase 2)
**Estimated Time**: 1 hour

**Actions**:
- [ ] Update vector dimension handling (384 vs 1536)
- [ ] Ensure similarity search works with both dimensions
- [ ] Add migration logic if needed

---

### Task 2.5: GitHub Actions Caching
**File**: `action.yml`
**Status**: ⬜ TODO (Phase 2)
**Estimated Time**: 30 minutes

**Actions**:
- [ ] Add cache step for Transformers.js model
- [ ] Cache path: `~/.cache/transformers`
- [ ] Cache key: `transformers-all-MiniLM-L6-v2`

---

### Task 2.6: Testing Free Embeddings
**Status**: ⬜ TODO (Phase 2)
**Estimated Time**: 3-4 hours

**Test Cases**:
- [ ] Generate embeddings for 10 sample docs
- [ ] Compare retrieval results: OpenAI vs Local
- [ ] Measure quality: Precision@5, Recall@5
- [ ] Measure speed: Local vs API
- [ ] Test with 50+ documents
- [ ] Verify vector DB storage works
- [ ] End-to-end test: Jira → Filter → Local Embed → Search → Claude

**Acceptance Criteria**:
- ✅ Quality: >90% overlap with OpenAI results
- ✅ Speed: Acceptable (<30s for 30 pages)
- ✅ No errors in production workflow
- ✅ Generated tests are same quality

---

## 📝 PHASE 3: Claude Haiku Switch (Future)

### Task 3.1: Update Action Configuration
**File**: `action.yml`
**Status**: ⬜ TODO (Phase 3)
**Estimated Time**: 5 minutes

**Actions**:
- [ ] Change `aws_bedrock_model` default:
  ```yaml
  aws_bedrock_model:
    description: 'AWS Bedrock model identifier'
    required: false
    default: 'us.anthropic.claude-haiku-4-5-20250217-v1:0'
    # OLD: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
  ```

---

### Task 3.2: Testing Claude Haiku
**Status**: ⬜ TODO (Phase 3)
**Estimated Time**: 4-6 hours

**Test Cases**:
- [ ] Generate tests with Haiku for 10 tickets
- [ ] Generate tests with Sonnet for same 10 tickets (baseline)
- [ ] Compare quality (manual review)
- [ ] Compare speed (Haiku should be faster)
- [ ] Check test compilation (syntax errors?)
- [ ] Check test coverage (comprehensive?)
- [ ] Run generated tests (do they pass?)

**Acceptance Criteria**:
- ✅ Haiku tests compile without errors
- ✅ Quality score >7.0/10 (vs Sonnet >8.0)
- ✅ Speed: 2-3x faster than Sonnet
- ✅ Cost: 67% reduction verified
- ✅ No degradation in test coverage

---

## 🔄 Integration Plan (After Phase 1 Testing)

### Task 4.1: Integrate Smart Filter into Main Flow
**File**: `fetch-and-analyze.ts`
**Status**: ⬜ TODO (After Phase 1)
**Estimated Time**: 2-3 hours

**Integration Points**:
1. After fetching Jira ticket
2. After fetching all Confluence pages
3. Before embedding/indexing

**Changes**:
- [ ] Import `ConfluenceSmartFilterService`
- [ ] Check `USE_SMART_FILTER` flag
- [ ] If enabled, filter pages before indexing
- [ ] Log metrics (reduction %, avg score, time)
- [ ] Pass filtered pages to indexer instead of all pages
- [ ] Ensure backward compatibility (flag off = current behavior)

**Pseudo-code**:
```typescript
// After fetching pages
const allPages = []; // from Confluence

if (process.env.USE_SMART_FILTER === 'true' && ticketDetails) {
  const smartFilter = new ConfluenceSmartFilterService();
  const {results, metrics} = smartFilter.filterPagesWithMetrics(
    ticketDetails.issue,
    allPages
  );

  // Log metrics
  console.log(`Smart Filter: ${metrics.totalPages} → ${metrics.filteredPages} pages`);

  // Use filtered pages
  const pagesToIndex = results.map(r => r.page);
} else {
  const pagesToIndex = allPages;
}

// Continue with existing indexing logic
await indexer.indexPages(pagesToIndex);
```

---

### Task 4.2: Update GitHub Action Workflow
**File**: `action.yml`
**Status**: ⬜ TODO (After Phase 1)
**Estimated Time**: 30 minutes

**Actions**:
- [ ] Add input for `use_smart_filter`
- [ ] Add input for `smart_filter_max_pages`
- [ ] Add input for `smart_filter_min_score`
- [ ] Set defaults (false initially, true after validation)
- [ ] Pass to environment in workflow

---

### Task 4.3: Update Documentation
**Files**: `README.md`, `Setup.md`
**Status**: ⬜ TODO (After Phase 1)
**Estimated Time**: 1-2 hours

**Actions**:
- [ ] Document smart filtering feature
- [ ] Add configuration guide
- [ ] Add tuning guide (when to adjust thresholds)
- [ ] Add troubleshooting section
- [ ] Update cost estimates in README
- [ ] Add before/after comparison

---

## 📊 Success Metrics & Monitoring

### Metrics to Track

**Cost Metrics**:
- [ ] OpenAI embedding tokens per run
- [ ] Claude API tokens per run (input/output)
- [ ] GitHub Actions minutes per run
- [ ] Monthly cost total

**Quality Metrics**:
- [ ] Test quality score (0-10 scale)
- [ ] Test compilation success rate
- [ ] Test execution success rate
- [ ] Code coverage from generated tests

**Performance Metrics**:
- [ ] End-to-end execution time
- [ ] Filtering time
- [ ] Embedding time
- [ ] Claude generation time

**Smart Filter Metrics**:
- [ ] Pages filtered (reduction %)
- [ ] Average relevance score
- [ ] Match distribution (labels/components/keywords/title)
- [ ] Top-5 overlap with full set (accuracy)

---

## 🎯 Success Criteria

### Phase 1 (Smart Filtering)
- ✅ Filtering reduces pages by 30-60%
- ✅ Top results are relevant (manual review)
- ✅ No degradation in test quality
- ✅ Execution 20-30% faster
- ✅ Can toggle on/off without breaking

### Phase 2 (Free Embeddings)
- ✅ Embedding costs → $0
- ✅ Quality >90% of OpenAI results
- ✅ Execution time acceptable (<30s for embeddings)
- ✅ Generated tests same quality

### Phase 3 (Claude Haiku)
- ✅ AI generation costs reduced by 67%
- ✅ Test quality >7.0/10
- ✅ Tests compile and run successfully
- ✅ Faster execution (2-3x)

### Overall
- ✅ Total cost reduction: >70%
- ✅ Quality maintained: >7.0/10
- ✅ Speed improvement: >20%
- ✅ No breaking changes

---

## 🚀 Rollout Plan

### Week 1: Development & Testing
- Days 1-2: Implement smart filter service
- Days 3-4: Write tests, create test script
- Day 5: Standalone testing with real tickets

### Week 2: Integration
- Days 1-2: Integrate into main flow
- Days 3-4: Test in dev environment
- Day 5: A/B testing (smart filter on/off)

### Week 3: Production Rollout
- Day 1: Deploy with flag OFF (default)
- Days 2-3: Enable for 25% of runs
- Days 4-5: Monitor metrics, tune thresholds
- Week 4: Enable for 100% if successful

### Week 4-5: Free Embeddings (Phase 2)
- Implement local embedding service
- Test quality vs OpenAI
- Gradual rollout

### Week 5-6: Claude Haiku (Phase 3)
- Test quality with Haiku
- Compare vs Sonnet
- Switch if acceptable

---

## ⚠️ Risks & Mitigation

### Risk 1: Smart filter reduces quality
**Impact**: Medium
**Probability**: Low
**Mitigation**:
- A/B testing before full rollout
- Keep flag to disable
- Tune thresholds based on metrics

### Risk 2: Free embeddings lower quality
**Impact**: High
**Probability**: Low
**Mitigation**:
- Thorough quality testing
- Keep OpenAI as fallback option
- Gradual rollout with monitoring

### Risk 3: Claude Haiku produces worse tests
**Impact**: High
**Probability**: Medium
**Mitigation**:
- Extensive testing before switch
- Keep Sonnet as option
- Use Haiku for simpler tickets, Sonnet for complex

### Risk 4: Breaks existing workflows
**Impact**: High
**Probability**: Low
**Mitigation**:
- Feature flags for all changes
- Backward compatibility maintained
- Comprehensive testing

---

## 📁 Files to Create/Modify Summary

### New Files (Phase 1):
1. `IMPLEMENTATION_TODO.md` - This document
2. `src/services/confluence-smart-filter.service.ts` - Main service
3. `src/services/__tests__/confluence-smart-filter.service.unit.ts` - Tests
4. `test-smart-filter.ts` - Standalone test script

### Modified Files (Phase 1):
1. `.env.example` - Add smart filter config
2. `src/services/index.ts` - Export service
3. `package.json` - Add test script

### New Files (Phase 2):
1. `src/services/local-embedding.service.ts`
2. `src/services/__tests__/local-embedding.service.unit.ts`

### Modified Files (Phase 2):
1. `src/utils/service-factory.util.ts`
2. `src/services/postgres-vector.service.ts`
3. `action.yml` - Add caching

### Modified Files (Phase 3):
1. `action.yml` - Change default model

### Modified Files (Integration):
1. `fetch-and-analyze.ts` - Integrate smart filter
2. `action.yml` - Add inputs
3. `README.md` - Update docs
4. `Setup.md` - Update setup guide

---

## 📞 Quick Reference Commands

```bash
# Install dependencies (if needed)
npm install @xenova/transformers

# Run unit tests
npm test

# Run standalone smart filter test
npm run test-smart-filter

# Run full workflow (with smart filter)
USE_SMART_FILTER=true npm run start

# Build TypeScript
npm run build

# Lint & format
npm run lint
npm run lint:fix
```

---

## 🎓 Learning Resources

### Smart Filtering
- Research doc: `RESEARCH_ANALYSIS.md` (Section: Smart Filtering)
- Implementation plan: This document

### Text Chunking
- Semantic chunking best practices
- LangChain recursive splitter approach

### Free Embeddings
- Transformers.js: https://huggingface.co/docs/transformers.js
- Model: https://huggingface.co/Xenova/all-MiniLM-L6-v2

### Claude Models
- Haiku vs Sonnet comparison
- Cost calculator: https://docs.anthropic.com/pricing

---

## ✅ Current Status

**Phase 1 - Smart Filtering**: 🔨 IN PROGRESS
- [x] Planning complete
- [x] TODO document created
- [ ] Environment variables
- [ ] Service implementation
- [ ] Tests
- [ ] Standalone test script
- [ ] Validation

**Phase 2 - Free Embeddings**: ⏳ PLANNED

**Phase 3 - Claude Haiku**: ⏳ PLANNED

---

## 📝 Notes & Context

### Key Decisions Made

1. **PostgreSQL costs don't matter** - Using Docker, ephemeral, no hosting cost
2. **Smart filtering is worth it** - Quality > Cost savings (modest $0.12/month)
3. **Free embeddings = biggest win** - Eliminates $0.30/month (100% of embedding costs)
4. **Haiku = second biggest win** - Reduces AI costs by 67% ($10.20/month savings)
5. **Incremental approach** - Build and test each phase separately
6. **Feature flags everywhere** - Can toggle features on/off independently
7. **⚠️ IMPORTANT**: Jira may not have metadata (labels/components) - Extract technical keywords from title + description content using NLP instead

### Why This Approach?

- ✅ **Low risk**: Each phase is independent, can rollback easily
- ✅ **High value**: 76% total cost reduction if all phases succeed
- ✅ **Quality focused**: Smart filter improves retrieval accuracy
- ✅ **Testable**: Can validate each phase before moving to next
- ✅ **Reversible**: Feature flags allow disabling if issues arise

### Important Reminders

- Always test with real Jira tickets (not synthetic data)
- Manually review generated test quality (don't rely only on scores)
- Monitor metrics closely during rollout
- Keep backward compatibility (existing workflows must still work)
- Document everything (future you will thank you)

---

**Last Updated**: December 17, 2025
**Next Update**: After Phase 1 completion

---

## 🚦 Ready to Implement!

Follow tasks in order:
1. ✅ Read this TODO document (you are here!)
2. → Start with Task 1.1 (Environment variables)
3. → Continue with Task 1.2 (Smart filter service)
4. → ... follow the checklist!

Let's build this! 🚀
