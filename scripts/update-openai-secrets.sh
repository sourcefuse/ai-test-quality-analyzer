#!/bin/bash

##############################################################################
# Update OpenAI API Key Secrets
#
# This script updates OpenAI API key secrets from .env file
# Updates:
#   - UT_GENERATE_OPENAI_API_KEY
#   - UT_QUALITY_OPENAI_API_KEY
#
# Both secrets are updated with the value from OPENAI_API_KEY in .env
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - .env file with OPENAI_API_KEY value
#
# Usage:
#   ./update-openai-secrets.sh
#
# Note: This script reads OPENAI_API_KEY from .env file in the project root.
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# Secrets to update
SECRET_NAMES=(
    "UT_GENERATE_OPENAI_API_KEY"
    "UT_QUALITY_OPENAI_API_KEY"
)

SECRET_DESCRIPTIONS=(
    "OpenAI API Key for Generate workflow"
    "OpenAI API Key for Quality Check workflow"
)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Update OpenAI API Key Secrets                             ║${NC}"
echo -e "${BLUE}║  Sync secrets with .env file                               ║${NC}"
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
    echo "Please create a .env file with OPENAI_API_KEY"
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Load .env file
source "$ENV_FILE"

# Function to read value from .env
get_env_value() {
    local var_name=$1
    local value="${!var_name}"
    echo "$value"
}

# Get OPENAI_API_KEY from .env
OPENAI_API_KEY=$(get_env_value "OPENAI_API_KEY")

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ Error: OPENAI_API_KEY not found in .env file${NC}"
    echo "Please add OPENAI_API_KEY to your .env file"
    exit 1
fi

# Mask the API key for display
MASKED_KEY="${OPENAI_API_KEY:0:8}...${OPENAI_API_KEY: -4}"
echo -e "${GREEN}✅ Found OPENAI_API_KEY in .env${NC}"
echo -e "${BLUE}   Value: ${MASKED_KEY}${NC}"
echo ""

# Prompt for repository name
echo -e "${YELLOW}📦 Enter the repository name (format: owner/repo):${NC}"
echo -e "${BLUE}   Example: sourcefuse/your-repo${NC}"
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

# Explain what will be updated
echo -e "${CYAN}📋 Update Overview:${NC}"
echo ""
echo -e "${BLUE}What will be updated:${NC}"
for i in "${!SECRET_NAMES[@]}"; do
    SECRET_NAME="${SECRET_NAMES[$i]}"
    DESCRIPTION="${SECRET_DESCRIPTIONS[$i]}"
    echo -e "  ${YELLOW}•${NC} ${SECRET_NAME}"
    echo -e "    ${BLUE}${DESCRIPTION}${NC}"
done
echo ""
echo -e "${BLUE}New value:${NC} ${MASKED_KEY}"
echo ""

# Confirmation prompt
echo -e "${YELLOW}⚠️  Ready to update ${#SECRET_NAMES[@]} secret(s)${NC}"
echo ""
echo -e "${YELLOW}Proceed with update? [y/N]:${NC}"
read -p "Confirm: " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}❌ Update cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Starting Secret Update                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

UPDATED=0
FAILED=0

for i in "${!SECRET_NAMES[@]}"; do
    SECRET_NAME="${SECRET_NAMES[$i]}"

    echo -e "${CYAN}Updating: $SECRET_NAME${NC}"

    if echo "$OPENAI_API_KEY" | gh secret set "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
        echo -e "${GREEN}   ✅ Secret updated successfully${NC}"
        UPDATED=$((UPDATED + 1))
    else
        echo -e "${RED}   ❌ Failed to update secret${NC}"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Update Summary                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Repository:${NC} $REPO_NAME"
echo ""
echo -e "${BLUE}Results:${NC}"
echo -e "  Total Secrets:  ${#SECRET_NAMES[@]}"
echo -e "  ${GREEN}Updated:        $UPDATED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed:         $FAILED${NC}"
fi
echo ""

if [ $UPDATED -gt 0 ]; then
    echo -e "${GREEN}✅ Secrets updated successfully!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Verify secrets are set correctly:"
    echo "     ${CYAN}gh secret list --repo $REPO_NAME${NC}"
    echo ""
    echo "  2. Test your workflows to ensure they use the new API key"
    echo ""
else
    echo -e "${YELLOW}⚠️  No secrets were updated successfully${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "  1. Check your GitHub CLI permissions"
    echo "  2. Verify you have admin access to the repository"
    echo "  3. Check if secrets exist:"
    echo "     ${CYAN}gh secret list --repo $REPO_NAME${NC}"
    echo ""
fi

echo -e "${GREEN}🎉 Update script completed!${NC}"
