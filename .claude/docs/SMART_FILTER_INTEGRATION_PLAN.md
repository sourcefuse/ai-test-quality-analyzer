# Smart Filter + PostgreSQL Vector Database Integration Plan

## Current Database Schema

### Table: `confluence_documents`
```sql
- id (SERIAL PRIMARY KEY)
- project_key (VARCHAR(50))          -- JIRA project key (e.g., "TEL")
- page_id (VARCHAR(255) UNIQUE)      -- Confluence page ID
- title (VARCHAR(500))               -- Page title
- content (TEXT)                     -- Full page content
- url (VARCHAR(1000))                -- Page URL
- source (VARCHAR(50))               -- Default: 'confluence'
- last_modified (TIMESTAMP)          -- Page last modified date
- created_at (TIMESTAMP)             -- Record creation time
- expires_at (TIMESTAMP)             -- Cache expiration (24 hours)
```

### Table: `document_chunks`
```sql
- id (SERIAL PRIMARY KEY)
- document_id (INTEGER)              -- Foreign key to confluence_documents
- text (TEXT)                        -- Chunk text
- embedding (vector(1536))           -- OpenAI embedding
- metadata (JSONB)                   -- Flexible metadata storage
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)             -- Cache expiration
```

---

## Integration Strategy: Smart Filter BEFORE Embedding

### Current Flow (Without Smart Filter)
```
1. Fetch Jira ticket (TEL-13385)
2. Fetch ALL Confluence pages (1388 pages)
3. Chunk ALL pages → 5000+ chunks
4. Generate embeddings for ALL chunks → $$$
5. Store in PostgreSQL
6. Vector search for relevant chunks
```

**Cost**: ~1388 pages × 3-5 chunks = ~5000 chunks × $0.02/1M tokens = **$0.30+ per run**

### NEW Flow (With Smart Filter)
```
1. Fetch Jira ticket (TEL-13385)
2. Fetch ALL Confluence pages (1388 pages)
3. ✨ SMART FILTER: Reduce to top 30 relevant pages
4. Chunk ONLY filtered pages → ~100-150 chunks
5. Generate embeddings for filtered chunks → $
6. Store in PostgreSQL with filter metadata
7. Vector search for relevant chunks
```

**Cost**: ~30 pages × 3-5 chunks = ~120 chunks × $0.02/1M tokens = **~$0.01 per run**
**Savings**: **67% cost reduction** + better accuracy (less noise)

---

## Enhanced Schema: Add Smart Filter Metadata

### Option 1: Add Columns to `confluence_documents` (Recommended)

```sql
ALTER TABLE confluence_documents
ADD COLUMN ticket_id VARCHAR(50),              -- JIRA ticket this relates to (e.g., "TEL-13385")
ADD COLUMN relevance_score DECIMAL(5,3),       -- Smart filter score (0.0-1.0)
ADD COLUMN matched_by TEXT[],                  -- Array: ['ticketId', 'keywords', 'title']
ADD COLUMN filter_metadata JSONB;              -- Detailed scoring breakdown
```

**Example Data:**
```json
{
  "ticket_id": "TEL-13385",
  "title": "Survey Configuration API Design",
  "relevance_score": 0.875,
  "matched_by": ["ticketId", "keywords", "title"],
  "filter_metadata": {
    "ticketIdScore": 1.0,
    "keywordScore": 0.85,
    "titleScore": 0.62,
    "matchedKeywords": ["survey", "configuration", "organization", "program"]
  }
}
```

### Option 2: Use Existing `metadata` JSONB Column

Store everything in the `metadata` column of `document_chunks`:
```json
{
  "ticketId": "TEL-13385",
  "relevanceScore": 0.875,
  "matchedBy": ["ticketId", "keywords", "title"],
  "filterDetails": {
    "ticketIdScore": 1.0,
    "keywordScore": 0.85
  },
  "chunkIndex": 2,
  "totalChunks": 4
}
```

**Recommendation**: Use **Option 1** (add columns) for better queryability and performance.

---

## Implementation Steps

### Step 1: Update Database Schema

**File**: `src/services/postgres-vector.service.ts`

Add new columns to `createTables()` method:

```typescript
// In createTables() method, after creating confluence_documents table:

// Add smart filter columns
await client.query(`
  DO $$
  BEGIN
    -- Add ticket_id column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'confluence_documents'
      AND column_name = 'ticket_id'
    ) THEN
      ALTER TABLE confluence_documents
      ADD COLUMN ticket_id VARCHAR(50);
    END IF;

    -- Add relevance_score column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'confluence_documents'
      AND column_name = 'relevance_score'
    ) THEN
      ALTER TABLE confluence_documents
      ADD COLUMN relevance_score DECIMAL(5,3);
    END IF;

    -- Add matched_by array column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'confluence_documents'
      AND column_name = 'matched_by'
    ) THEN
      ALTER TABLE confluence_documents
      ADD COLUMN matched_by TEXT[];
    END IF;

    -- Add filter_metadata JSONB column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'confluence_documents'
      AND column_name = 'filter_metadata'
    ) THEN
      ALTER TABLE confluence_documents
      ADD COLUMN filter_metadata JSONB;
    END IF;
  END $$;
