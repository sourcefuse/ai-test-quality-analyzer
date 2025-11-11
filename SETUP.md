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

### Workflow Diagram
![alt text](image.png)



### Architecture Overview

![alt text](image-1.png)

---

## Presentation Diagrams

### 1. End-to-End Process Flow (Detailed)
![alt text](image-2.png)

### 2. Quality Scoring Breakdown

```mermaid
graph TB
    subgraph Input["📥 INPUT DATA"]
        T1[Test Files<br/>*.test.ts, *.spec.ts]
        T2[JIRA Requirements<br/>User Stories & ACs]
        T3[Confluence Docs<br/>Technical Specs]
    end

    subgraph Analysis["🤖 AI ANALYSIS ENGINE"]
        direction TB
        A1[Coverage Analysis<br/>25%]
        A2[Assertion Quality<br/>25%]
        A3[Best Practices<br/>25%]
        A4[Documentation<br/>25%]
    end

    subgraph Scoring["📊 SCORING METRICS"]
        direction TB
        S1["Coverage Score<br/>0-2.5 points"]
        S2["Assertions Score<br/>0-2.5 points"]
        S3["Practices Score<br/>0-2.5 points"]
        S4["Docs Score<br/>0-2.5 points"]
    end

    subgraph Result["✅ FINAL RESULT"]
        Total["Total Score<br/>0-10 Scale"]
        Pass{"Pass?<br/>Score ≥ Threshold"}
        Success["✅ Approve"]
        Fail["❌ Needs Work"]
    end

    T1 --> Analysis
    T2 --> Analysis
    T3 --> Analysis

    A1 --> S1
    A2 --> S2
    A3 --> S3
    A4 --> S4

    S1 --> Total
    S2 --> Total
    S3 --> Total
    S4 --> Total

    Total --> Pass
    Pass -->|Yes| Success
    Pass -->|No| Fail

    style Input fill:#e3f2fd
    style Analysis fill:#fff3e0
    style Scoring fill:#f3e5f5
    style Result fill:#e8f5e9
    style Success fill:#c8e6c9
    style Fail fill:#ffcdd2
```

### 3. System Integration Architecture

```mermaid
graph TD
    subgraph Developer["👨‍💻 DEVELOPER WORKFLOW"]
        D1[Write Unit Tests]
        D2[Create Pull Request]
        D3[Review Feedback]
        D4[Improve Tests]
    end

    subgraph GitHub["🔷 GITHUB PLATFORM"]
        G1[GitHub Actions<br/>Workflow Runner]
        G2[PR Environment]
        G3[Comments API]
    end

    subgraph External["🌐 EXTERNAL SERVICES"]
        E1["📋 JIRA<br/>Requirement Tracking"]
        E2["📚 Confluence<br/>Documentation"]
        E3["🧠 AWS Bedrock<br/>Claude AI Model"]
    end

    subgraph Plugin["⚙️ AI TEST ANALYZER PLUGIN"]
        P1[Ticket Extractor]
        P2[Data Collector]
        P3[AI Analyzer]
        P4[Report Generator]
        P5[Quality Scorer]
    end

    subgraph Output["📤 OUTPUT & REPORTS"]
        O1[PR Comment<br/>Summary]
        O2[Confluence Page<br/>Detailed Report]
        O3[GitHub Summary<br/>Workflow Log]
    end

    D1 --> D2
    D2 --> G2
    G2 --> G1

    G1 --> P1
    P1 -->|Extract BB-1234| P2

    P2 -->|Fetch| E1
    P2 -->|Fetch| E2
    P2 --> P3

    P3 -->|AI Request| E3
    E3 -->|Analysis Results| P5

    P5 --> P4
    P4 --> O1
    P4 --> O2
    P4 --> O3

    O1 --> G3
    G3 --> D3

    D3 --> D4
    D4 -.->|Iterate| D1

    style Developer fill:#e1f5fe
    style GitHub fill:#f3e5f5
    style External fill:#fff9c4
    style Plugin fill:#e8f5e9
    style Output fill:#fce4ec
```

### 4. Data Flow Diagram

![alt text](image-3.png)


### 5. Quality Analysis Components

```mermaid
mindmap
  root((AI Test Quality<br/>Analyzer))
    Input Sources
      GitHub Repository
        Test Files
        Source Code
        PR Metadata
      JIRA Integration
        Ticket Requirements
        Acceptance Criteria
        User Stories
      Confluence
        Technical Specs
        API Documentation
        Design Docs
    AI Analysis
      Code Coverage
        Unit Test Coverage
        Integration Tests
        Edge Cases
      Assertion Quality
        Meaningful Asserts
        Error Handling
        Mock Usage
      Best Practices
        Naming Conventions
        Test Structure
        Maintainability
      Documentation
        Test Descriptions
        Comments
        Examples
    Quality Metrics
      Quantitative
        Coverage %
        Test Count
        Assertion Count
      Qualitative
        Code Quality
        Readability
        Completeness
      Scoring
        Weighted Score
        Pass/Fail Threshold
        Trend Analysis
    Report Delivery
      GitHub PR
        Inline Comments
        Summary Report
        Pass/Fail Status
      Confluence Upload
        Detailed Report
        Historical Data
        Recommendations
      Notifications
        PR Review
        Email Alert
        Slack Integration
```

### 6. Deployment & Integration Points

```mermaid
graph TB
    subgraph Setup["🔧 SETUP PHASE"]
        Setup1[Configure GitHub Secrets]
        Setup2[Set Environment Variables]
        Setup3[Install Workflow File]
        Setup4[Configure Triggers]
    end

    subgraph Runtime["▶️ RUNTIME PHASE"]
        Run1[PR Event Triggered]
        Run2[Action Starts]
        Run3[Authenticate Services]
        Run4[Execute Analysis]
        Run5[Generate Reports]
    end

    subgraph Integration["🔗 INTEGRATION POINTS"]
        Int1["GitHub Actions API<br/>Workflow Execution"]
        Int2["JIRA REST API<br/>v3.0"]
        Int3["Confluence REST API<br/>v2.0"]
        Int4["AWS Bedrock API<br/>Claude Models"]
        Int5["GitHub GraphQL API<br/>Comments & Status"]
    end

    subgraph Security["🔒 SECURITY LAYER"]
        Sec1[GitHub Secrets Manager]
        Sec2[API Token Validation]
        Sec3[Rate Limiting]
        Sec4[Audit Logging]
    end

    Setup1 --> Setup2 --> Setup3 --> Setup4
    Setup4 --> Run1

    Run1 --> Run2
    Run2 --> Run3
    Run3 --> Run4
    Run4 --> Run5

    Run3 --> Int1
    Run4 --> Int2
    Run4 --> Int3
    Run4 --> Int4
    Run5 --> Int5

    Int1 --> Sec1
    Int2 --> Sec2
    Int3 --> Sec2
    Int4 --> Sec2
    Sec2 --> Sec3
    Sec3 --> Sec4

    style Setup fill:#e1bee7
    style Runtime fill:#c5e1a5
    style Integration fill:#ffecb3
    style Security fill:#ffccbc
```

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