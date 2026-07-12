# Nightly Investigation Note - 2026-07-10

## Header

- Investigation date: 2026-07-10
- Repository: `yasutakesougo/audit-management-system-mvp`
- Target branch: not started
- Target commit: not started
- Default branch SHA: not recorded for execution
- Time window: 3 hours, planned
- Operator: Codex / user-supervised
- Overall judgment: `BLOCKED`

## Start Gate Status

| Gate | Status | Evidence |
| --- | --- | --- |
| PR #2392 merged | satisfied | PR #2392 is `MERGED`; merge commit `acdc000d3f4569c1e1058f99c1e3463cbd0f6f83` |
| PR #2392 required CI green | satisfied with note | Rerun checks include successful CI, CI Preflight, Quality Gates, Smoke Tests, E2E Deep Tests; earlier cancelled checks remain in history |
| Old `SP_TOKEN` revoked | unverified | Secret value and revocation state cannot be checked from CLI without exposing credentials |
| New `SP_TOKEN` configured | unverified | `SP_TOKEN` name exists, but whether it is the rotated token is not inferable from metadata |
| `Nightly Patrol` enabled | blocked | `.github/workflows/nightly-patrol.yml` state is `disabled_manually` |
| Secret-safe diagnostics active | partially satisfied | PR #2392 is merged; post-merge manual safety run is still pending |
| Previous leaked artifacts absent | unverified | Recent artifact names were listed without content inspection; full historical content scan was not performed |
| Target branch and SHA recorded | not_applicable | No workflow dispatch was started |

## Workflow State

| Workflow | Path | State |
| --- | --- | --- |
| Nightly Health | `.github/workflows/nightly-health.yml` | `active` |
| Nightly Patrol | `.github/workflows/nightly-patrol.yml` | `disabled_manually` |
| Nightly Runtime Patrol | `.github/workflows/nightly-runtime-patrol.yml` | `active` |

## Secrets and Variables Snapshot

Values were not read or printed. Only secret or variable names were checked.

| Name | Status | Notes |
| --- | --- | --- |
| `SP_TOKEN` | configured | New-vs-old token state unverified |
| `VITE_SP_RESOURCE` | missing | Not listed as GitHub Secret or Variable |
| `VITE_SP_SITE_RELATIVE` | missing | Not listed as GitHub Secret or Variable |
| `VITE_SP_SCOPE_DEFAULT` | configured | Listed as GitHub Secret |
| `SPO_CERT_BASE64` | configured | Listed as GitHub Secret |
| `SPO_CERT_PASSWORD` | configured | Listed as GitHub Secret |
| `AAD_APP_ID` | configured | Listed as GitHub Secret |
| `AAD_TENANT_ID` | configured | Listed as GitHub Secret |
| `SHAREPOINT_SITE` | configured | Listed as GitHub Secret |
| `TEAMS_WEBHOOK_URL` | configured | Listed as GitHub Secret |

Additional observed secret name:

- `NIGHTLY_SP_TOKEN`: configured

## Runs

No three-workflow investigation run was started because the start gate failed.

| Workflow | Run ID | URL | Commit | Started | Finished | Conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| Nightly Health | not run | | | | | `BLOCKED` |
| Nightly Patrol | not run | | | | | `BLOCKED` |
| Nightly Runtime Patrol | not run | | | | | `BLOCKED` |

## Severity Summary

| Severity | Count |
| --- | ---: |
| critical | 0 |
| action_required | 0 |
| watch | 0 |
| silent | 0 |

Counts are zero because the investigation did not start. They are not evidence
of a green nightly state.

## Findings

- Occurred at: pre-dispatch start gate
- Workflow/job: `Nightly Patrol`
- Symptom: workflow is `disabled_manually`
- Reproducibility: confirmed by `gh workflow list --all` and workflow API state
- Impact: the required three-workflow sequence cannot safely start

## Cause Analysis

Confirmed facts:

- PR #2392 is merged into `main`.
- `Nightly Health` is active.
- `Nightly Runtime Patrol` is active.
- `Nightly Patrol` is disabled manually.
- `SP_TOKEN` exists by name in GitHub Actions Secrets.
- The CLI cannot prove whether the configured `SP_TOKEN` is newly rotated or still the old credential without exposing secret material.

Inferred causes:

- The sequence remains intentionally blocked as part of secret exposure containment.
- Enabling `Nightly Patrol` before token rotation evidence and a safety run would prematurely end containment.

Unknowns:

- Whether the old `SP_TOKEN` has been revoked.
- Whether the current `SP_TOKEN` value is the newly rotated token.
- Whether post-PR #2392 artifact/log diagnostics have been exercised safely with the new token.
- Whether all previous leaked artifact contents have been fully removed or made inaccessible.

## Actions

Same-night actions:

- Did not run `Nightly Health`, `Nightly Patrol`, or `Nightly Runtime Patrol` as a sequence.
- Recorded the start-gate state as `BLOCKED`.
- Added a reusable runbook at `docs/ops/nightly-investigation-runbook.md`.

Next business day actions:

- Confirm old `SP_TOKEN` revocation in the identity provider or SharePoint access path.
- Set or confirm the newly rotated `SP_TOKEN` in GitHub Actions Secrets without exposing its value.
- Re-enable `Nightly Patrol` only after credential rotation evidence is available.
- Run a safety-focused manual `Nightly Patrol` execution and verify artifact/log output does not include secrets.

Next maintenance actions:

- After the safety run passes, execute the full three-workflow investigation sequence.
- Save one investigation note with Run IDs, artifact locations, severity counts, and final judgment.

## Ownership

- Owner: Operations / repository administrator
- Due date: before next full nightly investigation
- Related issues: none recorded in this note
- Related PRs: PR #2392

## Evidence

- Saved artifacts: none collected for this blocked investigation
- Key logs: workflow and secret metadata checks only
- Secret scan result: values were not inspected; no secret values were printed in this note

