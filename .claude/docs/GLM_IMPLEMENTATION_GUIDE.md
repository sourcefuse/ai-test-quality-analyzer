# GLM Implementation Guide

## Overview

This document describes the changes made to the Unit Test Generation GitHub Action to support GLM (Gateway Language Model) as an alternative AI provider to AWS Bedrock.

## Background

Previously, the action only supported AWS Bedrock for AI-powered test generation. The GLM integration allows organizations to use their own GLM endpoints, providing flexibility in AI provider selection.

## Architecture Changes

### AI Provider Selection

The action now supports two AI providers controlled by the `ai_type` input:

| ai_type | Provider | Description |
|---------|----------|-------------|
| `1` | AWS Bedrock | Default. Uses AWS credentials and Bedrock API |
| `2` | GLM | Uses custom GLM endpoint with auth token |

### Configuration Flow

```
Workflow Trigger
       │
       ▼
┌──────────────────┐
│  Check ai_type   │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
ai_type=1   ai_type=2
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Bedrock │ │   GLM   │
│   API   │ │   API   │
└─────────┘ └─────────┘
```

## Files Changed

### 1. action.yml

**New Inputs Added:**

```yaml
ai_type:
  description: 'AI provider type: 1 = claude_with_bedrock, 2 = claude_with_glm'
  required: false
  default: '1'

anthropic_base_url:
  description: 'Anthropic/GLM base URL (for GLM integration)'
  required: false

anthropic_auth_token:
  description: 'Anthropic/GLM auth token (for GLM integration)'
  required: false

embedding_dimensions:
  description: 'Embedding dimensions for vector DB (affects cache key)'
  required: false
  default: '1536'
```

**Removed Inputs:**
- `claude_code_use_bedrock` (replaced by `ai_type`)

**Changed Defaults:**
- `target_branch`: Changed from `'main'` to `'dev'`

**New Outputs Added:**
```yaml
outputs:
  pr_url:
    description: 'URL of the created pull request'
  pr_number:
    description: 'Number of the created pull request'
  pr_action:
    description: 'Action taken on PR (created/updated)'
```

**New Step - Auto PR Creation:**
Step 6 now automatically creates a Pull Request after committing generated tests.

**Conditional Step Execution:**

The requirements generation step is now split into two conditional steps:

```yaml
# Step 3 - GLM Provider
- name: Step 3 - Create Requirements document (GLM)
  if: inputs.ai_type == '2'
  # Uses ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN

# Step 3 - Bedrock Provider
- name: Step 3 - Create Requirements document (Bedrock)
  if: inputs.ai_type == '1' || inputs.ai_type == ''
  # Uses AWS credentials
```

### 2. templates/generate-unit-testcases.yml

**Updated Workflow Template:**

```yaml
# Required Secrets (for GLM - ai_type=2):
# - UT_GENERATE_ANTHROPIC_BASE_URL
# - UT_GENERATE_ANTHROPIC_AUTH_TOKEN

# Required Variables:
# - UT_GENERATE_AI_TYPE (1 = bedrock, 2 = glm)

- name: Generate Unit Test Cases with AI
  uses: sourcefuse/ai-test-quality-analyzer@UT-V2.0
  with:
    # ... other inputs ...
    anthropic_base_url: ${{ secrets.UT_GENERATE_ANTHROPIC_BASE_URL }}
    anthropic_auth_token: ${{ secrets.UT_GENERATE_ANTHROPIC_AUTH_TOKEN }}
    ai_type: ${{ secrets.UT_GENERATE_AI_TYPE }}
```

### 3. GITHUB_CONFIGURATION.json

**New Secrets Added:**

```json
{
  "name": "ANTHROPIC_BASE_URL",
  "env_var": "ANTHROPIC_BASE_URL",
  "description": "GLM/Anthropic API base URL",
  "example": "https://your-glm-endpoint.com",
  "sensitive": true
},
{
  "name": "ANTHROPIC_AUTH_TOKEN",
  "env_var": "ANTHROPIC_AUTH_TOKEN",
  "description": "GLM/Anthropic authentication token",
  "example": "your-auth-token",
  "sensitive": true
}
```