`);

console.log('   ✅ Smart filter columns created/verified');
```

### Step 2: Update `upsertDocument()` Method

**File**: `src/services/postgres-vector.service.ts`

Update the method signature and SQL:

```typescript
async upsertDocument(
  pageId: string,
  title: string,
  content: string,
  url: string,
  projectKey?: string,
  ticketId?: string,              // NEW
  relevanceScore?: number,        // NEW
  matchedBy?: string[],           // NEW
  filterMetadata?: any,           // NEW
): Promise<number> {
  const client = await this.pool!.connect();

  try {
    const query = `
      INSERT INTO confluence_documents (
        page_id, title, content, url, project_key,
        ticket_id, relevance_score, matched_by, filter_metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (page_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        url = EXCLUDED.url,
        project_key = EXCLUDED.project_key,
        ticket_id = EXCLUDED.ticket_id,
        relevance_score = EXCLUDED.relevance_score,
        matched_by = EXCLUDED.matched_by,
        filter_metadata = EXCLUDED.filter_metadata,
        last_modified = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '1 day'
      RETURNING id
    `;

    const values = [
      pageId,
      title,
      content,
      url,
      projectKey || null,
      ticketId || null,
      relevanceScore || null,
      matchedBy || null,
      filterMetadata ? JSON.stringify(filterMetadata) : null,
    ];

    const result = await client.query(query, values);
    return result.rows[0].id;
  } finally {
    client.release();
  }
}
```

### Step 3: Integrate Smart Filter in Main Flow

**File**: `process-jira-with-rag-search.ts` or `fetch-and-analyze.ts`

**Current flow** (simplified):
```typescript
// 1. Fetch Confluence pages
const pages = await confluenceService.listPages({spaceKey});

// 2. Process ALL pages
for (const page of pages) {
  const documentId = await vectorService.upsertDocument(
    page.id,
    page.title,
    pageContent,
    pageUrl,
    projectKey
  );

  // Chunk and embed
  const chunks = chunkDocument(pageContent);
  for (const chunk of chunks) {
    const embedding = await embeddingService.generateEmbedding(chunk);
    await vectorService.insertChunk(documentId, chunk, embedding);
  }
}
```

**NEW flow** (with smart filter):
```typescript
// 1. Fetch Jira ticket
const jiraTicket = await jiraService.getTicketDetails({ticketId});

// 2. Fetch ALL Confluence pages
const allPages = await confluenceService.listPages({spaceKey});
console.log(`📄 Fetched ${allPages.length} total Confluence pages`);

// 3. ✨ SMART FILTER - Reduce to top relevant pages
const smartFilter = new ConfluenceSmartFilterService();
const {results: filteredPages, metrics} = smartFilter.filterPagesWithMetrics(
  jiraTicket.issue,
  allPages,
  {
    maxPages: parseInt(process.env.SMART_FILTER_MAX_PAGES || '30'),
    minScoreThreshold: parseFloat(process.env.SMART_FILTER_MIN_SCORE || '0.3'),
  }
);

console.log(`✨ Smart filter: ${allPages.length} → ${filteredPages.length} pages`);
console.log(`💰 Cost reduction: ${metrics.reductionPercentage.toFixed(1)}%`);
console.log(`🎯 Ticket ID: ${metrics.ticketId}`);

// 4. Process ONLY filtered pages (with metadata)
for (const filterResult of filteredPages) {
  const page = filterResult.page;
  const pageContent = extractPlainText(page.body?.storage?.value || '');
  const pageUrl = `${confluenceConfig.host}${page._links?.webui || ''}`;

  // Store document with smart filter metadata
  const documentId = await vectorService.upsertDocument(
    page.id,
    page.title,
    pageContent,
    pageUrl,
    projectKey,
    metrics.ticketId,              // NEW: Ticket ID
    filterResult.score,             // NEW: Relevance score
    filterResult.matchedBy,         // NEW: Match strategies
    filterResult.details,           // NEW: Detailed scoring
  );

  // Chunk and embed ONLY filtered pages
  const chunks = chunkDocument(pageContent);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embeddingService.generateEmbedding(chunks[i]);

    // Add chunk metadata
    const chunkMetadata = {
      ticketId: metrics.ticketId,
      relevanceScore: filterResult.score,
      chunkIndex: i,
      totalChunks: chunks.length,
    };

    await vectorService.insertChunk(documentId, chunks[i], embedding, chunkMetadata);
  }
}

console.log('✅ Filtered pages stored in PostgreSQL with embeddings');
```

### Step 4: Add Query Methods for Smart Filter Metadata

**File**: `src/services/postgres-vector.service.ts`

Add methods to query by ticket ID and relevance score:

```typescript
/**
 * Get documents by ticket ID
 */
async getDocumentsByTicketId(ticketId: string): Promise<any[]> {
  const query = `
    SELECT
      id, page_id, title, url,
      relevance_score, matched_by, filter_metadata
    FROM confluence_documents
    WHERE ticket_id = $1
    AND expires_at > CURRENT_TIMESTAMP
    ORDER BY relevance_score DESC
  `;

  const result = await this.pool!.query(query, [ticketId]);
  return result.rows;
}

/**
 * Get high-scoring documents (above threshold)
 */
async getHighScoringDocuments(
  ticketId: string,
  minScore: number = 0.5
): Promise<any[]> {
  const query = `
    SELECT
      id, page_id, title, url,
      relevance_score, matched_by, filter_metadata
    FROM confluence_documents
    WHERE ticket_id = $1
    AND relevance_score >= $2
    AND expires_at > CURRENT_TIMESTAMP
    ORDER BY relevance_score DESC
  `;

  const result = await this.pool!.query(query, [ticketId, minScore]);
  return result.rows;
}

/**
 * Get documents by match strategy
 */
async getDocumentsByMatchType(
  ticketId: string,
  matchType: 'ticketId' | 'keywords' | 'title' | 'labels' | 'components'
): Promise<any[]> {
  const query = `
    SELECT
      id, page_id, title, url,
      relevance_score, matched_by
    FROM confluence_documents
    WHERE ticket_id = $1
    AND $2 = ANY(matched_by)
    AND expires_at > CURRENT_TIMESTAMP
    ORDER BY relevance_score DESC
  `;

  const result = await this.pool!.query(query, [ticketId, matchType]);
  return result.rows;
}
```

---

## Benefits of This Approach

### 1. Cost Reduction
- **67% fewer embeddings**: 30 pages instead of 1388
- **Faster processing**: Less API calls to OpenAI
- **Lower PostgreSQL storage**: Fewer chunks stored

### 2. Better Quality
- **Pre-filtered relevance**: Only store highly relevant pages
- **Metadata tracking**: Know WHY each page was selected
- **Ticket traceability**: Link documents to specific Jira tickets

### 3. Performance
- **Faster vector search**: Smaller index = faster queries
- **Better recall**: Less noise in search results
- **Query flexibility**: Filter by ticket ID, score, or match type

### 4. Debugging & Analytics
- **Filter metrics**: Track reduction percentage, average scores
- **Match distribution**: See which strategies work best
- **Score breakdown**: Understand individual page scoring

---

## Example Queries After Implementation

### Query 1: Get all documents for a ticket
```sql
SELECT title, relevance_score, matched_by
FROM confluence_documents
WHERE ticket_id = 'TEL-13385'
ORDER BY relevance_score DESC;
```

### Query 2: Get pages that matched by ticket ID
```sql
SELECT title, relevance_score
FROM confluence_documents
WHERE ticket_id = 'TEL-13385'
AND 'ticketId' = ANY(matched_by);
```

### Query 3: Get detailed scoring breakdown
```sql
SELECT
  title,
  relevance_score,
  filter_metadata->>'ticketIdScore' as ticket_id_score,
  filter_metadata->>'keywordScore' as keyword_score,
  filter_metadata->'matchedKeywords' as keywords
FROM confluence_documents
WHERE ticket_id = 'TEL-13385'
ORDER BY relevance_score DESC;
```

---

## Migration & Rollout Plan

### Phase 1: Schema Update (No Breaking Changes)
1. Add new columns to `confluence_documents` table
2. Deploy updated `postgres-vector.service.ts`
3. **Backward compatible**: Existing code still works

### Phase 2: Smart Filter Integration
1. Update main flow to use smart filter
2. Set `USE_SMART_FILTER=true` in `.env`
3. Test with 2-3 Jira tickets
4. Compare results with/without filtering

### Phase 3: Validation
1. Verify filtered pages are relevant
2. Check embedding cost reduction
3. Measure search quality improvement
4. Tune `SMART_FILTER_MIN_SCORE` if needed

### Phase 4: Production
1. Enable smart filter for all new runs
2. Monitor PostgreSQL storage usage
3. Track cost savings over time

---

## Configuration Summary

### Environment Variables (Already Configured)
```bash
# Smart Filter
USE_SMART_FILTER=true
SMART_FILTER_MAX_PAGES=30
SMART_FILTER_MIN_SCORE=0.3
SMART_FILTER_USE_KEYWORDS=true
SMART_FILTER_USE_TITLE=true
SMART_FILTER_USE_LABELS=true
SMART_FILTER_USE_COMPONENTS=true
SMART_FILTER_DEBUG=true

# PostgreSQL
USE_POSTGRES_VECTOR_DB=true
CHECK_PG_BEFORE_CONFLUENCE_FETCH=true
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=postgres-pgvector
DATABASE_USER=postgres
DATABASE_PASSWORD=admin
```

---

## Next Steps

1. ✅ **Smart filter service created** (already done)
2. ✅ **Test script created** (`npm run test-smart-filter`)
3. ⏭️ **Update PostgreSQL schema** (add smart filter columns)
4. ⏭️ **Update `upsertDocument()` method** (accept filter metadata)
5. ⏭️ **Integrate into main flow** (filter BEFORE embedding)
6. ⏭️ **Test end-to-end** with real Jira ticket
7. ⏭️ **Measure cost savings** and accuracy improvement

---

**Ready to implement?** Start with Step 1 (updating the database schema) and I'll help you through each step!
