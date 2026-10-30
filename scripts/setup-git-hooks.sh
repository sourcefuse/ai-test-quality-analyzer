#!/bin/bash

# Git Hooks Setup Script
# Installs pre-commit hooks for secret detection
#
# Usage: ./setup-git-hooks.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Git Hooks Setup - Secret Detection${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if we're in a git repository (handles both regular repos and worktrees)
if [ ! -d ".git" ] && [ ! -f ".git" ]; then
    echo -e "${RED}❌ Error: Not a git repository${NC}"
    echo "   Please run this script from the root of your git repository"
    exit 1
fi

# Determine the actual git directory (handles worktrees)
if [ -f ".git" ]; then
    # This is a git worktree - extract the gitdir path
    GIT_DIR=$(grep "gitdir:" .git | sed 's/gitdir: //')
    HOOKS_DIR="$GIT_DIR/hooks"
else
    # Regular git repository
    HOOKS_DIR=".git/hooks"
fi

# Create git hooks directory if it doesn't exist
if [ ! -d "$HOOKS_DIR" ]; then
    echo -e "${YELLOW}⚠️  Creating $HOOKS_DIR directory...${NC}"
    mkdir -p "$HOOKS_DIR"
fi

echo -e "${BLUE}📍 Using hooks directory: $HOOKS_DIR${NC}"

# Check if our hooks directory exists
if [ ! -d ".git-hooks" ]; then
    echo -e "${RED}❌ Error: .git-hooks directory not found${NC}"
    echo "   Expected location: .git-hooks/pre-commit"
    exit 1
fi

# Install pre-commit hook
echo -e "${BLUE}📦 Installing pre-commit hook (secret detection)...${NC}"

if [ ! -f ".git-hooks/pre-commit" ]; then
    echo -e "${RED}❌ Error: .git-hooks/pre-commit not found${NC}"
    exit 1
fi

# Copy hook to hooks directory
cp .git-hooks/pre-commit "$HOOKS_DIR/pre-commit"

# Make executable
chmod +x "$HOOKS_DIR/pre-commit"

echo -e "${GREEN}✅ Pre-commit hook installed successfully${NC}"

# Verify installation
if [ -x "$HOOKS_DIR/pre-commit" ]; then
    echo -e "${GREEN}✅ Hook is executable${NC}"
else
    echo -e "${RED}❌ Error: Hook is not executable${NC}"
    exit 1
fi

# Install prepare-commit-msg hook
echo ""
echo -e "${BLUE}📦 Installing prepare-commit-msg hook (AI co-author filter)...${NC}"

if [ ! -f ".git-hooks/prepare-commit-msg" ]; then
    echo -e "${YELLOW}⚠️  .git-hooks/prepare-commit-msg not found - skipping${NC}"
else
    # Copy hook to hooks directory
    cp .git-hooks/prepare-commit-msg "$HOOKS_DIR/prepare-commit-msg"

    # Make executable
    chmod +x "$HOOKS_DIR/prepare-commit-msg"

    echo -e "${GREEN}✅ Prepare-commit-msg hook installed successfully${NC}"

    # Verify installation
    if [ -x "$HOOKS_DIR/prepare-commit-msg" ]; then
        echo -e "${GREEN}✅ Hook is executable${NC}"
    else
        echo -e "${RED}❌ Error: Hook is not executable${NC}"
        exit 1
    fi
fi

# Test the hook
echo ""
echo -e "${BLUE}🧪 Testing hook installation...${NC}"

# Create a temporary test file with a fake secret
# Built at runtime so the script source does not trip secret scanners
TEST_FILE=".test-secret-detection.tmp"
FAKE_AWS_KEY="AKIA$(printf '%016d' 0)"
echo "API_KEY=${FAKE_AWS_KEY}" > "$TEST_FILE"
git add "$TEST_FILE" 2>/dev/null || true

# Run the hook
if "$HOOKS_DIR/pre-commit" 2>&1 | grep -q "secret"; then
    echo -e "${GREEN}✅ Secret detection is working!${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Hook may not be detecting secrets properly${NC}"
fi

# Clean up test file
git rm --cached -q "$TEST_FILE" 2>/dev/null || true
rm -f "$TEST_FILE"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Git hooks setup complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}What happens now:${NC}"
echo ""
echo -e "${BLUE}1. Pre-commit hook (secret detection):${NC}"
echo "   • Runs automatically before each commit"
echo "   • Scans for hardcoded secrets and API keys"
echo "   • Blocks commits with secrets"
echo "   • Validates .env.example for placeholder values"
echo ""
echo -e "${BLUE}2. Prepare-commit-msg hook (AI co-author filter):${NC}"
echo "   • Removes Claude/AI co-authorship from commit messages"
echo "   • Prevents 'Co-authored-by: Claude' in commits"
echo "   • Keeps your commit history clean"
echo ""
echo -e "${BLUE}To bypass hooks (not recommended):${NC}"
echo "  git commit --no-verify"
echo ""
echo -e "${BLUE}Secret patterns detected:${NC}"
echo "  • AWS credentials (AKIA*, aws_secret_access_key)"
echo "  • Atlassian tokens (ATATT*, ATCTT*)"
echo "  • OpenAI API keys (sk-*)"
echo "  • Anthropic API keys (sk-ant-*)"
echo "  • GitHub tokens (ghp_*, github_pat_*)"
echo "  • Private keys (RSA, SSH, PGP)"
echo "  • Database connection strings"
echo "  • OAuth client secrets"
echo "  • Slack tokens"
echo "  • Docker Hub tokens"
echo "  • Generic API keys and tokens (20+ chars)"
echo ""
echo -e "${GREEN}Happy (and secure) coding! 🔒${NC}"