**New Variables Added:**

```json
{
  "name": "AI_TYPE",
  "env_var": "AI_TYPE",
  "description": "AI provider type: 1 = claude_with_bedrock, 2 = claude_with_glm",
  "example": "2",
  "default": "1"
}
```

### 4. .env.example

**New Configuration Section:**

```bash
# AI PROVIDER CONFIGURATION
# AI Provider Type
# 1 = claude_with_bedrock (AWS Bedrock - default)
# 2 = claude_with_glm (GLM API)
AI_TYPE=1

# GLM Configuration (required when AI_TYPE=2)
ANTHROPIC_BASE_URL=
ANTHROPIC_AUTH_TOKEN=
```

## Migration Scripts

### setup-glm-migration.sh

Interactive script to assist with GLM migration:

```bash
./scripts/setup-glm-migration.sh
```

**What it does:**
1. Reads GLM configuration from local `.env` file
2. Validates required values (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN)
3. Prompts for target repository name
4. Creates GitHub secrets automatically using `gh` CLI
5. Removes unused secrets (AWS_BEDROCK_MODEL, DOCKER_USERNAME, DOCKER_PASSWORD)

### setup-github-secrets.sh

General script to set up all GitHub secrets/variables:

```bash
./scripts/setup-github-secrets.sh
```

**Creates both prefixes:**
- `UT_QUALITY_*` - For quality check workflow
- `UT_GENERATE_*` - For test generation workflow

## GitHub Repository Configuration

### For GLM Integration

**Secrets to Create:**

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `UT_GENERATE_ANTHROPIC_BASE_URL` | `https://your-glm-endpoint.com` | GLM API endpoint |
| `UT_GENERATE_ANTHROPIC_AUTH_TOKEN` | `your-token` | GLM authentication token |

**Variables to Create:**

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `UT_GENERATE_AI_TYPE` | `2` | Set to 2 for GLM |
| `UT_GENERATE_JIRA_PROJECT_KEY` | `BB` | JIRA project key |
| `UT_GENERATE_CONFLUENCE_SPACE_KEY` | `BB` | Confluence space key |
| `UT_GENERATE_CONFLUENCE_UPLOAD_SPACE_KEY` | `BB` | Confluence upload space key |

**Important: vars vs secrets**

Non-sensitive identifiers like `JIRA_PROJECT_KEY`, `CONFLUENCE_SPACE_KEY`, and `CONFLUENCE_UPLOAD_SPACE_KEY` must be created as **variables** (using `vars.`), not secrets. The `setup-github-secrets.sh` script creates them as variables.

```yaml
# Correct - use vars for non-sensitive values
jira_project_key: ${{ vars.UT_GENERATE_JIRA_PROJECT_KEY }}
confluence_space_key: ${{ vars.UT_GENERATE_CONFLUENCE_SPACE_KEY }}

# Wrong - do NOT use secrets for these
jira_project_key: ${{ secrets.UT_GENERATE_JIRA_PROJECT_KEY }}  # Will fail!
```

### For AWS Bedrock (Default)

**Secrets Required:**

| Secret Name | Description |
|-------------|-------------|
| `UT_GENERATE_AWS_REGION_BEDROCK` | AWS region (e.g., us-east-2) |
| `UT_GENERATE_AWS_ACCESS_KEY_BEDROCK` | AWS access key |
| `UT_GENERATE_AWS_SECRET_KEY_BEDROCK` | AWS secret key |

**Variables:**

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `UT_GENERATE_AI_TYPE` | `1` | Set to 1 for Bedrock (default) |

## Environment Variables

### GLM Mode (ai_type=2)

