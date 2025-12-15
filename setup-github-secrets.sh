#!/bin/bash

##############################################################################
# Setup GitHub Secrets and Variables
#
# This script automatically sets up GitHub Actions secrets and variables
# for the Generate Unit Test Cases action by reading values from .env
#
# Prerequisites:
# - GitHub CLI (gh) installed and authenticated
# - .env file with required values
# - GITHUB_CONFIGURATION.json in the same directory
#
# Usage:
#   ./setup-github-secrets.sh
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
CONFIG_FILE="$SCRIPT_DIR/GITHUB_CONFIGURATION.json"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GitHub Actions Secrets & Variables Setup                 ║${NC}"
echo -e "${BLUE}║  Generate Unit Test Cases Action                          ║${NC}"
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

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Error: GITHUB_CONFIGURATION.json not found at: $CONFIG_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration file found${NC}"
echo ""

# Load .env file
source "$ENV_FILE"

# Check for prefix configuration
if [ -z "$SECRET_PREFIX" ]; then
    echo -e "${YELLOW}⚠️  SECRET_PREFIX not set in .env, using no prefix for secrets${NC}"
    SECRET_PREFIX=""
fi

if [ -z "$VARIABLE_PREFIX" ]; then
    echo -e "${YELLOW}⚠️  VARIABLE_PREFIX not set in .env, using no prefix for variables${NC}"
    VARIABLE_PREFIX=""
fi

if [ -n "$SECRET_PREFIX" ] || [ -n "$VARIABLE_PREFIX" ]; then
    echo -e "${BLUE}📌 Prefix Configuration:${NC}"
    [ -n "$SECRET_PREFIX" ] && echo -e "   Secrets: ${GREEN}${SECRET_PREFIX}${NC}"
    [ -n "$VARIABLE_PREFIX" ] && echo -e "   Variables: ${GREEN}${VARIABLE_PREFIX}${NC}"
    echo ""
fi

# Function to read value from .env
get_env_value() {
    local var_name=$1
    local value="${!var_name}"
    echo "$value"
}

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

# Parse JSON and set secrets
echo -e "${YELLOW}🔐 Setting up GitHub Secrets...${NC}"
echo ""

SECRETS_COUNT=0
SECRETS_SUCCESS=0
SECRETS_FAILED=0

# Read secrets from JSON config
while IFS= read -r line; do
    SECRET_NAME=$(echo "$line" | jq -r '.name')
    ENV_VAR=$(echo "$line" | jq -r '.env_var')
    DESCRIPTION=$(echo "$line" | jq -r '.description')

    VALUE=$(get_env_value "$ENV_VAR")

    # Apply prefix to secret name
    PREFIXED_SECRET_NAME="${SECRET_PREFIX}${SECRET_NAME}"

    SECRETS_COUNT=$((SECRETS_COUNT + 1))

    if [ -z "$VALUE" ]; then
        echo -e "${YELLOW}⚠️  Skipping $PREFIXED_SECRET_NAME: $ENV_VAR not found in .env${NC}"
        SECRETS_FAILED=$((SECRETS_FAILED + 1))
    else
        echo -e "${BLUE}   Setting secret: $PREFIXED_SECRET_NAME${NC}"
        if echo "$VALUE" | gh secret set "$PREFIXED_SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
            echo -e "${GREEN}   ✅ $PREFIXED_SECRET_NAME set successfully${NC}"
            SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
        else
            echo -e "${RED}   ❌ Failed to set $PREFIXED_SECRET_NAME${NC}"
            SECRETS_FAILED=$((SECRETS_FAILED + 1))
        fi
    fi
    echo ""
done < <(jq -c '.secrets.required[]' "$CONFIG_FILE")

echo -e "${YELLOW}📋 Setting up GitHub Variables...${NC}"
echo ""

VARS_COUNT=0
VARS_SUCCESS=0
VARS_FAILED=0

# Read variables from JSON config
while IFS= read -r line; do
    VAR_NAME=$(echo "$line" | jq -r '.name')
    ENV_VAR=$(echo "$line" | jq -r '.env_var')
    DEFAULT_VALUE=$(echo "$line" | jq -r '.default')
    DESCRIPTION=$(echo "$line" | jq -r '.description')

    VALUE=$(get_env_value "$ENV_VAR")

    # Use default if not in .env
    if [ -z "$VALUE" ]; then
        VALUE="$DEFAULT_VALUE"
    fi

    # Apply prefix to variable name
    PREFIXED_VAR_NAME="${VARIABLE_PREFIX}${VAR_NAME}"

    VARS_COUNT=$((VARS_COUNT + 1))

    if [ -z "$VALUE" ] || [ "$VALUE" == "null" ]; then
        echo -e "${YELLOW}⚠️  Skipping $PREFIXED_VAR_NAME: No value or default available${NC}"
        VARS_FAILED=$((VARS_FAILED + 1))
    else
        echo -e "${BLUE}   Setting variable: $PREFIXED_VAR_NAME = $VALUE${NC}"
        if gh variable set "$PREFIXED_VAR_NAME" --body "$VALUE" --repo "$REPO_NAME" 2>/dev/null; then
            echo -e "${GREEN}   ✅ $PREFIXED_VAR_NAME set successfully${NC}"
            VARS_SUCCESS=$((VARS_SUCCESS + 1))
        else
            echo -e "${RED}   ❌ Failed to set $PREFIXED_VAR_NAME${NC}"
            VARS_FAILED=$((VARS_FAILED + 1))
        fi
    fi
    echo ""
done < <(jq -c '.variables.optional[]' "$CONFIG_FILE")

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

if [ $SECRETS_FAILED -eq 0 ] && [ $VARS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All secrets and variables configured successfully!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Copy templates/check-unit-testcases.yml to $REPO_NAME/.github/workflows/"
    echo "  2. Update the action path in the workflow file"
    echo "  3. Commit and push to trigger the workflow"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  Setup completed with some warnings${NC}"
    echo ""
    echo -e "${BLUE}Please review the warnings above and:${NC}"
    echo "  1. Add missing values to your .env file"
    echo "  2. Re-run this script to update missing secrets/variables"
    echo ""
    exit 1
fi
