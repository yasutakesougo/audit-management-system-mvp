# Post-Merge Checklist

**PURPOSE**: Verify main branch stability after merging a PR with CI/E2E changes.

**TIME**: ~10 minutes (5 min automated, 5 min manual spot-checks)

---

## 1️⃣ Sync & Verify Main

```bash
# Switch to main and pull latest
git switch main
git pull origin main

# Show current branch
git branch -v
```

**Expected**: HEAD is at latest merge commit (typically from PR merge)

---

## 2️⃣ Check Main Actions (Critical)

```bash
# Show last 5 workflow runs on main
gh run list --branch main -L 5 --json databaseId,name,status,conclusion,createdAt \
  -q '.[] | {id:.databaseId,name,status,conclusion,createdAt}'
```

**Expected**: Most recent runs are `SUCCESS`. If any are `FAILURE`:
- ⚠️ **Stop here**. Check failed job logs (see Troubleshooting section)
- Consider immediate `git revert <merge_commit_sha> && git push origin main`

---

## 3️⃣ Local Smoke Tests (Optional but Recommended)

For E2E or config changes, run smoke suite locally:

```bash
# Ensure dependencies are installed
npm ci

# Run smoke tests using main config
npx playwright test tests/e2e \
  --config=playwright.config.ts \
  --project=smoke \
  --reporter=list
```

**Expected**: All tests pass (0 failures). If failures occur:
- Check if test output mentions missing elements (auth issue)
- Check if environment variables are properly set (VITE_E2E, VITE_DEMO_MODE)

---

## 4️⃣ Manual Smoke (Optional but Thorough)

Start a local preview and spot-check UI:

```bash
# Terminal 1: Build and preview with E2E env
VITE_E2E='1' VITE_DEMO_MODE='1' VITE_SKIP_LOGIN='1' VITE_SKIP_SHAREPOINT='1' npm run build
VITE_E2E='1' npm run preview -- --host 127.0.0.1 --port 5173
```

```bash
# Terminal 2: Open in browser
open http://localhost:5173
```

**Spot-Check Checklist**:
- [ ] AppShell loads (logo, nav visible)
- [ ] Checklist nav item appears (click to navigate)
- [ ] Health / Diagnostics page (環境診断) loads heading
- [ ] Schedule Week view shows grid or empty state
- [ ] No console errors (check DevTools console)

**Exit**: `Ctrl+C` to stop preview server

---

## 5️⃣ Cleanup Local Branches (Optional)

Remove merged branches:

```bash
# Fetch pruned refs
git fetch -p

# List and delete merged branches
git branch --merged main | egrep -v '^\*| main$' | xargs -n 1 git branch -d
```

---

## 6️⃣ Plan Next Steps

### ✅ If Main is Green

**Immediate**:
1. Create follow-up PR for "re-occurrence prevention"
   - Consolidate test helpers (waitForAppReady, waitForRouteReady)
   - Document VITE_* env var propagation in playwr configs
   - Examples: [playwright-config-guide.md](playwright-config-guide.md)

**Example Follow-Up PR**:
```bash
git switch -c chore/e2e-waiter-consolidation
# ... make changes
git push origin chore/e2e-waiter-consolidation
gh pr create --title "test(e2e): consolidate wait helpers and config env mapping"
```

### ❌ If Main Failed

**Immediate Recovery**:
```bash
# 1. Identify merge commit
git log --oneline -n 5

# 2. Revert the merge
git revert <merge_commit_sha> -m 1
git push origin main

# 3. After main is green again, create a fix PR
git switch -c fix/revert-and-fix-<issue>
# ... debug and fix the root cause
```

---

## Troubleshooting

### "E2E tests fail with 'element not found'"

**Likely Cause**: Authorization not initialized (authzReady=false)

**Check**:
```bash
# 1. Verify VITE_E2E is set in playwright config
grep -n "VITE_E2E" playwright.config.ts playwright.smoke.config.ts

# 2. Check that test file is in smokeTestMatch array
grep -A 10 "smokeTestMatch" playwright.smoke.config.ts
```

**Fix**:
- Add test file to `playwright.smoke.config.ts` `smokeTestMatch` array
- Or ensure `VITE_E2E: '1'` is set in `webServerEnvVars`

### "Main Actions showed FAILURE"

**Check**:
```bash
# Get run ID of failed job
RUN_ID=<from gh run list output>

# View failure details
gh run view $RUN_ID --log-failed | tail -200
```

**Common Causes**:
1. **actionlint annotation overflow** - check `.github/workflows/actionlint.yml` shellcheck flags
2. **Missing environment variable in workflow** - check `.github/workflows/smoke.yml` `env:` section
3. **Playwright config regression** - check `playwright.config.ts` or `playwright.smoke.config.ts` syntax

---

## Reference: Environment Variable Propagation

### For Local Development

```bash
# Use playwright.smoke.config.ts (includes VITE_E2E)
npm run e2e:smoke

# Or manually:
VITE_E2E='1' VITE_DEMO_MODE='1' npm run preview &
npx playwright test tests/e2e --config=playwright.config.ts --project=smoke
```

### For CI (smoke.yml)

```yaml
env:
  VITE_E2E: '1'  # Line 177 - for test runner
  ...

# Build step (Line 143):
run: VITE_E2E='1' VITE_E2E_MSAL_MOCK='1' ... npm run build

# Test step (Line 193-197):
run: npx playwright test tests/e2e \
  --config=playwright.config.ts \
  --project=smoke
```

**Key Files**:
- `playwright.config.ts` - Main config (used by CI with smoke project)
- `playwright.smoke.config.ts` - Local smoke dev config
- `.github/workflows/smoke.yml` - CI workflow (sets env + runs tests)

---

## Quick Commands Reference

```bash
# Last 5 main runs
gh run list --branch main -L 5 --json name,status,conclusion

# Last failed run on main
gh run list --branch main -L 1 --json number,status,conclusion | grep FAILURE

# Show log of specific run
gh run view <RUN_ID> --log

# Show failed job logs only
gh run view <RUN_ID> --log-failed

# Revert merge commit (use -m 1 for PR merges with 2 parents)
git revert <COMMIT_SHA> -m 1

# Clean merged branches
git fetch -p && git branch --merged main | egrep -v '^\*| main$' | xargs -n 1 git branch -d
```

---

**Created**: 2026-02-06  
**Last Updated**: 2026-02-06  
**Status**: Active - use after each PR merge affecting CI/E2E

