# Setup Guide - AI Test Quality Analyzer

## Introduction

The **AI Test Quality Analyzer** is a GitHub Action plugin that automatically checks the quality of unit test cases in your codebase. It analyzes your test files against JIRA requirements and Confluence documentation to provide comprehensive quality metrics and recommendations.

### Key Features
- 🎯 Automated test quality scoring (0-10 scale)
- 📊 Detailed analysis of test coverage and quality
- 🔗 Integration with JIRA for requirement tracking
- 📝 Confluence integration for documentation
- 🤖 AI-powered analysis using AWS Bedrock and Claude
- 💬 Automatic PR comments with quality reports
- 📈 Comprehensive test quality metrics

### How It Works
1. Extracts JIRA ticket ID from PR branch or title
2. Fetches requirements from JIRA and related Confluence documentation
3. Analyzes repository test files against requirements
4. Generates quality score and detailed report
5. Posts results as PR comment and optionally uploads to Confluence

---

## Prerequisites

Before setting up the action, ensure you have:

1. **GitHub CLI** installed and authenticated
   ```bash
   # Install GitHub CLI
   brew install gh  # macOS
   # or visit: https://cli.github.com/

   # Authenticate
   gh auth login
   ```

2. **JIRA Access**
   - JIRA instance URL
   - JIRA user email
   - JIRA API token ([Create token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/))

3. **Confluence Access**
   - Confluence instance URL
   - Confluence user email
   - Confluence API token (same as JIRA if using Atlassian)

4. **AWS Bedrock Access** (for AI analysis)
   - AWS Access Key
   - AWS Secret Key
   - AWS Region with Bedrock enabled
   - Access to Claude models in Bedrock

---

## Quick Setup

### Step 1: Configure Environment Variables

Create a `.env` file in your local environment with the following values:

```bash
# JIRA Configuration
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=jira-bot@yourcompany.com
JIRA_API_TOKEN=ATBBxxxxxxxxxxxxxxxxxxxxxx
JIRA_PROJECT_KEY=BB

# Confluence Configuration
CONFLUENCE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_EMAIL=confluence-bot@yourcompany.com
CONFLUENCE_API_TOKEN=ATBBxxxxxxxxxxxxxxxxxxxxxx
CONFLUENCE_SPACE_KEY=BB

# AWS Bedrock Configuration
AWS_REGION_BEDROCK=us-east-2
AWS_ACCESS_KEY_BEDROCK=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_KEY_BEDROCK=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_BEDROCK_MODEL=us.anthropic.claude-3-5-sonnet-20241022-v2:0
ANTHROPIC_MODEL=sonnet[1m]

# Optional: Separate Confluence for uploading results
CONFLUENCE_UPLOAD_URL=https://targetcompany.atlassian.net/wiki
CONFLUENCE_UPLOAD_EMAIL=upload-bot@targetcompany.com
CONFLUENCE_UPLOAD_API_TOKEN=ATBBxxxxxxxxxxxxxxxxxxxxxx
CONFLUENCE_UPLOAD_SPACE_KEY=TARGET

# Quality Configuration
MINIMUM_SCORE=1.0
CLAUDE_CODE_USE_BEDROCK=1
```

### Step 2: Run the Setup Script

Use the provided script to automatically configure GitHub secrets and variables:

```bash
# Make the script executable
chmod +x setup-github-secrets.sh

# Run the setup script
./setup-github-secrets.sh
```

The script will:
- Verify GitHub CLI authentication
- Read values from your `.env` file
- Prompt for repository name (format: `owner/repo`)
- Configure all required secrets and variables
- Provide a summary of the setup

### Step 3: Add Workflow to Your Repository

Copy the workflow template to your repository:

```bash
# Create workflows directory if it doesn't exist
mkdir -p .github/workflows

# Copy the workflow file
cp templates/check-unit-testcases.yml .github/workflows/check-unit-testcases.yml
```

The workflow will automatically trigger on:
- Pull requests to the `dev` branch
- Manual workflow dispatch with custom parameters

---

## Manual Setup (Alternative)

If you prefer to configure manually or need to customize specific settings:

### GitHub Secrets Configuration

Navigate to your repository → Settings → Secrets and variables → Actions → Secrets

