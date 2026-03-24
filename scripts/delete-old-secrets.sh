#!/bin/bash

##############################################################################
# Migrate GitHub Repository Secrets
#
# This script removes old UT_GENERATE_* and UT_QUALITY_* secrets that have
# been replaced by global organization secrets (JIRA_URL, JIRA_TOKEN, etc.)
# It also removes the old POST_DATA_URL secret and adds the new workflow-specific
# secrets (UT_QUALITY_POST_DATA_URL and UT_GENERATE_POST_DATA_URL).
#
# Prerequisites:
# - GitHub CLI (gh) must be installed and authenticated
# - You must have admin access to the repository (for deleting repo secrets)
# - You must have organization admin access (for creating org secrets)
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
ORG=$(echo "$REPO" | cut -d'/' -f1)

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
echo "Migrate Repository Secrets"
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

    # Old POST_DATA_URL secret (replaced by UT_QUALITY_POST_DATA_URL and UT_GENERATE_POST_DATA_URL)
    "POST_DATA_URL"
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
echo "  - UT_QUALITY_POST_DATA_URL (for quality check workflow)"
echo "  - UT_GENERATE_POST_DATA_URL (for generate tests workflow)"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Operation cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}========================================"
echo "Step 1: Set New Secret Values"
echo -e "========================================${NC}"
echo ""

# Default values from the original hardcoded URLs
UT_QUALITY_POST_DATA_URL="https://sf-portal.sourcef.us/api/test-quality-tracker/record"
UT_GENERATE_POST_DATA_URL="https://sf-portal.sourcef.us/api/unit-test-generation-tracker/record"

echo -e "${GREEN}Using default values:${NC}"
echo "  UT_QUALITY_POST_DATA_URL: $UT_QUALITY_POST_DATA_URL"
echo "  UT_GENERATE_POST_DATA_URL: $UT_GENERATE_POST_DATA_URL"
echo ""
echo -e "${YELLOW}Note: These are the same URLs that were previously hardcoded in action.yml${NC}"

echo ""
echo -e "${BLUE}========================================"
echo "Step 2: Delete Old Secrets"
echo -e "========================================${NC}"
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

# Create new organization secrets
echo ""
echo -e "${BLUE}========================================"
echo "Step 3: Create New Organization Secrets"
echo -e "========================================${NC}"
echo ""
echo -e "Organization: ${GREEN}$ORG${NC}"
echo ""

created_secrets=0
failed_new_secrets=0

echo -n "Creating organization secret: UT_QUALITY_POST_DATA_URL ... "
if echo "$UT_QUALITY_POST_DATA_URL" | gh secret set UT_QUALITY_POST_DATA_URL --org "$ORG" --visibility all 2>/dev/null; then
    echo -e "${GREEN}✓ Created${NC}"
    ((created_secrets++))
else
    echo -e "${RED}✗ Failed${NC}"
    ((failed_new_secrets++))
fi

echo -n "Creating organization secret: UT_GENERATE_POST_DATA_URL ... "
if echo "$UT_GENERATE_POST_DATA_URL" | gh secret set UT_GENERATE_POST_DATA_URL --org "$ORG" --visibility all 2>/dev/null; then
    echo -e "${GREEN}✓ Created${NC}"
    ((created_secrets++))
else
    echo -e "${RED}✗ Failed${NC}"
    ((failed_new_secrets++))
fi

# Summary
echo ""
echo -e "${BLUE}========================================"
echo "Summary"
echo -e "========================================${NC}"
echo ""
echo "Old Secrets Deleted:"
echo -e "  ${GREEN}Deleted: $deleted_secrets${NC}"
echo -e "  ${YELLOW}Not found: $not_found_secrets${NC}"
echo -e "  ${RED}Failed: $failed_secrets${NC}"
echo ""
echo "Variables Deleted:"
echo -e "  ${GREEN}Deleted: $deleted_vars${NC}"
echo -e "  ${YELLOW}Not found: $not_found_vars${NC}"
echo -e "  ${RED}Failed: $failed_vars${NC}"
echo ""
echo "New Organization Secrets Created:"
echo -e "  ${GREEN}Created: $created_secrets${NC}"
echo -e "  ${RED}Failed: $failed_new_secrets${NC}"
echo ""

if [ $failed_secrets -gt 0 ] || [ $failed_vars -gt 0 ] || [ $failed_new_secrets -gt 0 ]; then
    echo -e "${RED}Some operations failed. Please check your permissions.${NC}"
    echo ""
    if [ $failed_new_secrets -gt 0 ]; then
        echo -e "${YELLOW}Note: Creating organization secrets requires organization admin permissions.${NC}"
        echo "If you don't have org admin access, ask your org admin to create:"
        echo "  - UT_QUALITY_POST_DATA_URL: $UT_QUALITY_POST_DATA_URL"
        echo "  - UT_GENERATE_POST_DATA_URL: $UT_GENERATE_POST_DATA_URL"
    fi
    exit 1
else
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
    echo ""
    echo "The repository now uses:"
    echo "  • Global organization secrets (JIRA_*, CONFLUENCE_*, ANTHROPIC_*, OPENAI_API_KEY)"
    echo "  • Workflow-specific organization secrets (UT_QUALITY_POST_DATA_URL, UT_GENERATE_POST_DATA_URL)"
fi
