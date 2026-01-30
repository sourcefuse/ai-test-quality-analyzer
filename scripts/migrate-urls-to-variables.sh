#!/bin/bash

##############################################################################
# Migrate URL Secrets to Variables
#
# This script migrates URL secrets to variables (URLs don't need encryption)
# Migrates:
#   - UT_GENERATE_CONFLUENCE_URL (secret → variable)
#   - UT_QUALITY_CONFLUENCE_URL (secret → variable)
#   - UT_QUALITY_JIRA_URL (secret → variable)
#   - UT_GENERATE_JIRA_URL (secret → variable)
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - .env file with required URL values (CONFLUENCE_URL, JIRA_URL)
#
# Usage:
#   ./migrate-urls-to-variables.sh
#
# Note: This script reads URL values from .env file in the project root.
#       API keys remain as secrets (not migrated).
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

# URLs to migrate (secret → variable)
# Using indexed arrays for bash 3.2 compatibility
# Format: GitHub Secret Name
URL_SECRET_NAMES=(
    "UT_GENERATE_CONFLUENCE_URL"
    "UT_QUALITY_CONFLUENCE_URL"
    "UT_QUALITY_JIRA_URL"
    "UT_GENERATE_JIRA_URL"
)

# Format: Environment Variable Name (what to read from .env)
URL_ENV_VARS=(
    "CONFLUENCE_URL"
    "CONFLUENCE_URL"
    "JIRA_URL"
    "JIRA_URL"
)

URL_SECRET_DESCRIPTIONS=(
    "Confluence URL for Generate workflow"
    "Confluence URL for Quality Check workflow"
    "JIRA URL for Quality Check workflow"
    "JIRA URL for Generate workflow"
)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Migrate URL Secrets to Variables                         ║${NC}"
echo -e "${BLUE}║  Security Improvement: URLs don't need encryption         ║${NC}"
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
    echo "Please create a .env file with required URL values:"
    echo "  - CONFLUENCE_URL (used for both UT_GENERATE_CONFLUENCE_URL and UT_QUALITY_CONFLUENCE_URL)"
    echo "  - JIRA_URL (used for both UT_GENERATE_JIRA_URL and UT_QUALITY_JIRA_URL)"
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

# Explain the migration
echo -e "${CYAN}📋 Migration Overview:${NC}"
echo ""
echo -e "${BLUE}Why migrate URLs from secrets to variables?${NC}"
echo "  • URLs are not sensitive data (they're visible in logs/workflows)"
echo "  • Secrets are encrypted and have API rate limits"
echo "  • Variables are simpler and more appropriate for URLs"
echo "  • GitHub Actions can use variables without rate limiting"
echo ""
echo -e "${BLUE}What will be migrated:${NC}"
for SECRET_NAME in "${URL_SECRET_NAMES[@]}"; do
    echo -e "  ${YELLOW}•${NC} $SECRET_NAME → ${GREEN}(variable)${NC}"
done
echo ""
echo -e "${BLUE}Note:${NC} API keys (OPENAI_API_KEY) will remain as secrets."
echo ""

# Check which secrets exist
echo -e "${BLUE}🔍 Checking which secrets currently exist...${NC}"
echo ""

# Arrays to track secrets to migrate
SECRETS_TO_MIGRATE_NAMES=()
SECRETS_TO_MIGRATE_VALUES=()

for i in "${!URL_SECRET_NAMES[@]}"; do
    SECRET_NAME="${URL_SECRET_NAMES[$i]}"
    ENV_VAR="${URL_ENV_VARS[$i]}"

    if gh secret list --repo "$REPO_NAME" | grep -q "^$SECRET_NAME"; then
        echo -e "${GREEN}   ✅ Found: $SECRET_NAME${NC}"

        # Read value from environment variable (already sourced from .env)
        SECRET_VALUE=$(get_env_value "$ENV_VAR")

        if [ -n "$SECRET_VALUE" ]; then
            SECRETS_TO_MIGRATE_NAMES+=("$SECRET_NAME")
            SECRETS_TO_MIGRATE_VALUES+=("$SECRET_VALUE")
            echo -e "${BLUE}      → Will use value from ${ENV_VAR}${NC}"
        else
            echo -e "${YELLOW}      ⚠️  But ${ENV_VAR} not found in .env - skipping${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  Not found: $SECRET_NAME (skipping)${NC}"
    fi
done

echo ""

