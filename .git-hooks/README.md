# Git Hooks Documentation

This directory contains custom Git hooks for maintaining code security and quality.

## Available Hooks

### 1. Pre-Commit Hook (Secret Detection)

**Location**: `.git-hooks/pre-commit`

**Purpose**: Prevents accidental commits of sensitive data like API keys, tokens, and credentials.

**What it checks**:
- ✅ AWS credentials (Access Keys, Secret Keys)
- ✅ Atlassian tokens (JIRA/Confluence API tokens)
- ✅ OpenAI API keys
- ✅ Anthropic API keys (Claude)
- ✅ GitHub Personal Access Tokens
- ✅ Private keys (RSA, SSH, PGP)
- ✅ Database connection strings
- ✅ OAuth client secrets
- ✅ Slack tokens
- ✅ Docker Hub credentials
- ✅ Generic API keys and tokens
- ✅ `.env.example` validation (ensures only placeholders)

**How it works**:
1. Scans all staged files before commit
2. Uses regex patterns to detect secret formats
3. Validates `.env.example` contains only placeholder values
4. Blocks commit if secrets are found
5. Provides helpful error messages and recommendations

**Example Output** (when secrets detected):
```
🔒 Running pre-commit secret detection...
❌ Potential secret found in src/config.ts (line 42):
   API_KEY=AKIA1234567890123456

╔════════════════════════════════════════════════════════════════╗
║  ⚠️  COMMIT BLOCKED - Potential secrets detected!             ║
╚════════════════════════════════════════════════════════════════╝

Found 1 potential secret(s) in staged files.

Recommendations:
  1. Remove hardcoded secrets from your code
  2. Use environment variables instead
  3. Ensure .env.example only contains placeholders
  4. Add sensitive files to .gitignore

To bypass this check (not recommended):
  git commit --no-verify
```

**Bypassing** (emergency only):
```bash
git commit --no-verify -m "Your message"
```

### 2. Prepare-Commit-Msg Hook (AI Co-Author Filter)

**Location**: `.git-hooks/prepare-commit-msg`

**Purpose**: Automatically removes AI co-authorship from commit messages.

**What it does**:
- Removes `Co-authored-by: Claude <noreply@anthropic.com>`
- Removes any ChatGPT, OpenAI, or Copilot co-authorship
- Keeps your git history clean and professional

**Example**:

Before hook:
```
feat: add authentication service

Implemented JWT-based authentication

Co-authored-by: Claude <noreply@anthropic.com>
```

After hook:
```
feat: add authentication service

Implemented JWT-based authentication
```

## Installation

### Automatic Installation (Recommended)

Run the setup script from the project root:

```bash
chmod +x setup-git-hooks.sh
./setup-git-hooks.sh
```

This will:
1. Copy hooks from `.git-hooks/` to `.git/hooks/`
2. Make hooks executable
3. Verify installation
4. Run a test to ensure secret detection works

### Manual Installation

```bash
# Copy pre-commit hook
cp .git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Copy prepare-commit-msg hook
cp .git-hooks/prepare-commit-msg .git/hooks/prepare-commit-msg
chmod +x .git/hooks/prepare-commit-msg
```

### Verification

Check if hooks are installed:

```bash
ls -la .git/hooks/
```

You should see:
- `pre-commit` (executable)
- `prepare-commit-msg` (executable)

## Configuration

### Customizing Secret Patterns

Edit `.git-hooks/pre-commit` to add custom patterns:

```bash
declare -a SECRET_PATTERNS=(
    # Your custom pattern
    "my-custom-secret-pattern"

    # Existing patterns...
)
```

### Customizing Placeholder Patterns

For `.env.example` validation, edit the placeholder patterns:

```bash
declare -a PLACEHOLDER_PATTERNS=(
    "your-custom-placeholder"
    # Existing patterns...
)
```

### Disabling Specific Checks

Comment out patterns you don't need:

```bash
declare -a SECRET_PATTERNS=(
    # "AKIA[0-9A-Z]{16}"  # Disabled AWS check
    "api[_-]?key['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{20,}"  # Still active
)
```

## Best Practices

### 1. Never Bypass Hooks Without Review

Only use `--no-verify` if you're absolutely certain there are no secrets:

```bash
# ❌ Bad: Blindly bypassing
git commit --no-verify -m "Quick fix"

# ✅ Good: Review first, then bypass if safe
git diff --cached
# Verify no secrets present
git commit --no-verify -m "Safe commit"
```

### 2. Use Environment Variables

Instead of hardcoding:

```typescript
// ❌ Bad
const apiKey = 'sk-proj-abc123xyz';

// ✅ Good
const apiKey = process.env.API_KEY;
```

### 3. Keep .env.example Clean

Always use placeholders in `.env.example`:

```bash
# ❌ Bad
JIRA_URL=https://sourcefuse.atlassian.net
JIRA_EMAIL=real.person@sourcefuse.com
JIRA_API_TOKEN=ATATT3xFfGF0123456789

# ✅ Good
JIRA_URL=https://your-instance.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

### 4. Add Sensitive Files to .gitignore

```gitignore
# Environment files
.env
.env.local
.env.production

# Credentials
credentials.json
secrets.yml
*.pem
*.key
```

## Troubleshooting

### Hook Not Running

**Problem**: Commits succeed even with secrets

**Solution**:
```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# If missing, reinstall
./setup-git-hooks.sh

# Check if executable
chmod +x .git/hooks/pre-commit
```

### False Positives

**Problem**: Hook blocks legitimate code

**Solution**:
1. Review the detected pattern
2. If it's not a real secret, refactor the code
3. If unavoidable, bypass once with `--no-verify` (document why)

### Hook Too Slow

**Problem**: Pre-commit takes too long

**Solution**:
- The hook only scans staged files (fast)
- If slow, check for large binary files in staging area
- Consider excluding binary files from pattern matching

## Testing

### Test Secret Detection

Create a test file with a fake secret:

```bash
echo "API_KEY=AKIA1234567890123456" > test-secret.txt
git add test-secret.txt
git commit -m "Test commit"  # Should be blocked
git reset HEAD test-secret.txt
rm test-secret.txt
```

### Test .env.example Validation

Add a real credential to `.env.example`:

```bash
# Add this line temporarily
echo "REAL_EMAIL=john.doe@sourcefuse.com" >> .env.example
git add .env.example
git commit -m "Test"  # Should be blocked
git checkout .env.example  # Restore
```

## Maintenance

### Updating Hooks

When hooks are updated in `.git-hooks/`:

```bash
# Re-run setup script
./setup-git-hooks.sh
```

### Sharing Hooks with Team

The `.git-hooks/` directory is tracked in git, so team members can:

```bash
# After cloning repository
./setup-git-hooks.sh
```

## Security Notes

1. **Hooks are not foolproof**: Determined users can bypass with `--no-verify`
2. **Server-side validation**: Consider GitHub Actions for additional security
3. **Rotate secrets**: If secrets are accidentally committed, rotate them immediately
4. **Review history**: Use `git log -p` to check for historical leaks
5. **Use secret scanning**: Enable GitHub secret scanning in repository settings

## Related Documentation

- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [SourceFuse Security Best Practices](../../SECURITY.md)
- [Environment Variables Guide](../../README.md#configuration)

## Support

For issues or questions:
1. Check this documentation
2. Review hook source code in `.git-hooks/`
3. Open an issue in the repository
4. Contact the DevSecOps team

---

**Last Updated**: 2025-01-07
**Maintained By**: Vishal Gupta
