## Branch Protection Configuration

Configure these rules in GitHub Settings > Branches > Branch protection rules.

### Target Branches
- `main`
- Optionally `develop` (if used for integration)

### Required Status Checks (exact names)
Add these as required checks before merging:

1. `Quality Gates` (workflow: test.yml)
2. `Provision WhatIf (PR)` (workflow: provision-whatif-pr.yml) – only triggers on schema changes / label

If you also want to block merges until the backfill smoke passes (manual or scheduled):
- `Backfill entry_hash (Smoke)`

### Recommended Settings
- Require status checks to pass before merging: ✅
- Require branches to be up to date before merging: ✅
- Dismiss stale pull request approvals when new commits are pushed: ✅
- Require linear history: Optional (enable if no merge commits policy desired)
- Require signed commits: Optional (enable if org policy mandates)

### Labels & Conditional Workflows
The label `schema` is applied automatically by `Label Schema Changes` workflow when provisioning files change. You can manually add `schema` label to force-run the WhatIf workflow on a PR even if paths did not change (e.g., retesting credentials or site).

### Adding New Required Checks
When introducing a new workflow, ensure:
1. `name:` field is stable and descriptive.
2. Jobs expose a consistent success/failure (avoid `continue-on-error`).
3. After first successful run on the target branch, add the workflow name to the protection rule.

### Troubleshooting
| Symptom | Likely Cause | Resolution |
|--------|--------------|-----------|
| Required check never appears | Workflow never ran on that branch | Push a trivial commit or rerun from Actions tab |
| WhatIf workflow skipped | No provisioning file change & `schema` label absent | Add `schema` label to PR |
| Coverage threshold failure | `vitest.config.ts` thresholds exceeded by new code | Add/adjust tests or lower threshold only with team consensus |

### Periodic Review
Quarterly: confirm checks still match active workflows (retire deprecated ones). Ensure CODEOWNERS or review rules align with protection policies.
