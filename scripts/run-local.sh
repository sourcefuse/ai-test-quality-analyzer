#!/bin/bash

# Read .env file and extract JIRA_PROJECT_KEY
if [ -f ".env" ]; then
  echo "📋 Reading .env file..."
  export $(grep -v '^#' .env | grep -E 'JIRA_PROJECT_KEY=' | xargs)

  if [ -n "$JIRA_PROJECT_KEY" ]; then
    echo "✅ Found JIRA_PROJECT_KEY: $JIRA_PROJECT_KEY"

    # Delete folders starting with JIRA_PROJECT_KEY
    echo "🗑️  Searching for folders starting with '$JIRA_PROJECT_KEY'..."

    # Find and delete folders matching the pattern
    folders_found=false
    for folder in "${JIRA_PROJECT_KEY}"*; do
      if [ -d "$folder" ]; then
        folders_found=true
        echo "   Deleting folder: $folder"
        rm -rf "$folder"
      fi
    done

    if [ "$folders_found" = false ]; then
      echo "   No folders found starting with '$JIRA_PROJECT_KEY'"
    else
      echo "✅ Cleanup completed"
    fi
  else
    echo "⚠️  JIRA_PROJECT_KEY not found in .env file"
  fi
else
  echo "⚠️  .env file not found, skipping cleanup"
fi

echo ""

# Create repo directory if it doesn't exist
mkdir -p repo

# Prompt for repository name
read -p "Enter GitHub repository name (e.g., loopback4-microservice-catalog): " REPO_NAME

# Prompt for branch name
read -p "Enter branch name (default: dev): " BRANCH_NAME
BRANCH_NAME=${BRANCH_NAME:-dev}

# Clean up existing repo if it exists
if [ -d "repo/$REPO_NAME" ]; then
  echo "Removing existing repository..."
  rm -rf "repo/$REPO_NAME"
fi

# Clone the repository
echo "Cloning repository: https://github.com/sourcefuse/$REPO_NAME.git (branch: $BRANCH_NAME)"
cd repo && git clone --depth 1 --branch "$BRANCH_NAME" --single-branch "https://github.com/sourcefuse/$REPO_NAME.git" .

if [ $? -eq 0 ]; then
  echo "Repository cloned successfully to repo/$REPO_NAME"
else
  echo "Failed to clone repository. Please check the repository name and branch."
  exit 1
fi

npm run start

npm run fetch-confluence-rag
