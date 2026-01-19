#!/bin/bash

##############################################################################
# Setup GLM (Gateway Language Model) Secrets
#
# This script adds the GLM/Anthropic API secrets for using Claude via GLM
# instead of AWS Bedrock for the Check Unit Test Cases Quality workflow.
#
# Secrets removed (deprecated - now using ghcr.io with github.token):
# - UT_QUALITY_DOCKER_USERNAME
# - UT_QUALITY_DOCKER_PASSWORD
#
# Secrets added:
# - UT_QUALITY_ANTHROPIC_BASE_URL
# - UT_QUALITY_ANTHROPIC_AUTH_TOKEN
#
# Variables added:
# - UT_QUALITY_AI_TYPE
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - .env file with ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN
#
# Usage:
#   ./scripts/setup-glm-secrets.sh
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GLM (Gateway Language Model) Secrets Setup               ║${NC}"
echo -e "${BLUE}║  For Claude via GLM API (alternative to AWS Bedrock)      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI is not authenticated${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is installed and authenticated${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: .env file not found at: $ENV_FILE${NC}"
    echo "Please create a .env file with required values"
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Load .env file
source "$ENV_FILE"

# Secret prefix for quality check workflow only
SECRET_PREFIX="UT_QUALITY_"

# Secrets to add
SECRET_NAMES=("ANTHROPIC_BASE_URL" "ANTHROPIC_AUTH_TOKEN")

# Variable prefix
VARIABLE_PREFIX="UT_QUALITY_"

# Prompt for repository name
echo -e "${YELLOW}📦 Enter the repository name (format: owner/repo):${NC}"
echo -e "${BLUE}   Example: your-org/your-repo${NC}"
read -p "Repository: " REPO_NAME

if [ -z "$REPO_NAME" ]; then
    echo -e "${RED}❌ Error: Repository name cannot be empty${NC}"
    exit 1
fi

# Validate repository name format
if [[ ! "$REPO_NAME" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ ]]; then
    echo -e "${RED}❌ Error: Invalid repository name format${NC}"
    echo "Expected format: owner/repo"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Verifying repository access...${NC}"

# Check if repository exists and user has access
if ! gh repo view "$REPO_NAME" &> /dev/null; then
    echo -e "${RED}❌ Error: Cannot access repository '$REPO_NAME'${NC}"
    echo "Please check:"
    echo "  1. Repository name is correct"
    echo "  2. You have access to the repository"
    echo "  3. Repository exists"
    exit 1
fi

echo -e "${GREEN}✅ Repository access verified${NC}"
echo ""

# Remove old Docker secrets (no longer needed - using ghcr.io with github.token)
echo -e "${YELLOW}🗑️  Removing deprecated Docker secrets...${NC}"
echo ""

DEPRECATED_SECRETS=("UT_QUALITY_DOCKER_USERNAME" "UT_QUALITY_DOCKER_PASSWORD")
DELETED_COUNT=0

for SECRET_NAME in "${DEPRECATED_SECRETS[@]}"; do
    echo -e "${BLUE}   Removing secret: $SECRET_NAME${NC}"
    if gh secret delete "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
        echo -e "${GREEN}   ✅ $SECRET_NAME removed successfully${NC}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    else
        echo -e "${YELLOW}   ⚠️  $SECRET_NAME not found or already removed${NC}"
    fi
done
echo ""

# Set secrets
echo -e "${YELLOW}🔐 Setting up GLM Secrets...${NC}"
echo ""

SECRETS_COUNT=0
SECRETS_SUCCESS=0
SECRETS_FAILED=0

for SECRET_NAME in "${SECRET_NAMES[@]}"; do
    VALUE="${!SECRET_NAME}"
    PREFIXED_SECRET_NAME="${SECRET_PREFIX}${SECRET_NAME}"
    SECRETS_COUNT=$((SECRETS_COUNT + 1))

    if [ -z "$VALUE" ]; then
        echo -e "${YELLOW}⚠️  Skipping $PREFIXED_SECRET_NAME: $SECRET_NAME not found in .env${NC}"
        SECRETS_FAILED=$((SECRETS_FAILED + 1))
        echo ""
        continue
    fi

    echo -e "${BLUE}   Setting secret: $PREFIXED_SECRET_NAME${NC}"
    if echo "$VALUE" | gh secret set "$PREFIXED_SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
        echo -e "${GREEN}   ✅ $PREFIXED_SECRET_NAME set successfully${NC}"
        SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
    else
        echo -e "${RED}   ❌ Failed to set $PREFIXED_SECRET_NAME${NC}"
        SECRETS_FAILED=$((SECRETS_FAILED + 1))
    fi
    echo ""
