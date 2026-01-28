# GLM Implementation Plan - CheckUnitTestCases Branch

## Overview

This document outlines the plan to implement GLM (Gateway Language Model) support in the CheckUnitTestCases branch, mirroring the implementation done in GenerateUnitTestCases.

## Current State Analysis

### Existing AI Configuration

| Setting | Current Value | Location |
|---------|---------------|----------|
| `claude_code_use_bedrock` | `'1'` (default) | action.yml:105 |
| `aws_bedrock_model` | `'us.anthropic.claude-3-5-sonnet-20241022-v2:0'` | action.yml:100 |
| `anthropic_model` | `'sonnet[1m]'` | action.yml:104 |
| Conditional Step | `if: inputs.claude_code_use_bedrock == '1'` | action.yml:414 |

### Files to Modify

1. `action.yml`
2. `templates/check-unit-testcases.yml`
3. `GITHUB_CONFIGURATION.json`
4. `.env.example`

## Implementation Plan

### Phase 1: action.yml Changes

#### 1.1 Add New Inputs

**Add after line ~105 (after existing AI inputs):**

```yaml
  ai_type:
    description: 'AI provider type: 1 = claude_with_bedrock, 2 = claude_with_glm'
    required: false
    default: '1'
  anthropic_base_url:
    description: 'Anthropic/GLM base URL (required when ai_type=2)'
    required: false
  anthropic_auth_token:
    description: 'Anthropic/GLM auth token (required when ai_type=2)'
    required: false
```

#### 1.2 Remove Deprecated Input

**Remove:**
```yaml
  claude_code_use_bedrock:
    description: 'Use Claude Code with AWS Bedrock (1=enabled, 0=disabled)'
    required: false
    default: '1'
```

#### 1.3 Update .env File Creation Step

**Add to .env heredoc (around line 380):**

```yaml
        # AI Provider Configuration
        AI_TYPE=$INPUT_AI_TYPE
        ANTHROPIC_BASE_URL=$INPUT_ANTHROPIC_BASE_URL
        ANTHROPIC_AUTH_TOKEN=$INPUT_ANTHROPIC_AUTH_TOKEN
```

**Add env variables to the step:**

```yaml
        INPUT_AI_TYPE: ${{ inputs.ai_type }}
        INPUT_ANTHROPIC_BASE_URL: ${{ inputs.anthropic_base_url }}
        INPUT_ANTHROPIC_AUTH_TOKEN: ${{ inputs.anthropic_auth_token }}
```

#### 1.4 Split Step 2 into Conditional Steps

**Current (single step):**
```yaml
    - name: Step 2 - Create Requirements document
      if: inputs.claude_code_use_bedrock == '1'
      shell: bash
      env:
        CLAUDE_CODE_USE_BEDROCK: "1"
        AWS_REGION: ${{ inputs.aws_region_bedrock }}
        # ... AWS credentials
      run: |
        npm run create-requirement-doc
        npm run analyze-test-quality
```

**New (two conditional steps):**

```yaml
    - name: Step 2 - Create Requirements document (GLM)
      if: inputs.ai_type == '2'
      shell: bash
      env:
        ACTION_PATH: ${{ github.action_path }}
        ANTHROPIC_BASE_URL: ${{ inputs.anthropic_base_url }}
        ANTHROPIC_AUTH_TOKEN: ${{ inputs.anthropic_auth_token }}
        ANTHROPIC_MODEL: ${{ inputs.anthropic_model }}
      run: |
        cd "$ACTION_PATH"
        echo "Using GLM API (ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL)"
        npm run create-requirement-doc
        npm run analyze-test-quality

    - name: Step 2 - Create Requirements document (Bedrock)
      if: inputs.ai_type == '1' || inputs.ai_type == ''
      shell: bash
      env:
        ACTION_PATH: ${{ github.action_path }}
        CLAUDE_CODE_USE_BEDROCK: "1"
        AWS_REGION: ${{ inputs.aws_region_bedrock }}
        ANTHROPIC_MODEL: ${{ inputs.anthropic_model }}
        AWS_ACCESS_KEY_ID: ${{ inputs.aws_access_key_bedrock }}
        AWS_SECRET_ACCESS_KEY: ${{ inputs.aws_secret_key_bedrock }}
      run: |
        cd "$ACTION_PATH"
        echo "Using AWS Bedrock (Region: $AWS_REGION)"
        npm run create-requirement-doc
        npm run analyze-test-quality
```

---

### Phase 2: Template Changes

#### 2.1 Update templates/check-unit-testcases.yml

**Update header comments (add after existing secrets):**

```yaml
# - UT_QUALITY_ANTHROPIC_BASE_URL (optional - for GLM integration)
# - UT_QUALITY_ANTHROPIC_AUTH_TOKEN (optional - for GLM integration)
#
# Required Variables:
# - UT_QUALITY_AI_TYPE (1 = bedrock, 2 = glm)
```

**Update action inputs:**

```yaml
          # Remove this line:
          claude_code_use_bedrock: ${{ vars.UT_QUALITY_CLAUDE_CODE_USE_BEDROCK || '1' }}

          # Add these lines:
          ai_type: ${{ vars.UT_QUALITY_AI_TYPE || '1' }}
          anthropic_base_url: ${{ secrets.UT_QUALITY_ANTHROPIC_BASE_URL }}
          anthropic_auth_token: ${{ secrets.UT_QUALITY_ANTHROPIC_AUTH_TOKEN }}
```

