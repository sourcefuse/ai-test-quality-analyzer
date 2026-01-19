#!/bin/bash

##############################################################################
# Remove GitHub Secrets and Variables
#
# This script removes GitHub Actions secrets and variables
# by reading configuration from GITHUB_CONFIGURATION.json
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - GITHUB_CONFIGURATION.json in the specified directory
#
# Usage:
#   ./scripts/remove-github-secrets.sh [path-to-config-directory]
#
# Examples:
#   ./scripts/remove-github-secrets.sh                           # Uses current directory
#   ./scripts/remove-github-secrets.sh ../CheckUnitTestCases     # Uses specific directory
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

# Allow override of config directory
if [ -n "$1" ]; then
    CONFIG_DIR="$(cd "$1" && pwd)"
else
    CONFIG_DIR="$SCRIPT_DIR"
fi

CONFIG_FILE="$CONFIG_DIR/GITHUB_CONFIGURATION.json"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GitHub Actions Secrets & Variables Removal               ║${NC}"
echo -e "${BLUE}║  Universal Script for All Workflows                       ║${NC}"
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

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Error: GITHUB_CONFIGURATION.json not found at: $CONFIG_FILE${NC}"
    echo ""
    echo -e "${BLUE}Available configuration files:${NC}"
    find "$SCRIPT_DIR/.." -name "GITHUB_CONFIGURATION.json" 2>/dev/null | head -5 || echo "  None found"
    echo ""
    echo -e "${BLUE}Usage:${NC}"
    echo "  $0 [path-to-config-directory]"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  $0 ../CheckUnitTestCases"
    echo "  $0 ../GenerateUnitTestCases"
    exit 1
fi

echo -e "${GREEN}✅ Configuration file found: $CONFIG_FILE${NC}"
echo ""

# Detect workflow type from config file
WORKFLOW_TYPE="Unknown"
if grep -q "UT_QUALITY_" "$CONFIG_FILE"; then
    WORKFLOW_TYPE="Check Unit Test Cases"
elif grep -q "UT_GENERATE_" "$CONFIG_FILE"; then
    WORKFLOW_TYPE="Generate Unit Test Cases"
fi

echo -e "${BLUE}📋 Detected workflow type: $WORKFLOW_TYPE${NC}"
echo ""

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

# Warning prompt
echo -e "${YELLOW}⚠️  WARNING: This will permanently remove all configured secrets and variables!${NC}"
echo -e "${RED}   This action cannot be undone.${NC}"
echo ""
echo -e "${BLUE}Secrets and variables to be removed for: $WORKFLOW_TYPE${NC}"

# Show what will be removed
echo ""
echo -e "${YELLOW}Secrets:${NC}"
while IFS= read -r line; do
    SECRET_NAME=$(echo "$line" | jq -r '.name')
    echo -e "  • $SECRET_NAME"
done < <(jq -c '.secrets.required[]' "$CONFIG_FILE")

echo ""
echo -e "${YELLOW}Variables:${NC}"
while IFS= read -r line; do
    VAR_NAME=$(echo "$line" | jq -r '.name')
    echo -e "  • $VAR_NAME"
done < <(jq -c '.variables.optional[]' "$CONFIG_FILE")

echo ""
echo -e "${YELLOW}Are you sure you want to continue? [y/N]:${NC}"
read -p "Confirm removal: " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}❌ Operation cancelled${NC}"
    exit 0
fi

# Remove secrets
echo ""
echo -e "${YELLOW}🔐 Removing GitHub Secrets...${NC}"
echo ""

SECRETS_COUNT=0
SECRETS_REMOVED=0
SECRETS_FAILED=0

# Remove secrets from JSON config
while IFS= read -r line; do
    SECRET_NAME=$(echo "$line" | jq -r '.name')
    
    SECRETS_COUNT=$((SECRETS_COUNT + 1))
    
    echo -e "${BLUE}   Removing secret: $SECRET_NAME${NC}"
    if gh secret remove "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
        echo -e "${GREEN}   ✅ $SECRET_NAME removed successfully${NC}"
        SECRETS_REMOVED=$((SECRETS_REMOVED + 1))
    else
        echo -e "${YELLOW}   ⚠️  $SECRET_NAME not found or already removed${NC}"
        SECRETS_FAILED=$((SECRETS_FAILED + 1))
    fi
    echo ""
done < <(jq -c '.secrets.required[]' "$CONFIG_FILE")

echo -e "${YELLOW}📋 Removing GitHub Variables...${NC}"
echo ""

VARS_COUNT=0
VARS_REMOVED=0
VARS_FAILED=0

# Remove variables from JSON config
while IFS= read -r line; do
    VAR_NAME=$(echo "$line" | jq -r '.name')
    
    VARS_COUNT=$((VARS_COUNT + 1))
    
    echo -e "${BLUE}   Removing variable: $VAR_NAME${NC}"
    if gh variable delete "$VAR_NAME" --repo "$REPO_NAME" 2>/dev/null; then
        echo -e "${GREEN}   ✅ $VAR_NAME removed successfully${NC}"
        VARS_REMOVED=$((VARS_REMOVED + 1))
    else
        echo -e "${YELLOW}   ⚠️  $VAR_NAME not found or already removed${NC}"
        VARS_FAILED=$((VARS_FAILED + 1))
    fi
    echo ""
done < <(jq -c '.variables.optional[]' "$CONFIG_FILE")

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Removal Summary                                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Repository:${NC} $REPO_NAME"
echo -e "${BLUE}Workflow:${NC} $WORKFLOW_TYPE"
echo -e "${BLUE}Config File:${NC} $CONFIG_FILE"
echo ""
echo -e "${BLUE}Secrets:${NC}"
echo -e "  Total:     $SECRETS_COUNT"
echo -e "  ${GREEN}Removed:   $SECRETS_REMOVED${NC}"
if [ $SECRETS_FAILED -gt 0 ]; then
    echo -e "  ${YELLOW}Not found: $SECRETS_FAILED${NC}"
fi
echo ""
echo -e "${BLUE}Variables:${NC}"
echo -e "  Total:     $VARS_COUNT"
echo -e "  ${GREEN}Removed:   $VARS_REMOVED${NC}"
if [ $VARS_FAILED -gt 0 ]; then
    echo -e "  ${YELLOW}Not found: $VARS_FAILED${NC}"
fi
echo ""

if [ $SECRETS_REMOVED -gt 0 ] || [ $VARS_REMOVED -gt 0 ]; then
    echo -e "${GREEN}✅ Secrets and variables removal completed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Remove workflow files from $REPO_NAME/.github/workflows/ if no longer needed"
    echo "  2. Clean up any related documentation"
    echo "  3. Archive or delete unused branches"
    echo ""
else
    echo -e "${YELLOW}ℹ️  No secrets or variables were removed (already clean or not found)${NC}"
    echo ""
fi

echo -e "${GREEN}🧹 Cleanup completed successfully!${NC}"