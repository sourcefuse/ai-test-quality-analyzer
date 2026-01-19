#!/bin/bash

# GLM Migration Setup Script
# Migrates from AWS Bedrock to GLM by updating .env and .env.example files
#
# Usage: ./setup-glm-migration.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   GLM Migration Setup - AWS Bedrock to GLM${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local is_secret="$4"

    if [ "$is_secret" = "true" ]; then
        read -sp "$prompt [$default]: " input
        echo ""
    else
        read -p "$prompt [$default]: " input
    fi

    if [ -z "$input" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$input'"
    fi
}

# Function to update or add a variable in a file
update_env_var() {
    local file="$1"
    local var_name="$2"
    local var_value="$3"

    if grep -q "^${var_name}=" "$file" 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${var_name}=.*|${var_name}=${var_value}|" "$file"
        else
            sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" "$file"
        fi
        echo -e "  ${GREEN}✓${NC} Updated ${var_name}"
    else
        echo "${var_name}=${var_value}" >> "$file"
        echo -e "  ${GREEN}+${NC} Added ${var_name}"
    fi
}

# Function to add GLM configuration section if not exists
add_glm_section() {
    local file="$1"

    if ! grep -q "AI PROVIDER CONFIGURATION" "$file" 2>/dev/null; then
        cat >> "$file" << 'EOF'

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
EOF
        echo -e "  ${GREEN}+${NC} Added AI Provider Configuration section"
    fi
}

# Check for .env file
ENV_FILE=".env"
ENV_EXAMPLE_FILE=".env.example"

echo -e "${BLUE}Step 1: Checking environment files...${NC}"
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f "$ENV_EXAMPLE_FILE" ]; then
        cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
        echo -e "${GREEN}✅ Created .env from .env.example${NC}"
    else
        echo -e "${RED}❌ Error: Neither .env nor .env.example found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Found .env file${NC}"
echo ""

