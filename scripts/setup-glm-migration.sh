#!/bin/bash

# GLM Migration Setup Script
# Reads GLM configuration from .env and creates GitHub secrets/variables
#
# Usage: ./setup-glm-migration.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   GLM Migration Setup - Create GitHub Secrets/Variables${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check for .env file
ENV_FILE=".env"

echo -e "${BLUE}Step 1: Reading .env file...${NC}"
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create a .env file with GLM configuration:"
    echo "  ANTHROPIC_BASE_URL=https://your-glm-endpoint.com"
    echo "  ANTHROPIC_AUTH_TOKEN=your-token"
    echo "  AI_TYPE=2"
    exit 1
fi

# Read values from .env
ANTHROPIC_BASE_URL=$(grep "^ANTHROPIC_BASE_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//' || echo "")
ANTHROPIC_AUTH_TOKEN=$(grep "^ANTHROPIC_AUTH_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//' || echo "")
AI_TYPE=$(grep "^AI_TYPE=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "2")

echo -e "  ANTHROPIC_BASE_URL: ${GREEN}${ANTHROPIC_BASE_URL:-'(not set)'}${NC}"
echo -e "  ANTHROPIC_AUTH_TOKEN: ${GREEN}${ANTHROPIC_AUTH_TOKEN:+'*****'}${ANTHROPIC_AUTH_TOKEN:-'(not set)'}${NC}"
echo -e "  AI_TYPE: ${GREEN}${AI_TYPE}${NC}"
echo ""

# Validate required values
if [ -z "$ANTHROPIC_BASE_URL" ] || [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Error: Missing required values in .env${NC}"
    echo "Please ensure these are set in .env:"
    echo "  ANTHROPIC_BASE_URL=https://your-glm-endpoint.com"
    echo "  ANTHROPIC_AUTH_TOKEN=your-token"
    exit 1
fi

echo -e "${GREEN}✅ All required values found in .env${NC}"
echo ""

# Check if gh is installed
echo -e "${BLUE}Step 2: Checking GitHub CLI...${NC}"
echo ""

if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI is not authenticated${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is installed and authenticated${NC}"
echo ""

# Prompt for repository name
echo -e "${BLUE}Step 3: Enter repository name...${NC}"
echo ""
echo -e "${YELLOW}Format: owner/repo (e.g., sourcefuse/ai-test-quality-analyzer)${NC}"
read -p "Repository: " REPO_NAME

if [ -z "$REPO_NAME" ]; then
    echo -e "${RED}❌ Error: Repository name cannot be empty${NC}"
    exit 1
fi

if [[ ! "$REPO_NAME" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ ]]; then
    echo -e "${RED}❌ Error: Invalid repository name format${NC}"
    echo "Expected format: owner/repo"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Verifying repository access...${NC}"

if ! gh repo view "$REPO_NAME" &> /dev/null; then
    echo -e "${RED}❌ Error: Cannot access repository '$REPO_NAME'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Repository access verified${NC}"
echo ""

# Create GitHub secrets and variables
echo -e "${BLUE}Step 4: Creating GitHub Secrets...${NC}"
echo ""

SECRET_PREFIX="UT_GENERATE_"
SECRETS_SUCCESS=0
SECRETS_FAILED=0

# ANTHROPIC_BASE_URL
SECRET_NAME="${SECRET_PREFIX}ANTHROPIC_BASE_URL"
echo -e "   Setting: $SECRET_NAME"
if echo "$ANTHROPIC_BASE_URL" | gh secret set "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "   ${GREEN}✅ $SECRET_NAME set${NC}"
    SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
else
    echo -e "   ${RED}❌ Failed to set $SECRET_NAME${NC}"
    SECRETS_FAILED=$((SECRETS_FAILED + 1))
fi

# ANTHROPIC_AUTH_TOKEN
SECRET_NAME="${SECRET_PREFIX}ANTHROPIC_AUTH_TOKEN"
echo -e "   Setting: $SECRET_NAME"
if echo "$ANTHROPIC_AUTH_TOKEN" | gh secret set "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "   ${GREEN}✅ $SECRET_NAME set${NC}"
    SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
else
    echo -e "   ${RED}❌ Failed to set $SECRET_NAME${NC}"
    SECRETS_FAILED=$((SECRETS_FAILED + 1))
fi

echo ""
echo -e "${BLUE}Step 5: Creating GitHub Variables...${NC}"
echo ""

VARS_SUCCESS=0
VARS_FAILED=0

# AI_TYPE
VAR_NAME="${SECRET_PREFIX}AI_TYPE"
echo -e "   Setting: $VAR_NAME = $AI_TYPE"
if gh variable set "$VAR_NAME" --body "$AI_TYPE" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "   ${GREEN}✅ $VAR_NAME set${NC}"
    VARS_SUCCESS=$((VARS_SUCCESS + 1))
else
    echo -e "   ${RED}❌ Failed to set $VAR_NAME${NC}"
    VARS_FAILED=$((VARS_FAILED + 1))
fi

echo ""
echo -e "${BLUE}Step 6: Removing unused secrets...${NC}"
echo ""

REMOVED_COUNT=0

# Remove AWS_BEDROCK_MODEL (not used in generate workflow)
SECRET_NAME="${SECRET_PREFIX}AWS_BEDROCK_MODEL"
echo -e "   Removing: $SECRET_NAME"
if gh secret delete "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "   ${GREEN}✅ $SECRET_NAME removed${NC}"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
else
    echo -e "   ${YELLOW}⚠️  $SECRET_NAME not found or already removed${NC}"
fi

# Remove DOCKER_USERNAME (no longer needed - uses GITHUB_TOKEN for ghcr.io)
SECRET_NAME="${SECRET_PREFIX}DOCKER_USERNAME"
echo -e "   Removing: $SECRET_NAME"
if gh secret delete "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "   ${GREEN}✅ $SECRET_NAME removed${NC}"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
else
    echo -e "   ${YELLOW}⚠️  $SECRET_NAME not found or already removed${NC}"
fi

# Remove DOCKER_PASSWORD (no longer needed - uses GITHUB_TOKEN for ghcr.io)
SECRET_NAME="${SECRET_PREFIX}DOCKER_PASSWORD"
echo -e "   Removing: $SECRET_NAME"
if gh secret delete "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
    echo -e "   ${GREEN}✅ $SECRET_NAME removed${NC}"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
else
    echo -e "   ${YELLOW}⚠️  $SECRET_NAME not found or already removed${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ GLM Migration Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Repository: ${GREEN}$REPO_NAME${NC}"
echo -e "Secrets created: ${GREEN}$SECRETS_SUCCESS${NC} success, ${RED}$SECRETS_FAILED${NC} failed"
echo -e "Secrets removed: ${GREEN}$REMOVED_COUNT${NC}"
echo -e "Variables created: ${GREEN}$VARS_SUCCESS${NC} success, ${RED}$VARS_FAILED${NC} failed"
echo ""
echo -e "${BLUE}Created:${NC}"
echo "  • ${SECRET_PREFIX}ANTHROPIC_BASE_URL (secret)"
echo "  • ${SECRET_PREFIX}ANTHROPIC_AUTH_TOKEN (secret)"
echo "  • ${SECRET_PREFIX}AI_TYPE = $AI_TYPE (variable)"
echo ""
echo -e "${BLUE}Removed:${NC}"
echo "  • ${SECRET_PREFIX}AWS_BEDROCK_MODEL (not used in generate workflow)"
echo "  • ${SECRET_PREFIX}DOCKER_USERNAME (uses GITHUB_TOKEN for ghcr.io)"
echo "  • ${SECRET_PREFIX}DOCKER_PASSWORD (uses GITHUB_TOKEN for ghcr.io)"
echo ""
echo -e "${GREEN}Done! 🚀${NC}"