```bash
# Required
ANTHROPIC_BASE_URL=https://your-glm-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-auth-token
AI_TYPE=2

# Optional (for model selection)
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

### Bedrock Mode (ai_type=1)

```bash
# Required
AWS_REGION_BEDROCK=us-east-2
AWS_ACCESS_KEY_BEDROCK=AKIA...
AWS_SECRET_KEY_BEDROCK=...
AI_TYPE=1
```

## Usage Examples

### Triggering Workflow with GLM

```yaml
# In your workflow file
- name: Generate Unit Tests
  uses: sourcefuse/ai-test-quality-analyzer@UT-V2.0
  with:
    jira_url: ${{ secrets.UT_GENERATE_JIRA_URL }}
    jira_email: ${{ secrets.UT_GENERATE_JIRA_EMAIL }}
    jira_api_token: ${{ secrets.UT_GENERATE_JIRA_API_TOKEN }}
    jira_ticket_id: BB-123
    confluence_url: ${{ secrets.UT_GENERATE_CONFLUENCE_URL }}
    confluence_email: ${{ secrets.UT_GENERATE_CONFLUENCE_EMAIL }}
    confluence_api_token: ${{ secrets.UT_GENERATE_CONFLUENCE_API_TOKEN }}
    confluence_space_key: ${{ vars.UT_GENERATE_CONFLUENCE_SPACE_KEY }}
    # GLM Configuration
    anthropic_base_url: ${{ secrets.UT_GENERATE_ANTHROPIC_BASE_URL }}
    anthropic_auth_token: ${{ secrets.UT_GENERATE_ANTHROPIC_AUTH_TOKEN }}
    ai_type: '2'  # Use GLM
```

### Manual Workflow Dispatch

When triggering manually via GitHub Actions UI:
1. Go to Actions tab
2. Select "Generate Unit Test Cases Via AI"
3. Click "Run workflow"
4. Enter JIRA ticket ID
5. Select target branch
6. Run workflow

The `ai_type` is configured via repository variables/secrets, not workflow dispatch inputs.

## Rollback to AWS Bedrock

To switch back to AWS Bedrock:

1. Update repository variable:
   ```bash
   gh variable set UT_GENERATE_AI_TYPE --body "1" --repo owner/repo
   ```

2. Ensure AWS secrets are configured:
   - `UT_GENERATE_AWS_REGION_BEDROCK`
   - `UT_GENERATE_AWS_ACCESS_KEY_BEDROCK`
   - `UT_GENERATE_AWS_SECRET_KEY_BEDROCK`

3. Re-run workflow

## Troubleshooting

### Common Issues

**Issue: "Missing required environment variable: ANTHROPIC_BASE_URL"**
- Cause: GLM secrets not configured but ai_type=2
- Solution: Create `UT_GENERATE_ANTHROPIC_BASE_URL` secret

**Issue: "Authentication failed"**
- Cause: Invalid or expired GLM auth token
- Solution: Verify token and update `UT_GENERATE_ANTHROPIC_AUTH_TOKEN` secret

**Issue: "Connection refused to GLM endpoint"**
- Cause: Incorrect endpoint URL or network issues
- Solution: Verify `ANTHROPIC_BASE_URL` is accessible from GitHub Actions runners

**Issue: "Missing required environment variable: CONFLUENCE_SPACE_KEY" or "JIRA_PROJECT_KEY not set"**
- Cause: Using `secrets.UT_GENERATE_CONFLUENCE_SPACE_KEY` instead of `vars.`
- Root cause: These are non-sensitive values created as variables by setup-github-secrets.sh
- Solution: Update workflow template to use `vars.` prefix:
  ```yaml
  confluence_space_key: ${{ vars.UT_GENERATE_CONFLUENCE_SPACE_KEY }}
  jira_project_key: ${{ vars.UT_GENERATE_JIRA_PROJECT_KEY }}
  ```

**Issue: PostgreSQL "relation already exists" errors during cache restore**
- Cause: pg_dump included schema statements that conflict with Docker init scripts
- Solution: Fixed in UT-V2.0 - now uses `--data-only` flag and TRUNCATE before restore

### Debug Steps

1. Check workflow logs for the "Create .env file" step
2. Verify secrets are set in repository settings
3. Test GLM endpoint connectivity independently
4. Check AI_TYPE value is correctly set

## Additional Changes

### Docker Services

The action also includes Docker services for:
- PostgreSQL with pgvector (for RAG-based search)
- Presidio (for PII detection)

These are controlled by `enable_docker_services: 'true'` input.

### Docker Image Migration to ghcr.io

As part of the UT-V2.0 release, Docker images were migrated from Microsoft Container Registry to GitHub Container Registry for faster pulls and better reliability.

**Presidio Images Changed:**

| Service | Old Image | New Image |
|---------|-----------|-----------|
| Presidio Analyzer | `mcr.microsoft.com/presidio-analyzer:latest` | `ghcr.io/sourcefuse/presidio-analyzer:latest` |
| Presidio Anonymizer | `mcr.microsoft.com/presidio-anonymizer:latest` | `ghcr.io/sourcefuse/presidio-anonymizer:latest` |

**Why ghcr.io?**
- Faster image pulls from GitHub Actions runners
- Better integration with GitHub ecosystem
- Controlled versioning and tagging
- No rate limiting issues with mcr.microsoft.com

**action.yml Changes:**

```yaml
# Old configuration
services:
  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer:latest
  presidio-anonymizer:
    image: mcr.microsoft.com/presidio-anonymizer:latest

