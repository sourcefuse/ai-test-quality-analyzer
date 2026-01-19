# Migration Guide: AWS Bedrock to GLM

This document outlines all steps required to migrate from AWS Bedrock to GLM for the Unit Test Generation workflow.

## Prerequisites

- Access to GitHub repository settings
- GLM API endpoint URL
- GLM authentication token

---

## Quick Setup (Recommended)

### Option A: Using Setup Script

Run the migration script to automatically update your local `.env` and `.env.example` files:

```bash
# Make the script executable
chmod +x setup-glm-migration.sh

# Run the migration script
./setup-glm-migration.sh
```

The script will:
1. Prompt for your GLM endpoint URL
2. Prompt for your GLM authentication token
3. Ask which AI provider to use (Bedrock or GLM)
4. Update `.env` and `.env.example` files automatically
5. Display next steps for GitHub Actions configuration

### Option B: Manual Setup

Follow the steps below to manually configure the migration.

---

## Step 1: Add New GitHub Secrets

Navigate to: **Repository Settings → Secrets and variables → Actions → Secrets**

Add the following new secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `UT_GENERATE_ANTHROPIC_BASE_URL` | GLM API endpoint URL | `https://your-glm-endpoint.com` |
| `UT_GENERATE_ANTHROPIC_AUTH_TOKEN` | GLM authentication token | `glm_xxxxxxxxxxxxxx` |

---

## Step 2: Update GitHub Variables

Navigate to: **Repository Settings → Secrets and variables → Actions → Variables**

| Variable Name | Old Value | New Value | Description |
|---------------|-----------|-----------|-------------|
| `UT_GENERATE_AI_TYPE` | `1` (or not set) | `2` | Switch from Bedrock to GLM |

> **Note:** If `UT_GENERATE_AI_TYPE` doesn't exist, create it with value `2`

---

## Step 3: Update Local Environment (Optional)

If you run the workflow locally for testing, update your `.env` file:

```bash
# Run the setup script
./setup-glm-migration.sh
```

Or manually add/update these variables in `.env`:

```env
# AI Provider Configuration
AI_TYPE=2
ANTHROPIC_BASE_URL=https://your-glm-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-glm-auth-token
```

---

## Step 4: Secrets That Can Be Removed (Optional)

These secrets are no longer needed when using GLM (ai_type=2), but you may keep them for future Bedrock usage:

| Secret Name | Status |
|-------------|--------|
| `UT_GENERATE_AWS_ACCESS_KEY_BEDROCK` | Optional - not used with GLM |
| `UT_GENERATE_AWS_SECRET_KEY_BEDROCK` | Optional - not used with GLM |
| `UT_GENERATE_AWS_REGION_BEDROCK` | Optional - not used with GLM |
| `UT_GENERATE_ANTHROPIC_MODEL` | Optional - not used with GLM |

---

## Step 5: Verify Configuration

### Current Secrets Checklist

After migration, ensure these secrets exist:

**Required for GLM:**
- [ ] `UT_GENERATE_ANTHROPIC_BASE_URL`
- [ ] `UT_GENERATE_ANTHROPIC_AUTH_TOKEN`

**Required for workflow (unchanged):**
- [ ] `UT_GENERATE_JIRA_URL`
- [ ] `UT_GENERATE_JIRA_EMAIL`
- [ ] `UT_GENERATE_JIRA_API_TOKEN`
- [ ] `UT_GENERATE_CONFLUENCE_URL`
- [ ] `UT_GENERATE_CONFLUENCE_EMAIL`
- [ ] `UT_GENERATE_CONFLUENCE_API_TOKEN`

**Optional:**
- [ ] `UT_GENERATE_CONFLUENCE_UPLOAD_URL`
- [ ] `UT_GENERATE_CONFLUENCE_UPLOAD_EMAIL`
- [ ] `UT_GENERATE_CONFLUENCE_UPLOAD_API_TOKEN`
- [ ] `UT_GENERATE_DOCKER_USERNAME`
- [ ] `UT_GENERATE_DOCKER_PASSWORD`
- [ ] `UT_GENERATE_OPENAI_API_KEY`

