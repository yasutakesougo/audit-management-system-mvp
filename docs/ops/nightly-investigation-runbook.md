# Nightly Investigation Runbook

Last updated: 2026-07-10

## Purpose

This runbook defines the safe procedure for a same-night investigation using the
three GitHub Actions workflows:

- `Nightly Health`
- `Nightly Patrol`
- `Nightly Runtime Patrol`

The investigation is read-only from the product code perspective. Its purpose is
to detect operational anomalies, collect evidence, make a first-pass severity
classification, and decide follow-up priority.

## Start Gate

Do not run the three-workflow sequence unless every gate below is satisfied.
If any gate is not satisfied, record the investigation result as `BLOCKED`.

| Gate | Required state |
| --- | --- |
| Secret guard PR | PR #2392 is merged into the target branch |
| Required CI | Required checks for PR #2392 are green after rerun if needed |
| Old credential | The leaked or potentially leaked old `SP_TOKEN` is revoked |
| New credential | A new `SP_TOKEN` is set in GitHub Actions Secrets |
| Workflow state | `Nightly Patrol` is no longer `disabled_manually` |
| Secret-safe diagnostics | Artifact/log diagnostics avoid printing secret values |
| Historical artifacts | Previously leaked artifacts are deleted or confirmed absent |
| Target identity | Repository, branch, and commit SHA are recorded |

Secrets and variables must be checked by name only. Never copy secret values into
logs, notes, screenshots, PR comments, or artifacts.

## Preflight Record

Before dispatching workflows, record:

- Repository
- Target branch
- Target commit SHA
- Default branch SHA
- Investigation start time
- Investigation time window, default `3 hours`
- Operator
- Reason if the target is not latest `main`

Record these settings as `configured`, `missing`, or `not_required`:

- `SP_TOKEN`
- `VITE_SP_RESOURCE`
- `VITE_SP_SITE_RELATIVE`
- `VITE_SP_SCOPE_DEFAULT`
- `SPO_CERT_BASE64`
- `SPO_CERT_PASSWORD`
- `AAD_APP_ID`
- `AAD_TENANT_ID`
- `SHAREPOINT_SITE`
- `TEAMS_WEBHOOK_URL`

## Dispatch Order

Run workflows in this exact order after each previous workflow completes and its
evidence is saved:

1. `Nightly Health`
2. `Nightly Patrol`
3. `Nightly Runtime Patrol`

Record for every run:

- Run ID and URL
- Commit SHA
- Start and end time
- Conclusion
- Failed job and step, if any
- Artifact names

Stop immediately if a log or artifact may contain a secret value. Revoke the
credential, isolate or delete the artifact, and classify the investigation as
`CRITICAL`.

## Workflow Checks

### Nightly Health

Primary checks:

- `e2e`
- `ci:e2e`
- `ci:perf-report`

If this workflow fails but there is no evidence of secret exposure, collect the
logs and artifacts, then continue only if later workflows are still safe and
useful for diagnosis.

### Nightly Patrol

Primary checks:

- Contract patrol
- `act(...)` warning monitor
- Coverage scan
- Telemetry lane assertion
- Decision summary
- Artifact scan

Record counts for:

- `critical`
- `action_required`
- `watch`
- `silent`

If `critical` is detected, normal sequential execution may be stopped. If
`Nightly Runtime Patrol` is skipped, record the reason.

### Nightly Runtime Patrol

Required artifacts:

- `.nightly/runtime-summary.md`
- `.nightly/runtime-summary.json`

If these files are missing, classify the investigation as `INCOMPLETE` even if
the workflow conclusion is `success`.

## Analysis Rules

Analyze in this order:

1. Runtime severity from `runtime-summary`.
2. Nightly decision classification.
3. `act(...)` warning and coverage trend.

Severity handling:

| Classification | Required action |
| --- | --- |
| `critical` | Immediate containment or operational stop |
| `action_required` | Investigation or remediation by next business day |
| `watch` | Continue monitoring until the next nightly investigation |
| `silent` | Evidence only, no action |

Coverage and `act(...)` warnings are not regressions on a single-night change
alone. Treat them as regression candidates only if they deviate from the 7-day
baseline and reproduce on the same commit with the relevant job rerun.

## Rerun Rules

Do not rerun all three workflows by default. Rerun only the job or workflow
needed to fix the cause classification.

Rerun is allowed when:

- GitHub Actions infrastructure failure is suspected.
- External service transient failure is suspected.
- Coverage or `act(...)` warning drift deviates from the 7-day baseline.
- Reproducibility must be confirmed on the same commit.

Always link the original Run ID and rerun Run ID. Keep the first failure in the
record even if the rerun succeeds.

## Final Judgment

| Judgment | Condition |
| --- | --- |
| `GREEN` | All required workflows complete, `critical=0`, `action_required=0`, required artifacts present |
| `ACTION_REQUIRED` | One or more `action_required` items exist |
| `CRITICAL` | Immediate containment, secret exposure, data corruption, or operational stop is needed |
| `WATCH` | Only `watch` items exist and no immediate action is required |
| `BLOCKED` | Start gate, credentials, permissions, or workflow state prevents execution |
| `INCOMPLETE` | Workflow or required artifacts are missing |

Successful workflow conclusions alone are not sufficient for `GREEN`; required
artifacts must also be present.

## Investigation Note Template

Use one investigation note per investigation.

```markdown
# Nightly Investigation Note - YYYY-MM-DD

## Header

- Investigation date:
- Repository:
- Target branch:
- Target commit:
- Default branch SHA:
- Time window:
- Operator:
- Overall judgment:

## Runs

| Workflow | Run ID | URL | Commit | Started | Finished | Conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| Nightly Health | | | | | | |
| Nightly Patrol | | | | | | |
| Nightly Runtime Patrol | | | | | | |

## Severity Summary

| Severity | Count |
| --- | ---: |
| critical | |
| action_required | |
| watch | |
| silent | |

## Findings

- Occurred at:
- Workflow/job:
- Symptom:
- Reproducibility:
- Impact:

## Cause Analysis

Confirmed facts:

- 

Inferred causes:

- 

Unknowns:

- 

## Actions

Same-night actions:

- 

Next business day actions:

- 

Next maintenance actions:

- 

## Ownership

- Owner:
- Due date:
- Related issues:
- Related PRs:

## Evidence

- Saved artifacts:
- Key logs:
- Secret scan result:
```