Add the following **required secrets**:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `UT_QUALITY_JIRA_URL` | JIRA instance URL | `https://yourcompany.atlassian.net` |
| `UT_QUALITY_JIRA_EMAIL` | JIRA user email | `jira-bot@yourcompany.com` |
| `UT_QUALITY_JIRA_API_TOKEN` | JIRA API token | `ATBBxxxxxxxxxxxxxxxxxxxxxx` |
| `UT_QUALITY_CONFLUENCE_URL` | Confluence instance URL | `https://yourcompany.atlassian.net/wiki` |
| `UT_QUALITY_CONFLUENCE_EMAIL` | Confluence user email | `confluence-bot@yourcompany.com` |
| `UT_QUALITY_CONFLUENCE_API_TOKEN` | Confluence API token | `ATBBxxxxxxxxxxxxxxxxxxxxxx` |
| `UT_QUALITY_AWS_ACCESS_KEY_BEDROCK` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `UT_QUALITY_AWS_SECRET_KEY_BEDROCK` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/...` |

### GitHub Variables Configuration

Navigate to your repository → Settings → Secrets and variables → Actions → Variables

Add the following **optional variables** (defaults will be used if not set):

| Variable Name | Description | Default | Example |
|--------------|-------------|---------|---------|
| `UT_QUALITY_JIRA_PROJECT_KEY` | JIRA project key | `BB` | `PROJ` |
| `UT_QUALITY_CONFLUENCE_SPACE_KEY` | Confluence space key | `BB` | `DOC` |
| `UT_QUALITY_MINIMUM_SCORE` | Minimum quality score | `1.0` | `6.0` |
| `UT_QUALITY_CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock | `1` | `1` or `0` |
| `UT_QUALITY_AWS_REGION_BEDROCK` | AWS region | `us-east-2` | `us-west-2` |
| `UT_QUALITY_AWS_BEDROCK_MODEL` | Bedrock model ID | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | Model ID |
| `UT_QUALITY_ANTHROPIC_MODEL` | Anthropic model | `sonnet[1m]` | Model name |

---

## Workflow Configuration

### Basic Configuration

The workflow file (`check-unit-testcases.yml`) includes:

```yaml
name: Check Unit Test Cases Quality

on:
  pull_request:
    branches:
      - dev  # Change this to your default branch
    types: [opened, synchronize, reopened]

  workflow_dispatch:
    inputs:
      jira_ticket_id:
        description: 'JIRA Ticket ID'
        required: true
        type: string
      minimum_score:
        description: 'Minimum acceptable score (0-10)'
        required: false
        default: '1.0'
        type: string
```

### Customization Options

1. **Change trigger branches**: Edit the `branches` array under `pull_request`
2. **Adjust quality threshold**: Set `UT_QUALITY_MINIMUM_SCORE` variable
3. **Disable Confluence upload**: Set `upload_to_confluence: 'false'` in workflow
4. **Change action version**: Update from `@QC-V1.0` to specific version

### Advanced Configuration

For multiple environments or different configurations per branch:

```yaml
minimum_score: ${{ 
  github.base_ref == 'main' && '8.0' ||
  github.base_ref == 'dev' && '6.0' ||
  '1.0'
}}
```

---

## Usage

### Automatic Trigger

1. Create a pull request to your configured branch (default: `dev`)
2. Ensure your branch name or PR title contains a JIRA ticket ID (e.g., `BB-1234`)
3. The action will automatically run and post results as a PR comment

### Manual Trigger

1. Go to Actions tab in your repository
2. Select "Check Unit Test Cases Quality"
3. Click "Run workflow"
4. Enter:
   - JIRA ticket ID (e.g., `BB-1234`)
   - Minimum score (optional, default: `1.0`)

### Understanding Results

The action provides:

1. **PR Comment** with:
   - Quality score (0-10)
   - Score breakdown by category
   - Links to full report
   - Pass/fail status

2. **Confluence Report** (if enabled) with:
   - Detailed requirements analysis
   - Test coverage mapping
   - Improvement recommendations
   - Code examples

3. **GitHub Summary** with:
   - Score metrics
   - Links to reports
   - File paths for artifacts

---

## Troubleshooting

### Common Issues

1. **"Cannot find JIRA ticket"**
   - Ensure branch name or PR title contains ticket ID
   - Format: `PROJECT-NUMBER` (e.g., `BB-1234`)

2. **"AWS Bedrock authentication failed"**
   - Verify AWS credentials are correct
   - Ensure Bedrock is enabled in your AWS region
   - Check IAM permissions for Bedrock access

3. **"Confluence upload failed"**
   - Verify API token has write permissions
   - Check space key exists
   - Ensure user has access to the space

4. **"Score below threshold"**
   - Review the detailed report for improvement areas
   - Add missing test cases
   - Improve test assertions and coverage

### Debug Mode

Enable detailed logging by adding to your workflow:

```yaml
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

### Support

For issues or questions:
1. Check the [GitHub Issues](https://github.com/sourcefuse/ai-test-quality-analyzer/issues)
2. Review workflow logs in Actions tab
3. Verify all secrets and variables are correctly set

---

## Security Best Practices

1. **API Token Security**
   - Use dedicated service accounts
   - Rotate tokens every 90 days
   - Limit token permissions to required scope

2. **Secret Management**
   - Never commit secrets to repository
   - Use GitHub's secret scanning
   - Consider using organization-level secrets

3. **Access Control**
   - Restrict workflow permissions
   - Use environment protection rules
   - Audit secret access logs regularly

---

## Version Information

Current Version: **QC-V1.0**

To use a specific version in your workflow:
```yaml
uses: sourcefuse/ai-test-quality-analyzer@QC-V1.0
```

---

## Contributing

To contribute or report issues, please visit the [GitHub repository](https://github.com/sourcefuse/ai-test-quality-analyzer).

---

## License

ISC License - see LICENSE file for details.

---

## Author

Created by Vishal Gupta