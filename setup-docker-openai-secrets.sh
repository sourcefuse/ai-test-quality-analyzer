#!/bin/bash

##############################################################################
# Setup Docker & OpenAI Secrets
#
# This script adds only the Docker and OpenAI secrets for Presidio PII
# detection and embeddings generation.
#
# Secrets added:
# - DOCKER_USERNAME
# - DOCKER_PASSWORD
# - OPENAI_API_KEY
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - .env file with DOCKER_USERNAME, DOCKER_PASSWORD, OPENAI_API_KEY
#
# Usage:
#   ./setup-docker-openai-secrets.sh
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Docker & OpenAI Secrets Setup                            ║${NC}"
echo -e "${BLUE}║  For Presidio PII Detection & Embeddings                  ║${NC}"
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

# Define both secret prefixes (for quality check and test generation workflows)
SECRET_PREFIXES=("UT_QUALITY_" "UT_GENERATE_")

# Secrets to add
declare -A SECRETS=(
    ["DOCKER_USERNAME"]="Docker registry username for Presidio authentication"
    ["DOCKER_PASSWORD"]="Docker registry password/token for Presidio authentication"
    ["OPENAI_API_KEY"]="OpenAI API key for embeddings generation"
)

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

# Set secrets
echo -e "${YELLOW}🔐 Setting up Docker & OpenAI Secrets...${NC}"
echo ""

SECRETS_COUNT=0
SECRETS_SUCCESS=0
SECRETS_FAILED=0

for SECRET_NAME in "${!SECRETS[@]}"; do
    DESCRIPTION="${SECRETS[$SECRET_NAME]}"
    VALUE="${!SECRET_NAME}"

    if [ -z "$VALUE" ]; then
        echo -e "${YELLOW}⚠️  Skipping $SECRET_NAME: Not found in .env${NC}"
        for PREFIX in "${SECRET_PREFIXES[@]}"; do
            SECRETS_COUNT=$((SECRETS_COUNT + 1))
            SECRETS_FAILED=$((SECRETS_FAILED + 1))
        done
        echo ""
        continue
    fi

    # Create secret with EACH prefix (for both workflows)
    for PREFIX in "${SECRET_PREFIXES[@]}"; do
        PREFIXED_SECRET_NAME="${PREFIX}${SECRET_NAME}"
        SECRETS_COUNT=$((SECRETS_COUNT + 1))

        echo -e "${BLUE}   Setting secret: $PREFIXED_SECRET_NAME${NC}"
        if echo "$VALUE" | gh secret set "$PREFIXED_SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
            echo -e "${GREEN}   ✅ $PREFIXED_SECRET_NAME set successfully${NC}"
            SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
        else
            echo -e "${RED}   ❌ Failed to set $PREFIXED_SECRET_NAME${NC}"
            SECRETS_FAILED=$((SECRETS_FAILED + 1))
        fi
    done
    echo ""
done

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

echo -e "${BLUE}ℹ️  Secrets Created:${NC}"
echo "  Each secret was created with BOTH prefixes:"
echo "  - UT_QUALITY_DOCKER_USERNAME"
echo "  - UT_QUALITY_DOCKER_PASSWORD"
echo "  - UT_QUALITY_OPENAI_API_KEY"
echo "  - UT_GENERATE_DOCKER_USERNAME"
echo "  - UT_GENERATE_DOCKER_PASSWORD"
echo "  - UT_GENERATE_OPENAI_API_KEY"
echo ""

if [ $SECRETS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All secrets configured successfully!${NC}"
    echo ""
    echo -e "${BLUE}These secrets enable:${NC}"
    echo "  - Presidio PII detection (Docker credentials)"
    echo "  - OpenAI embeddings for PostgreSQL Vector DB"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  Setup completed with some warnings${NC}"
    echo ""
    echo -e "${BLUE}Please add missing values to your .env file:${NC}"
    echo "  DOCKER_USERNAME=your-docker-username"
    echo "  DOCKER_PASSWORD=your-docker-password-or-token"
    echo "  OPENAI_API_KEY=sk-your-openai-api-key"
    echo ""
    exit 1
fi
