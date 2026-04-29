# MonthlyRecord_Summary Fallback / Migration Plan (#1713 PR-C)

- Scope: `MonthlyRecord_Summary` (`billing_summary`) only
- Phase intent: **design and guardrails only**
- Non-destructive guarantee: no migration execution, no column deletion, no provisioning change
- Date: 2026-04-29

## 1. Scope

This document defines a safe path for handling data-bearing zombie candidates (especially `Key`) before any destructive action.

In scope:
- Read fallback design
- Write policy design
- Conflict signaling policy
- Migration readiness gates
- Follow-up PR boundaries

Out of scope:
- SharePoint schema/provisioning changes
- Runtime write-path behavior changes
- Data migration execution
- Purge execution

## 2. Current SoT (Three-Point Contract)

Current source-of-truth for `MonthlyRecord_Summary` is treated as the following three-point contract:

1. Registry SoT: `src/sharepoint/spListRegistry.definitions.ts` (`key: billing_summary`)
2. Drift/resolve SoT: `src/sharepoint/fields/billingFields.ts` (`BILLING_SUMMARY_CANDIDATES`)
3. Runtime read/write path: `src/features/records/monthly/map.ts`

Operational note:
- `map.ts` uses `resolveInternalNamesDetailed` to resolve physical names and then applies them in `toSharePointFields`, `fromSharePointFields`, and `upsertMonthlySummary`.

## 3. Risk Fields (Data-Bearing Candidate Groups)

These fields must not be auto-purged until fallback/migration readiness is proven:

- Idempotency group:
  - `Key`
  - `IdempotencyKey`
  - `Idempotency_x0020_Key`
- Total days group:
  - `KPI_TotalDays`
  - `TotalDays`
  - `Total_x0020_Days`
- Completed rows group:
  - `KPI_CompletedRows`
  - `Completed_x0020_Rows`
  - `CompletedCount`
- In-progress rows group:
  - `KPI_InProgressRows`
  - `In_x0020_Progress_x0020_Rows`
  - `PendingCount`
- Empty rows group:
  - `KPI_EmptyRows`
  - `Empty_x0020_Rows`
  - `EmptyCount`
- Incidents group:
  - `KPI_Incidents`
  - `Incidents`
  - `IncidentCount`
- Special notes group:
  - `KPI_SpecialNotes`
  - `Special_x0020_Notes`
  - `SpecialNoteCount`

## 4. Read Fallback Policy

Read resolution policy for each logical field:

1. Canonical-first: attempt canonical internal name first.
2. Fallback-second: if canonical is empty/missing, try approved fallback candidates.
3. Conflict signaling: if both canonical and fallback exist but values differ:
   - emit a conflict signal (telemetry/report)
   - do not silently overwrite either side
4. Metadata separation: metadata-like fields are not treated as business canonical values.

Conflict outcome policy:
- Read may continue with canonical-preferred value, but conflict must be recorded for migration review.

## 5. Write Policy (Pre-Migration)

Before migration readiness is approved:

- Do not start implicit dual-write.
- Keep write target behavior stable and explicit.
- Never write metadata-like fields as business data destinations.
- Canonical-only write switch can be enabled only after readiness gates pass.

Design constraint:
- PR-C does not change runtime writes; it only defines guardrails.

## 6. Migration Readiness Gates

All gates below must pass before any destructive operation (including purge):

1. Data profile completed for each risk field group.
2. Conflict count is zero, or each conflict is explicitly reviewed and accepted.
3. Backup/export evidence exists and is recoverable.
4. Dry-run migration report is reviewed and approved.
5. Rollback plan is documented and testable.
6. Zero-read / zero-fallback observation window is defined for purge eligibility.

## 7. Follow-Up PR Boundaries

- PR-D: Implement read fallback helper and conflict signal emission (non-destructive).
- PR-E: Add dry-run migration report generation and review artifact.
- PR-F: Execute migration (guarded, reversible procedure).
- PR-G: Purge phase only after zero-read/zero-fallback window and approvals.

## 8. Explicit Safety Statement

This plan does **not** decide whether `Key` is canonical or removable.

This plan only ensures that data-bearing candidates are not treated as immediate purge targets and that fallback/migration safety is proven first.