---

### Phase 3: Configuration Changes

#### 3.1 Update GITHUB_CONFIGURATION.json

**Add to secrets.required array:**

```json
{
  "name": "ANTHROPIC_BASE_URL",
  "env_var": "ANTHROPIC_BASE_URL",
  "description": "GLM/Anthropic API base URL (required when AI_TYPE=2)",
  "example": "https://your-glm-endpoint.com",
  "sensitive": true,
  "reason": "API endpoint URL"
},
{
  "name": "ANTHROPIC_AUTH_TOKEN",
  "env_var": "ANTHROPIC_AUTH_TOKEN",
  "description": "GLM/Anthropic authentication token (required when AI_TYPE=2)",
  "example": "your-auth-token",
  "sensitive": true,
  "reason": "Authentication credentials"
}
```

**Add to variables.optional array:**

```json
{
  "name": "AI_TYPE",
  "env_var": "AI_TYPE",
  "description": "AI provider type: 1 = claude_with_bedrock (default), 2 = claude_with_glm",
  "example": "2",
  "default": "1",
  "sensitive": false,
  "reason": "Provider selection flag"
}
```

**Remove from variables:**

```json
{
  "name": "CLAUDE_CODE_USE_BEDROCK",
  ...
}
```

#### 3.2 Update .env.example

**Add AI Provider Configuration section at the end:**

```bash
# ===================================================================
# AI PROVIDER CONFIGURATION
# ===================================================================

# AI Provider Type
# 1 = claude_with_bedrock (AWS Bedrock - default)
# 2 = claude_with_glm (GLM API)
AI_TYPE=1

# GLM Configuration (required when AI_TYPE=2)
ANTHROPIC_BASE_URL=
ANTHROPIC_AUTH_TOKEN=

# Note: AWS Bedrock configuration is above in the AWS section
```

---

### Phase 4: Migration Script Update

#### 4.1 Update scripts/setup-glm-migration.sh (if exists)

Ensure the script handles `UT_QUALITY_*` prefix in addition to `UT_GENERATE_*`.

---

## Implementation Checklist

### action.yml
- [ ] Add `ai_type` input with default `'1'`
- [ ] Add `anthropic_base_url` input
- [ ] Add `anthropic_auth_token` input
- [ ] Remove `claude_code_use_bedrock` input
- [ ] Update .env creation to include new variables
- [ ] Split Step 2 into GLM and Bedrock conditional steps
- [ ] Update any references to `claude_code_use_bedrock`

### templates/check-unit-testcases.yml
- [ ] Update header comments with new secrets/variables
- [ ] Replace `claude_code_use_bedrock` with `ai_type`
- [ ] Add `anthropic_base_url` and `anthropic_auth_token` inputs

### GITHUB_CONFIGURATION.json
- [ ] Add `ANTHROPIC_BASE_URL` to secrets
- [ ] Add `ANTHROPIC_AUTH_TOKEN` to secrets
- [ ] Add `AI_TYPE` to variables
- [ ] Remove `CLAUDE_CODE_USE_BEDROCK` from variables

### .env.example
- [ ] Add AI Provider Configuration section
- [ ] Add `AI_TYPE`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`

### Testing
- [ ] Test with `ai_type=1` (Bedrock) - should work as before
- [ ] Test with `ai_type=2` (GLM) - should use GLM endpoint
- [ ] Verify environment variables are passed correctly
- [ ] Verify conditional step execution

---

## Rollback Plan

If issues arise, revert by:
1. Change `ai_type` back to `'1'` in repository variables
2. Keep AWS Bedrock secrets configured
3. Workflow will use Bedrock as default

---

## GitHub Secrets/Variables Summary

### For GLM Mode (ai_type=2)

**Secrets:**
| Name | Value |
|------|-------|
| `UT_QUALITY_ANTHROPIC_BASE_URL` | GLM endpoint URL |
| `UT_QUALITY_ANTHROPIC_AUTH_TOKEN` | GLM auth token |

**Variables:**
| Name | Value |
|------|-------|
| `UT_QUALITY_AI_TYPE` | `2` |

### For Bedrock Mode (ai_type=1)

**Secrets:**
| Name | Value |
|------|-------|
| `UT_QUALITY_AWS_ACCESS_KEY_BEDROCK` | AWS access key |
| `UT_QUALITY_AWS_SECRET_KEY_BEDROCK` | AWS secret key |
| `UT_QUALITY_AWS_REGION_BEDROCK` | AWS region |

**Variables:**
| Name | Value |
|------|-------|
| `UT_QUALITY_AI_TYPE` | `1` (or not set - defaults to 1) |

---

## Estimated Changes

| File | Lines Added | Lines Removed | Lines Modified |
|------|-------------|---------------|----------------|
| action.yml | ~40 | ~10 | ~20 |
| templates/check-unit-testcases.yml | ~10 | ~5 | ~5 |
| GITHUB_CONFIGURATION.json | ~25 | ~10 | ~5 |
| .env.example | ~15 | 0 | 0 |
| **Total** | **~90** | **~25** | **~30** |

---

## Notes

1. The implementation mirrors GenerateUnitTestCases for consistency
2. Default behavior unchanged - Bedrock is still the default (`ai_type=1`)
3. Backward compatible - existing workflows will continue to work
4. GLM secrets are optional - only required when `ai_type=2`