done

# Set AI_TYPE variable
echo -e "${YELLOW}📋 Setting up AI_TYPE Variable...${NC}"
echo ""

VARS_COUNT=0
VARS_SUCCESS=0
VARS_FAILED=0

# Get AI_TYPE from .env or default to 2 (GLM mode)
AI_TYPE_VALUE="${AI_TYPE:-2}"

PREFIXED_VAR_NAME="${VARIABLE_PREFIX}AI_TYPE"
VARS_COUNT=$((VARS_COUNT + 1))

echo -e "${BLUE}   Setting variable: $PREFIXED_VAR_NAME = $AI_TYPE_VALUE${NC}"
if gh variable set "$PREFIXED_VAR_NAME" --body "$AI_TYPE_VALUE" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "${GREEN}   ✅ $PREFIXED_VAR_NAME set successfully${NC}"
    VARS_SUCCESS=$((VARS_SUCCESS + 1))
else
    echo -e "${RED}   ❌ Failed to set $PREFIXED_VAR_NAME${NC}"
    VARS_FAILED=$((VARS_FAILED + 1))
fi
echo ""

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Setup Summary                                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Repository:${NC} $REPO_NAME"
echo ""
echo -e "${BLUE}Secrets:${NC}"
echo -e "  Total:   $SECRETS_COUNT"
echo -e "  ${GREEN}Success: $SECRETS_SUCCESS${NC}"
if [ $SECRETS_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed:  $SECRETS_FAILED${NC}"
fi
echo ""
echo -e "${BLUE}Variables:${NC}"
echo -e "  Total:   $VARS_COUNT"
echo -e "  ${GREEN}Success: $VARS_SUCCESS${NC}"
if [ $VARS_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed:  $VARS_FAILED${NC}"
fi
echo ""

echo -e "${BLUE}ℹ️  Secrets Removed (deprecated):${NC}"
echo "    - UT_QUALITY_DOCKER_USERNAME"
echo "    - UT_QUALITY_DOCKER_PASSWORD"
echo ""
echo -e "${BLUE}ℹ️  Secrets Created:${NC}"
echo "    - UT_QUALITY_ANTHROPIC_BASE_URL"
echo "    - UT_QUALITY_ANTHROPIC_AUTH_TOKEN"
echo ""
echo -e "${BLUE}ℹ️  Variables Created:${NC}"
echo "    - UT_QUALITY_AI_TYPE = $AI_TYPE_VALUE"
echo ""

if [ $SECRETS_FAILED -eq 0 ] && [ $VARS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All GLM secrets and variables configured successfully!${NC}"
    echo ""
    echo -e "${BLUE}AI Provider Configuration:${NC}"
    echo "  AI_TYPE=1  →  AWS Bedrock (default)"
    echo "  AI_TYPE=2  →  GLM API (configured)"
    echo ""
    echo -e "${BLUE}To switch between providers:${NC}"
    echo "  1. Set UT_QUALITY_AI_TYPE variable to 1 (Bedrock) or 2 (GLM)"
    echo "  2. Ensure corresponding secrets are configured:"
    echo "     - Bedrock: UT_QUALITY_AWS_ACCESS_KEY_BEDROCK, UT_QUALITY_AWS_SECRET_KEY_BEDROCK"
    echo "     - GLM: UT_QUALITY_ANTHROPIC_BASE_URL, UT_QUALITY_ANTHROPIC_AUTH_TOKEN"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  Setup completed with some warnings${NC}"
    echo ""
    echo -e "${BLUE}Please add missing values to your .env file:${NC}"
    echo "  ANTHROPIC_BASE_URL=https://your-glm-endpoint.com"
    echo "  ANTHROPIC_AUTH_TOKEN=your-auth-token"
    echo "  AI_TYPE=2"
    echo ""
    exit 1
fi