# Read existing values from .env as defaults
EXISTING_BASE_URL=$(grep "^ANTHROPIC_BASE_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//' || echo "")
EXISTING_AUTH_TOKEN=$(grep "^ANTHROPIC_AUTH_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//' || echo "")
EXISTING_AI_TYPE=$(grep "^AI_TYPE=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "1")

# Prompt for GLM configuration
echo -e "${BLUE}Step 2: Enter GLM configuration...${NC}"
echo ""
echo -e "${YELLOW}Note: Press Enter to keep existing value, or enter new value${NC}"
echo ""

prompt_with_default "Enter ANTHROPIC_BASE_URL (GLM endpoint)" "$EXISTING_BASE_URL" GLM_BASE_URL "false"
prompt_with_default "Enter ANTHROPIC_AUTH_TOKEN (GLM token)" "$EXISTING_AUTH_TOKEN" GLM_AUTH_TOKEN "true"

echo ""
echo -e "${BLUE}Step 3: Select AI Provider...${NC}"
echo ""
echo "  1) AWS Bedrock"
echo "  2) GLM"
echo ""
if [ "$EXISTING_AI_TYPE" = "2" ]; then
    read -p "Select AI provider [2 - current]: " AI_PROVIDER_CHOICE
    DEFAULT_CHOICE="2"
else
    read -p "Select AI provider [1 - current]: " AI_PROVIDER_CHOICE
    DEFAULT_CHOICE="1"
fi

if [ -z "$AI_PROVIDER_CHOICE" ]; then
    AI_TYPE_VALUE="$DEFAULT_CHOICE"
elif [ "$AI_PROVIDER_CHOICE" = "2" ]; then
    AI_TYPE_VALUE="2"
else
    AI_TYPE_VALUE="1"
fi

if [ "$AI_TYPE_VALUE" = "2" ]; then
    echo -e "${GREEN}✅ Selected: GLM${NC}"
else
    echo -e "${GREEN}✅ Selected: AWS Bedrock${NC}"
fi

echo ""
echo -e "${BLUE}Step 4: Updating .env file...${NC}"
echo ""

add_glm_section "$ENV_FILE"
update_env_var "$ENV_FILE" "AI_TYPE" "$AI_TYPE_VALUE"
update_env_var "$ENV_FILE" "ANTHROPIC_BASE_URL" "$GLM_BASE_URL"
update_env_var "$ENV_FILE" "ANTHROPIC_AUTH_TOKEN" "$GLM_AUTH_TOKEN"

echo ""
echo -e "${GREEN}✅ .env file updated${NC}"

# Update .env.example if exists
if [ -f "$ENV_EXAMPLE_FILE" ]; then
    echo ""
    echo -e "${BLUE}Step 5: Updating .env.example file...${NC}"
    echo ""

    add_glm_section "$ENV_EXAMPLE_FILE"
    update_env_var "$ENV_EXAMPLE_FILE" "AI_TYPE" "1"
    update_env_var "$ENV_EXAMPLE_FILE" "ANTHROPIC_BASE_URL" "https://your-glm-endpoint.com"
    update_env_var "$ENV_EXAMPLE_FILE" "ANTHROPIC_AUTH_TOKEN" "your-glm-auth-token"

    echo ""
    echo -e "${GREEN}✅ .env.example file updated${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Local Environment Setup Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Local changes summary:${NC}"
echo "  AI_TYPE=$AI_TYPE_VALUE"
[ -n "$GLM_BASE_URL" ] && echo "  ANTHROPIC_BASE_URL=$GLM_BASE_URL" || echo "  ANTHROPIC_BASE_URL=(not set)"
[ -n "$GLM_AUTH_TOKEN" ] && echo "  ANTHROPIC_AUTH_TOKEN=*****(hidden)" || echo "  ANTHROPIC_AUTH_TOKEN=(not set)"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   GitHub Actions Configuration${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$AI_TYPE_VALUE" = "2" ]; then
    echo -e "${YELLOW}Configure these in GitHub (Settings → Secrets and variables → Actions):${NC}"
    echo ""
    echo -e "${BLUE}SECRETS - Required for GLM:${NC}"
    echo "  • UT_GENERATE_ANTHROPIC_BASE_URL"
    echo "  • UT_GENERATE_ANTHROPIC_AUTH_TOKEN"
    echo ""
    echo -e "${BLUE}SECRETS - Required (unchanged):${NC}"
    echo "  • UT_GENERATE_JIRA_URL"
    echo "  • UT_GENERATE_JIRA_EMAIL"
    echo "  • UT_GENERATE_JIRA_API_TOKEN"
    echo "  • UT_GENERATE_CONFLUENCE_URL"
    echo "  • UT_GENERATE_CONFLUENCE_EMAIL"
    echo "  • UT_GENERATE_CONFLUENCE_API_TOKEN"
    echo ""
    echo -e "${BLUE}SECRETS - Optional:${NC}"
    echo "  • UT_GENERATE_CONFLUENCE_UPLOAD_URL"
    echo "  • UT_GENERATE_CONFLUENCE_UPLOAD_EMAIL"
    echo "  • UT_GENERATE_CONFLUENCE_UPLOAD_API_TOKEN"
    echo "  • UT_GENERATE_DOCKER_USERNAME"
    echo "  • UT_GENERATE_DOCKER_PASSWORD"
    echo "  • UT_GENERATE_OPENAI_API_KEY (for RAG)"
    echo ""
    echo -e "${BLUE}SECRETS - Not needed for GLM (keep for rollback):${NC}"
    echo "  • UT_GENERATE_AWS_ACCESS_KEY_BEDROCK"
    echo "  • UT_GENERATE_AWS_SECRET_KEY_BEDROCK"
    echo "  • UT_GENERATE_AWS_REGION_BEDROCK"
    echo "  • UT_GENERATE_ANTHROPIC_MODEL"
    echo ""
    echo -e "${BLUE}VARIABLES - Required:${NC}"
    echo "  • UT_GENERATE_AI_TYPE = 2"
    echo ""
    echo -e "${BLUE}VARIABLES - Optional (have defaults):${NC}"
    echo "  • UT_GENERATE_JIRA_PROJECT_KEY (default: BB)"
    echo "  • UT_GENERATE_CONFLUENCE_SPACE_KEY (default: BB)"
    echo ""
else
    echo -e "${YELLOW}Using AWS Bedrock. Ensure these are configured:${NC}"
    echo ""
    echo -e "${BLUE}SECRETS - Required:${NC}"
    echo "  • UT_GENERATE_AWS_ACCESS_KEY_BEDROCK"
    echo "  • UT_GENERATE_AWS_SECRET_KEY_BEDROCK"
    echo "  • UT_GENERATE_AWS_REGION_BEDROCK"
    echo "  • UT_GENERATE_ANTHROPIC_MODEL"
    echo "  • (Plus JIRA and Confluence secrets)"
    echo ""
    echo -e "${BLUE}VARIABLES:${NC}"
    echo "  • UT_GENERATE_AI_TYPE = 1"
    echo ""
fi

# Update GitHub secrets/variables
echo ""
echo -e "${BLUE}Step 6: Update GitHub Secrets/Variables${NC}"
echo ""

# Check if gh is installed
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed${NC}"
        echo "Please install it from: https://cli.github.com/"
        echo ""
        echo -e "${YELLOW}Skipping GitHub configuration. Please configure manually.${NC}"
    else
        # Check if gh is authenticated
        if ! gh auth status &> /dev/null; then
            echo -e "${RED}❌ Error: GitHub CLI is not authenticated${NC}"
            echo "Please run: gh auth login"
            echo ""
            echo -e "${YELLOW}Skipping GitHub configuration. Please configure manually.${NC}"
        else
            echo -e "${GREEN}✅ GitHub CLI is installed and authenticated${NC}"
            echo ""

            # Prompt for repository name
            echo -e "${YELLOW}📦 Enter the repository name (format: owner/repo):${NC}"
            echo -e "${BLUE}   Example: sourcefuse/ai-test-quality-analyzer${NC}"
            read -p "Repository: " REPO_NAME

            if [ -z "$REPO_NAME" ]; then
                echo -e "${YELLOW}⚠️  No repository specified. Skipping GitHub configuration.${NC}"
            elif [[ ! "$REPO_NAME" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ ]]; then
                echo -e "${RED}❌ Error: Invalid repository name format${NC}"
                echo "Expected format: owner/repo"
            else
                # Verify repository access
                echo ""
                echo -e "${BLUE}🔍 Verifying repository access...${NC}"

                if ! gh repo view "$REPO_NAME" &> /dev/null; then
                    echo -e "${RED}❌ Error: Cannot access repository '$REPO_NAME'${NC}"
                else
                    echo -e "${GREEN}✅ Repository access verified${NC}"
                    echo ""

                    # Define prefix
                    SECRET_PREFIX="UT_GENERATE_"

                    echo -e "${BLUE}🔐 Setting GitHub Secrets...${NC}"
                    echo ""

                    SECRETS_SUCCESS=0
                    SECRETS_FAILED=0

                    # Set GLM secrets with UT_GENERATE_ prefix
                    PREFIX="$SECRET_PREFIX"
                        # ANTHROPIC_BASE_URL
                        if [ -n "$GLM_BASE_URL" ]; then
                            SECRET_NAME="${PREFIX}ANTHROPIC_BASE_URL"
                            echo -e "   Setting: $SECRET_NAME"
                            if echo "$GLM_BASE_URL" | gh secret set "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
                                echo -e "   ${GREEN}✅ $SECRET_NAME set${NC}"
                                SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
                            else
                                echo -e "   ${RED}❌ Failed to set $SECRET_NAME${NC}"
                                SECRETS_FAILED=$((SECRETS_FAILED + 1))
                            fi
                        fi

                        # ANTHROPIC_AUTH_TOKEN
                        if [ -n "$GLM_AUTH_TOKEN" ]; then
                            SECRET_NAME="${PREFIX}ANTHROPIC_AUTH_TOKEN"
                            echo -e "   Setting: $SECRET_NAME"
                            if echo "$GLM_AUTH_TOKEN" | gh secret set "$SECRET_NAME" --repo "$REPO_NAME" 2>/dev/null; then
                                echo -e "   ${GREEN}✅ $SECRET_NAME set${NC}"
                                SECRETS_SUCCESS=$((SECRETS_SUCCESS + 1))
                            else
                                echo -e "   ${RED}❌ Failed to set $SECRET_NAME${NC}"
                                SECRETS_FAILED=$((SECRETS_FAILED + 1))
                            fi
                        fi

                    echo ""
                    echo -e "${BLUE}📋 Setting GitHub Variables...${NC}"
                    echo ""

                    VARS_SUCCESS=0
                    VARS_FAILED=0

                    # Set AI_TYPE variable with UT_GENERATE_ prefix
                    VAR_NAME="${SECRET_PREFIX}AI_TYPE"
                    echo -e "   Setting: $VAR_NAME = $AI_TYPE_VALUE"
                    if gh variable set "$VAR_NAME" --body "$AI_TYPE_VALUE" --repo "$REPO_NAME" 2>/dev/null; then
                        echo -e "   ${GREEN}✅ $VAR_NAME set${NC}"
                        VARS_SUCCESS=$((VARS_SUCCESS + 1))
                    else
                        echo -e "   ${RED}❌ Failed to set $VAR_NAME${NC}"
                        VARS_FAILED=$((VARS_FAILED + 1))
                    fi

                    echo ""
                    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
                    echo -e "${BLUE}GitHub Configuration Summary${NC}"
                    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
                    echo ""
                    echo -e "Repository: ${GREEN}$REPO_NAME${NC}"
                    echo -e "Secrets set: ${GREEN}$SECRETS_SUCCESS${NC} success, ${RED}$SECRETS_FAILED${NC} failed"
                    echo -e "Variables set: ${GREEN}$VARS_SUCCESS${NC} success, ${RED}$VARS_FAILED${NC} failed"
                    echo ""
                fi
            fi
        fi
    fi

echo ""
echo -e "${YELLOW}Note: Database configs (DATABASE_*) have defaults and are${NC}"
echo -e "${YELLOW}      auto-configured via Docker during workflow.${NC}"
echo ""
echo -e "${GREEN}Done! 🚀${NC}"