### Variables Checklist

- [ ] `UT_GENERATE_AI_TYPE` = `2`
- [ ] `UT_GENERATE_JIRA_PROJECT_KEY` (optional, default: BB)
- [ ] `UT_GENERATE_CONFLUENCE_SPACE_KEY` (optional, default: BB)

---

## Step 6: Test the Migration

1. Go to **Actions** tab in your repository
2. Select **"Generate Unit Test Cases Via AI"** workflow
3. Click **"Run workflow"**
4. Enter a JIRA ticket ID
5. Monitor the workflow logs

### Expected Log Output

When running with GLM, you should see:
```
🤖 Using GLM API (ANTHROPIC_BASE_URL: https://your-glm-endpoint.com)
📋 Creating requirements document from JIRA and Confluence...
```

If you see this instead, the migration is incomplete:
```
🤖 Using AWS Bedrock (Region: us-east-2)
```

---

## Rollback to Bedrock

If you need to switch back to AWS Bedrock:

### Option A: Using Setup Script
```bash
./setup-glm-migration.sh
# Select option 1 (AWS Bedrock) when prompted
```

### Option B: Manual Rollback
1. Update variable: `UT_GENERATE_AI_TYPE` = `1`
2. Ensure Bedrock secrets are still configured:
   - `UT_GENERATE_AWS_ACCESS_KEY_BEDROCK`
   - `UT_GENERATE_AWS_SECRET_KEY_BEDROCK`
   - `UT_GENERATE_AWS_REGION_BEDROCK`
   - `UT_GENERATE_ANTHROPIC_MODEL`

---

## Quick Reference

### AI Type Values

| Value | Provider | Required Secrets |
|-------|----------|------------------|
| `1` | AWS Bedrock | `AWS_ACCESS_KEY_BEDROCK`, `AWS_SECRET_KEY_BEDROCK`, `AWS_REGION_BEDROCK`, `ANTHROPIC_MODEL` |
| `2` | GLM | `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` |

### Environment Variables

| Variable | Description | Used By |
|----------|-------------|---------|
| `AI_TYPE` | Provider selection (1=Bedrock, 2=GLM) | Both |
| `ANTHROPIC_BASE_URL` | GLM API endpoint | GLM only |
| `ANTHROPIC_AUTH_TOKEN` | GLM authentication token | GLM only |
| `ANTHROPIC_MODEL` | Claude model name | Bedrock only |
| `AWS_REGION_BEDROCK` | AWS region | Bedrock only |
| `AWS_ACCESS_KEY_BEDROCK` | AWS access key | Bedrock only |
| `AWS_SECRET_KEY_BEDROCK` | AWS secret key | Bedrock only |

---

## Troubleshooting

### Error: "ANTHROPIC_BASE_URL is not set"
- Verify secret `UT_GENERATE_ANTHROPIC_BASE_URL` exists and has correct value

### Error: "Authentication failed"
- Verify secret `UT_GENERATE_ANTHROPIC_AUTH_TOKEN` is correct
- Check if token has expired

### Workflow still using Bedrock
- Verify variable `UT_GENERATE_AI_TYPE` is set to `2`
- Check workflow logs for which provider is being used

### Local development not working
- Run `./setup-glm-migration.sh` to update local `.env` file
- Verify `.env` has correct `AI_TYPE=2` and GLM credentials

---

## Files Modified

This migration involves the following files:

| File | Changes |
|------|---------|
| `action.yml` | Added `ai_type` input, split Step 3 for GLM/Bedrock |
| `templates/generate-unit-testcases.yml` | Updated to use `ai_type` variable |
| `.env.example` | Added AI Provider Configuration section |
| `GITHUB_CONFIGURATION.json` | Updated secrets and variables documentation |

---

## Support

For issues or questions, check the workflow logs in GitHub Actions for detailed error messages.