# New configuration
services:
  presidio-analyzer:
    image: ghcr.io/sourcefuse/presidio-analyzer:latest
  presidio-anonymizer:
    image: ghcr.io/sourcefuse/presidio-anonymizer:latest
```

**Note:** The Presidio images were rebuilt from the official Microsoft images and pushed to ghcr.io with the same configuration. No functional changes were made to the Presidio services.

### Caching

PostgreSQL data is cached daily to speed up subsequent runs:
- Cache key format: `pgvector-{space_key}-dim{dimensions}-{YYYY-MM-DD}`
- Cache refreshes daily to pick up Confluence changes
- Falls back to previous day's cache if available via `restore-keys`

**Cache Implementation Details:**

```yaml
# Cache key includes embedding dimensions for compatibility
key: pgvector-${{ inputs.confluence_space_key }}-dim${{ inputs.embedding_dimensions }}-${{ steps.cache-date.outputs.date }}
restore-keys: |
  pgvector-${{ inputs.confluence_space_key }}-dim${{ inputs.embedding_dimensions }}-
  pgvector-${{ inputs.confluence_space_key }}-
```

**Cache Restore Process:**
1. Uses `pg_dump --data-only` to avoid schema conflicts (Docker init scripts create schema)
2. Runs `TRUNCATE TABLE` before restore to clear existing data
3. Uses `--set ON_ERROR_STOP=off` to ignore minor errors during restore

**Cache Behavior:**

| Scenario | Key | Action |
|----------|-----|--------|
| Day 1, Run 1 | `pgvector-BB-dim1536-2026-01-19` | Miss → Fetch from Confluence → Save |
| Day 1, Run 2 | `pgvector-BB-dim1536-2026-01-19` | Hit → Load from cache → Skip fetch |
| Day 2, Run 1 | `pgvector-BB-dim1536-2026-01-20` | Miss → Restore fallback → Load → Skip fetch |
| Day 2, Run 2 | `pgvector-BB-dim1536-2026-01-20` | Hit → Load from cache → Skip fetch |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| UT-V2.0 | 2026-01-19 | GLM support, ghcr.io migration, daily caching, auto PR creation, vars/secrets fix |
| UT-V1.x | Previous | AWS Bedrock only |

**UT-V2.0 Detailed Changes:**
- Added `ai_type` input (1=Bedrock, 2=GLM)
- Added `anthropic_base_url` and `anthropic_auth_token` inputs
- Removed `claude_code_use_bedrock` input
- Changed `target_branch` default from 'main' to 'dev'
- Added auto PR creation (Step 6) with outputs: `pr_url`, `pr_number`, `pr_action`
- Migrated Presidio images to ghcr.io/sourcefuse
- Implemented daily PostgreSQL cache rotation
- Fixed pg_dump to use `--data-only` to avoid schema conflicts
- Fixed vars vs secrets for non-sensitive configuration keys

## Related Documentation

- [MIGRATION_BEDROCK_TO_GLM.md](../../MIGRATION_BEDROCK_TO_GLM.md) - Step-by-step migration guide
- [GITHUB_CONFIGURATION.json](../../GITHUB_CONFIGURATION.json) - Full secrets/variables configuration
- [setup-glm-migration.sh](../../scripts/setup-glm-migration.sh) - Automated migration script
