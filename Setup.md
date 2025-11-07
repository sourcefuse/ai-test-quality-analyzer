# Setup Guide: Generate Unit Test Cases Via AI

This guide will help you set up the **Generate Unit Test Cases Via AI** GitHub Action in your repository.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: Configure GitHub Secrets](#step-1-configure-github-secrets)
- [Step 2: Configure GitHub Variables](#step-2-configure-github-variables)
- [Step 3: Install Workflow File](#step-3-install-workflow-file)
- [Step 4: Verify Setup](#step-4-verify-setup)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## 🎯 Overview

This GitHub Action automatically generates unit test cases using AI by:
1. Reading JIRA tickets for requirements
2. Fetching related Confluence documentation
3. Analyzing your repository code
4. Generating comprehensive unit test cases
5. Uploading results to Confluence
6. Creating a Pull Request with the generated tests

---

## ✅ Prerequisites

Before setting up, ensure you have:

- [ ] **JIRA Account** with API access
- [ ] **Confluence Account** with API access
- [ ] **AWS Account** with Bedrock access (for Claude AI)
- [ ] **GitHub Repository** with admin access
- [ ] **API Tokens** ready:
  - JIRA API Token
  - Confluence API Token
  - AWS Access Keys for Bedrock

---

## 🔐 Step 1: Configure GitHub Secrets

Navigate to your repository's **Settings → Secrets and variables → Actions → New repository secret**.

### Required Secrets

Add the following secrets:

#### JIRA Configuration

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `UT_GENERATE_JIRA_URL` | Your JIRA instance URL | `https://yourcompany.atlassian.net` |
| `UT_GENERATE_JIRA_EMAIL` | JIRA account email | `your.email@company.com` |
| `UT_GENERATE_JIRA_API_TOKEN` | JIRA API token | `ATATT3xFfGF0...` |

**How to get JIRA API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and save it as `UT_GENERATE_JIRA_API_TOKEN`

#### Confluence Configuration

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `UT_GENERATE_CONFLUENCE_URL` | Confluence instance URL | `https://yourcompany.atlassian.net` |
| `UT_GENERATE_CONFLUENCE_EMAIL` | Confluence account email | `your.email@company.com` |
| `UT_GENERATE_CONFLUENCE_API_TOKEN` | Confluence API token | `ATATT3xFfGF0...` |

**How to get Confluence API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and save it as `UT_GENERATE_CONFLUENCE_API_TOKEN`

**Note:** You can use the same API token for both JIRA and Confluence if they're in the same Atlassian instance.

#### AWS Bedrock Configuration

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `UT_GENERATE_AWS_ACCESS_KEY_BEDROCK` | AWS Access Key ID | `AKIAIOSFODNN7EXAMPLE` |
| `UT_GENERATE_AWS_SECRET_KEY_BEDROCK` | AWS Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

**How to get AWS Bedrock Credentials:**
1. Log in to AWS Console
2. Go to IAM → Users → Your User → Security credentials
3. Create access key for AWS Bedrock
4. Ensure the user has `bedrock:InvokeModel` permissions

#### Optional Secrets (for separate Confluence upload instance)

| Secret Name | Description | Required |
|------------|-------------|----------|
| `UT_GENERATE_CONFLUENCE_UPLOAD_URL` | Different Confluence URL for uploading | Optional |
| `UT_GENERATE_CONFLUENCE_UPLOAD_EMAIL` | Different email for uploading | Optional |
| `UT_GENERATE_CONFLUENCE_UPLOAD_API_TOKEN` | Different API token for uploading | Optional |

---

## ⚙️ Step 2: Configure GitHub Variables

Navigate to your repository's **Settings → Secrets and variables → Actions → Variables tab → New repository variable**.

### Required Variables

| Variable Name | Description | Default | Example |
|--------------|-------------|---------|---------|
| `UT_GENERATE_JIRA_PROJECT_KEY` | JIRA project key | `BB` | `PROJ` |
| `UT_GENERATE_CONFLUENCE_SPACE_KEY` | Confluence space key | `BB` | `TEAM` |

### Optional Variables

| Variable Name | Description | Default | Options |
|--------------|-------------|---------|---------|
| `UT_GENERATE_CONFLUENCE_UPLOAD_SPACE_KEY` | Different space for uploads | Same as fetch | Any space key |
| `UT_GENERATE_CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock (1) or disable (0) | `1` | `0` or `1` |

**How to create Variables:**
1. Go to **Settings → Secrets and variables → Actions**
2. Click on **Variables** tab
3. Click **New repository variable**
4. Enter name and value
5. Click **Add variable**

---

## 📁 Step 3: Install Workflow File

### Option A: Copy Template File

1. Copy the template file from this repository:
   ```bash
   curl -o .github/workflows/generate-unit-testcases.yml \
     https://raw.githubusercontent.com/sourcefuse/ai-test-quality-analyzer/UT-V1.0/templates/generate-unit-testcases.yml
   ```

2. Or manually create the file `.github/workflows/generate-unit-testcases.yml` with the following content:

```yaml
name: Generate Unit Test Cases Via AI

on:
  workflow_dispatch:
    inputs:
      jira_ticket_id:
        description: 'JIRA Ticket ID / Branch Name (e.g., BB-15690)'
        required: true
        type: string
      target_branch:
        description: 'Target branch for generated unit test cases (default: main)'
        required: false
        default: 'dev'
        type: string

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  generate-unit-tests:
    name: Generate Unit Test Cases
    runs-on: ubuntu-latest

    permissions:
      contents: write      # Required to push commits
      pull-requests: write # Required to create PRs

    env:
      TARGET_BRANCH: ${{ github.event.inputs.target_branch || 'main' }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set JIRA ticket ID and branch
        id: extract_ticket
        run: |
          TICKET_ID="${{ github.event.inputs.jira_ticket_id }}"

          if [ -z "$TICKET_ID" ]; then
            echo "❌ Error: JIRA ticket ID / Branch name is required"
            exit 1
          fi

          echo "ticket_id=$TICKET_ID" >> $GITHUB_OUTPUT
          echo "📋 Using JIRA Ticket: $TICKET_ID"
          echo "🌿 Using Branch: $TICKET_ID"

      - name: Generate Unit Test Cases with AI
        id: generate_tests
        uses: sourcefuse/ai-test-quality-analyzer@UT-V1.0
        with:
          jira_url: ${{ secrets.UT_GENERATE_JIRA_URL }}
          jira_email: ${{ secrets.UT_GENERATE_JIRA_EMAIL }}
          jira_api_token: ${{ secrets.UT_GENERATE_JIRA_API_TOKEN }}
          jira_ticket_id: ${{ steps.extract_ticket.outputs.ticket_id }}
          jira_project_key: ${{ vars.UT_GENERATE_JIRA_PROJECT_KEY || 'BB' }}
          confluence_url: ${{ secrets.UT_GENERATE_CONFLUENCE_URL }}
          confluence_email: ${{ secrets.UT_GENERATE_CONFLUENCE_EMAIL }}
          confluence_api_token: ${{ secrets.UT_GENERATE_CONFLUENCE_API_TOKEN }}
          confluence_space_key: ${{ vars.UT_GENERATE_CONFLUENCE_SPACE_KEY || 'BB' }}
          confluence_upload_url: ${{ secrets.UT_GENERATE_CONFLUENCE_UPLOAD_URL }}
          confluence_upload_email: ${{ secrets.UT_GENERATE_CONFLUENCE_UPLOAD_EMAIL }}
          confluence_upload_api_token: ${{ secrets.UT_GENERATE_CONFLUENCE_UPLOAD_API_TOKEN }}
          confluence_upload_space_key: ${{ vars.UT_GENERATE_CONFLUENCE_UPLOAD_SPACE_KEY }}
          repository_url: ${{ github.server_url }}/${{ github.repository }}
          repository_branch: ${{ steps.extract_ticket.outputs.ticket_id }}
          target_branch: ${{ env.TARGET_BRANCH }}
          aws_region_bedrock: ${{ secrets.UT_GENERATE_AWS_REGION_BEDROCK }}
          aws_access_key_bedrock: ${{ secrets.UT_GENERATE_AWS_ACCESS_KEY_BEDROCK }}
          aws_secret_key_bedrock: ${{ secrets.UT_GENERATE_AWS_SECRET_KEY_BEDROCK }}
          aws_bedrock_model: ${{ secrets.UT_GENERATE_AWS_BEDROCK_MODEL }}
          anthropic_model: ${{ secrets.UT_GENERATE_ANTHROPIC_MODEL }}
          claude_code_use_bedrock: ${{ vars.UT_GENERATE_CLAUDE_CODE_USE_BEDROCK || '1' }}
        continue-on-error: true

      - name: Display Results Summary
        if: always()
        shell: bash
        run: |
          echo ""
          echo "========================================"
          echo "✅ Unit Test Generation Completed"
          echo "========================================"
          echo ""
          echo "📋 JIRA Ticket: ${{ steps.extract_ticket.outputs.ticket_id }}"
          echo "🌿 Generated Branch: ${{ steps.extract_ticket.outputs.ticket_id }}-via-ai"
          echo "🎯 Target Branch: ${{ env.TARGET_BRANCH }}"
          echo ""
          if [ -n "${{ steps.generate_tests.outputs.confluence_url }}" ]; then
            echo "   • Confluence Report: ${{ steps.generate_tests.outputs.confluence_url }}"
          fi
          if [ -n "${{ steps.generate_tests.outputs.pr_url }}" ]; then
            echo "   • Pull Request: ${{ steps.generate_tests.outputs.pr_url }}"
          fi
          echo ""
          echo "🤖 Generated unit test cases are ready for review!"
          echo "========================================"
```

3. Commit and push the workflow file:
   ```bash
   git add .github/workflows/generate-unit-testcases.yml
   git commit -m "chore: add unit test generation workflow"
   git push
   ```

---

## ✅ Step 4: Verify Setup

### Test the Workflow

1. Go to your repository on GitHub
2. Click on **Actions** tab
3. Select **Generate Unit Test Cases Via AI** workflow
4. Click **Run workflow** button
5. Enter test values:
   - **JIRA Ticket ID**: `BB-12345` (use an actual ticket ID)
   - **Target branch**: `dev` (or your default branch)
6. Click **Run workflow**

### Expected Output

The workflow should:
1. ✅ Fetch JIRA ticket data
2. ✅ Download Confluence pages
3. ✅ Generate requirements document
4. ✅ Create unit test cases
5. ✅ Upload to Confluence
6. ✅ Create a new branch
7. ✅ Commit generated tests
8. ✅ Create a Pull Request

---

## 🚀 Usage

### Running the Workflow

1. **Navigate to Actions**:
   - Go to your repository → **Actions** tab
   - Select **Generate Unit Test Cases Via AI**

2. **Click "Run workflow"**:
   - Enter **JIRA Ticket ID** (e.g., `BB-15690`)
   - Enter **Target Branch** (e.g., `dev` or `main`)
   - Click **Run workflow**

3. **Monitor Progress**:
   - Watch the workflow execution in real-time
   - Review logs for each step

4. **Review Results**:
   - Check the Confluence page for generated documentation
   - Review the Pull Request with generated test cases
   - Verify test coverage and quality

### Workflow Outputs

After successful execution, you'll get:

- **📄 Confluence Page**: Complete documentation with:
  - JIRA ticket details
  - Requirements analysis
  - Generated unit test cases

- **🔀 Pull Request**: Contains:
  - Generated test files
  - Proper test structure
  - AI-generated test cases
  - Link to Confluence documentation

- **🌿 New Branch**: Format: `{TICKET-ID}-via-ai-{TIMESTAMP}`

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Invalid Confluence credentials" Error

**Solution:**
- Verify `UT_GENERATE_CONFLUENCE_URL` is correct
- Check `UT_GENERATE_CONFLUENCE_EMAIL` is valid
- Regenerate `UT_GENERATE_CONFLUENCE_API_TOKEN`
- Ensure email has Confluence access

#### 2. "JIRA ticket not found" Error

**Solution:**
- Verify the ticket ID exists in JIRA
- Check `UT_GENERATE_JIRA_PROJECT_KEY` matches your project
- Ensure the API token has permission to read the ticket

#### 3. "AWS Bedrock access denied" Error

**Solution:**
- Verify AWS credentials are correct
- Check IAM permissions include `bedrock:InvokeModel`
- Ensure Bedrock is enabled in your AWS region
- Verify region is set to `us-east-2` or another supported region

#### 4. "Page created under wrong parent" Issue

**Solution:**
- This is fixed in UT-V1.0
- Ensure you're using `@UT-V1.0` in your workflow file
- The action now validates parent hierarchy correctly

#### 5. "Pull Request creation failed" Error

**Solution:**
- Ensure workflow has `contents: write` and `pull-requests: write` permissions
- Check if a PR already exists for the branch
- Verify GitHub token has sufficient permissions

### Debug Mode

To enable detailed logging, add this to your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

---

## 🔧 Advanced Configuration

### Custom AWS Region

Add this secret if using a different region:

```yaml
secrets:
  UT_GENERATE_AWS_REGION_BEDROCK: "us-west-2"
```

### Custom AI Model

Override the default Claude model:

```yaml
secrets:
  UT_GENERATE_AWS_BEDROCK_MODEL: "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
  UT_GENERATE_ANTHROPIC_MODEL: "sonnet[1m]"
```

### Separate Confluence Upload Instance

If you want to upload results to a different Confluence instance:

```yaml
secrets:
  UT_GENERATE_CONFLUENCE_UPLOAD_URL: "https://different-instance.atlassian.net"
  UT_GENERATE_CONFLUENCE_UPLOAD_EMAIL: "bot@company.com"
  UT_GENERATE_CONFLUENCE_UPLOAD_API_TOKEN: "different-token"

variables:
  UT_GENERATE_CONFLUENCE_UPLOAD_SPACE_KEY: "REPORTS"
```

### Confluence Page Hierarchy

The action creates this hierarchy in Confluence:

```
{SPACE_KEY}-Generate-Unit-Tests-Via-AI (Root)
└── {TICKET_ID}-Via-AI (Ticket Container)
    └── {TIMESTAMP}-Via-AI (Actual Report)
```

Example:
```
BB-Generate-Unit-Tests-Via-AI
└── BB-15690-Via-AI
    └── 2025-11-07-10-30-45-Via-AI
```

---

## 📚 Additional Resources

- **GitHub Action Repository**: https://github.com/sourcefuse/ai-test-quality-analyzer
- **Latest Release**: https://github.com/sourcefuse/ai-test-quality-analyzer/releases/tag/UT-V1.0
- **Report Issues**: https://github.com/sourcefuse/ai-test-quality-analyzer/issues

---

## 📝 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review workflow logs in GitHub Actions
3. Create an issue in the repository with:
   - Error message
   - Workflow run link
   - Steps to reproduce

---

## 🎉 Success Checklist

- [ ] All secrets configured in GitHub
- [ ] All variables set in GitHub
- [ ] Workflow file added to `.github/workflows/`
- [ ] Test run completed successfully
- [ ] Confluence page created correctly
- [ ] Pull Request generated with tests
- [ ] Team notified about the new workflow

**You're all set! Start generating unit tests with AI!** 🚀
