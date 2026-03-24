#!/bin/bash

##############################################################################
# Delete Old Prefixed Secrets from GitHub Repository
#
# This script removes old UT_GENERATE_* and UT_QUALITY_* secrets that have
# been replaced by global organization secrets (JIRA_URL, JIRA_TOKEN, etc.)
#
# Prerequisites:
# - GitHub CLI (gh) must be installed and authenticated
# - You must have admin access to the repository
#
# Usage:
#   ./delete-old-secrets.sh <owner/repo>
#
# Example:
#   ./delete-old-secrets.sh sourcefuse/biz-book-api
#
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if repository argument is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Repository name is required${NC}"
    echo ""
    echo "Usage: $0 <owner/repo>"
    echo "Example: $0 sourcefuse/biz-book-api"
    exit 1
fi

REPO=$1

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${BLUE}========================================"
echo "Delete Old Prefixed Secrets"
echo -e "========================================${NC}"
echo ""
echo -e "Repository: ${GREEN}$REPO${NC}"
echo ""

# List of secrets to delete (now replaced by global org secrets)
SECRETS_TO_DELETE=(
    # Generate workflow secrets
    "UT_GENERATE_JIRA_URL"
    "UT_GENERATE_JIRA_EMAIL"
    "UT_GENERATE_JIRA_API_TOKEN"
    "UT_GENERATE_CONFLUENCE_URL"
    "UT_GENERATE_CONFLUENCE_EMAIL"
    "UT_GENERATE_CONFLUENCE_API_TOKEN"
    "UT_GENERATE_ANTHROPIC_BASE_URL"
    "UT_GENERATE_ANTHROPIC_AUTH_TOKEN"
    "UT_GENERATE_OPENAI_API_KEY"

    # Quality check workflow secrets
    "UT_QUALITY_JIRA_URL"
    "UT_QUALITY_JIRA_EMAIL"
    "UT_QUALITY_JIRA_API_TOKEN"
    "UT_QUALITY_CONFLUENCE_URL"
    "UT_QUALITY_CONFLUENCE_EMAIL"
    "UT_QUALITY_CONFLUENCE_API_TOKEN"
    "UT_QUALITY_ANTHROPIC_BASE_URL"
    "UT_QUALITY_ANTHROPIC_AUTH_TOKEN"
    "UT_QUALITY_OPENAI_API_KEY"
)

# List of variables to delete (now replaced by global org secrets)
VARIABLES_TO_DELETE=(
    # Generate workflow variables
    "UT_GENERATE_JIRA_URL"
    "UT_GENERATE_CONFLUENCE_URL"

    # Quality check workflow variables
    "UT_QUALITY_JIRA_URL"
    "UT_QUALITY_CONFLUENCE_URL"
)

echo -e "${YELLOW}The following secrets will be deleted:${NC}"
echo ""
for secret in "${SECRETS_TO_DELETE[@]}"; do
    echo "  - $secret"
done
echo ""

echo -e "${YELLOW}The following variables will be deleted:${NC}"
echo ""
for var in "${VARIABLES_TO_DELETE[@]}"; do
    echo "  - $var"
done
echo ""

echo -e "${YELLOW}These have been replaced by global organization secrets:${NC}"
echo "  - JIRA_URL"
echo "  - JIRA_EMAIL"
echo "  - JIRA_TOKEN"
echo "  - CONFLUENCE_URL"
echo "  - CONFLUENCE_EMAIL"
echo "  - CONFLUENCE_TOKEN"
echo "  - ANTHROPIC_BASE_URL"
echo "  - ANTHROPIC_AUTH_TOKEN"
echo "  - OPENAI_API_KEY"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with deletion? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Operation cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Starting deletion...${NC}"
echo ""

# Delete secrets
deleted_secrets=0
not_found_secrets=0
failed_secrets=0

for secret in "${SECRETS_TO_DELETE[@]}"; do
    echo -n "Deleting secret: $secret ... "

    if gh secret delete "$secret" --repo "$REPO" 2>/dev/null; then
        echo -e "${GREEN}✓ Deleted${NC}"
        ((deleted_secrets++))
    else
        # Check if secret exists
        if gh secret list --repo "$REPO" 2>/dev/null | grep -q "^$secret"; then
            echo -e "${RED}✗ Failed${NC}"
            ((failed_secrets++))
        else
            echo -e "${YELLOW}⊘ Not found${NC}"
            ((not_found_secrets++))
        fi
    fi
done

# Delete variables
deleted_vars=0
not_found_vars=0
failed_vars=0

echo ""
for var in "${VARIABLES_TO_DELETE[@]}"; do
    echo -n "Deleting variable: $var ... "

    if gh variable delete "$var" --repo "$REPO" 2>/dev/null; then
        echo -e "${GREEN}✓ Deleted${NC}"
        ((deleted_vars++))
    else
        # Check if variable exists
        if gh variable list --repo "$REPO" 2>/dev/null | grep -q "^$var"; then
            echo -e "${RED}✗ Failed${NC}"
            ((failed_vars++))
        else
            echo -e "${YELLOW}⊘ Not found${NC}"
            ((not_found_vars++))
        fi
    fi
done

# Summary
echo ""
echo -e "${BLUE}========================================"
echo "Summary"
echo -e "========================================${NC}"
echo ""
echo "Secrets:"
echo -e "  ${GREEN}Deleted: $deleted_secrets${NC}"
echo -e "  ${YELLOW}Not found: $not_found_secrets${NC}"
echo -e "  ${RED}Failed: $failed_secrets${NC}"
echo ""
echo "Variables:"
echo -e "  ${GREEN}Deleted: $deleted_vars${NC}"
echo -e "  ${YELLOW}Not found: $not_found_vars${NC}"
echo -e "  ${RED}Failed: $failed_vars${NC}"
echo ""

if [ $failed_secrets -gt 0 ] || [ $failed_vars -gt 0 ]; then
    echo -e "${RED}Some deletions failed. Please check your permissions.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Cleanup completed successfully!${NC}"
    echo ""
    echo "The repository now uses global organization secrets."
fi