if [ ${#SECRETS_TO_MIGRATE_NAMES[@]} -eq 0 ]; then
    echo -e "${YELLOW}ℹ️  No URL secrets found to migrate${NC}"
    echo "Either URL secrets don't exist or values not found in .env file."
    echo "URLs may have already been migrated to variables."
    exit 0
fi

# Show what was found
echo -e "${BLUE}📖 Found ${#SECRETS_TO_MIGRATE_NAMES[@]} URL(s) with values in .env${NC}"
echo ""

# Confirmation prompt
echo -e "${YELLOW}⚠️  Ready to migrate ${#SECRETS_TO_MIGRATE_NAMES[@]} URL(s)${NC}"
echo ""
echo -e "${BLUE}Migration plan:${NC}"
for i in "${!SECRETS_TO_MIGRATE_NAMES[@]}"; do
    SECRET_NAME="${SECRETS_TO_MIGRATE_NAMES[$i]}"
    SECRET_VALUE="${SECRETS_TO_MIGRATE_VALUES[$i]}"
    echo -e "  1. Remove secret: ${YELLOW}$SECRET_NAME${NC}"
    echo -e "  2. Create variable: ${GREEN}$SECRET_NAME${NC} = ${SECRET_VALUE}"
    echo ""
done

echo -e "${YELLOW}Proceed with migration? [y/N]:${NC}"
read -p "Confirm: " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}❌ Migration cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Starting Migration                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

MIGRATED=0
FAILED=0

for i in "${!SECRETS_TO_MIGRATE_NAMES[@]}"; do
    SECRET_NAME="${SECRETS_TO_MIGRATE_NAMES[$i]}"
    SECRET_VALUE="${SECRETS_TO_MIGRATE_VALUES[$i]}"

    echo -e "${CYAN}Migrating: $SECRET_NAME${NC}"

    # Step 1: Create variable first (safer - can rollback if removal fails)
    echo -e "${BLUE}   → Creating variable...${NC}"
    if gh variable set "$SECRET_NAME" --body "$SECRET_VALUE" --repo "$REPO_NAME" 2>/dev/null; then
        echo -e "${GREEN}   ✅ Variable created${NC}"

        # Step 2: Remove secret
        echo -e "${BLUE}   → Removing secret...${NC}"
        if gh secret remove "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
            echo -e "${GREEN}   ✅ Secret removed${NC}"
            echo -e "${GREEN}   ✅ Migration complete for $SECRET_NAME${NC}"
            MIGRATED=$((MIGRATED + 1))
        else
            echo -e "${YELLOW}   ⚠️  Failed to remove secret (variable created successfully)${NC}"
            echo -e "${YELLOW}   ℹ️  You may need to manually remove the secret${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${RED}   ❌ Failed to create variable${NC}"
        echo -e "${YELLOW}   ℹ️  Secret remains unchanged${NC}"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Migration Summary                                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Repository:${NC} $REPO_NAME"
echo ""
echo -e "${BLUE}Results:${NC}"
echo -e "  Total URLs:     ${#SECRETS_TO_MIGRATE_NAMES[@]}"
echo -e "  ${GREEN}Migrated:       $MIGRATED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "  ${YELLOW}Failed:         $FAILED${NC}"
fi
echo ""

if [ $MIGRATED -gt 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Verify variables are set correctly:"
    echo "     ${CYAN}gh variable list --repo $REPO_NAME${NC}"
    echo ""
    echo "  2. Update your workflows to use variables instead of secrets:"
    echo "     ${YELLOW}\${{ vars.UT_GENERATE_CONFLUENCE_URL }}${NC} instead of ${YELLOW}\${{ secrets.UT_GENERATE_CONFLUENCE_URL }}${NC}"
    echo ""
    echo "  3. Test your workflows to ensure they still work"
    echo ""
    echo "  4. If any secrets failed to remove, remove them manually:"
    echo "     ${CYAN}gh secret list --repo $REPO_NAME${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  No URLs were migrated successfully${NC}"
    echo ""
    echo -e "${BLUE}Possible reasons:${NC}"
    echo "  • URL secrets may have already been migrated to variables"
    echo "  • URL secrets may never have been created (already using variables)"
    echo "  • Values not found in .env file"
    echo ""
    echo -e "${BLUE}Check current status:${NC}"
    echo "  1. Check variables: ${CYAN}gh variable list --repo $REPO_NAME${NC}"
    echo "  2. Check secrets:   ${CYAN}gh secret list --repo $REPO_NAME${NC}"
    echo ""
fi

echo -e "${GREEN}🎉 Migration script completed!${NC}"
