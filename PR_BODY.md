## Summary
Add SharePoint Index Advisor operational rules, a guarded remediation service, and a one-click remediation UI — closing the loop from detection to repair.

## Changes

This PR is split across four layers:

### 1. SharePoint foundation layer (`86ee6d94`)
- add `updateField` support via SharePoint REST API for field property updates such as `Indexed`
- add `emitIndexRemediationRecord` to persist remediation success/failure through the drift event flow

### 2. Health / advisor layer (`7a8583d7`)
- add operational rules documentation for index design thresholds and remediation decisions
- add `spIndexRemediationService.ts` to execute index remediation and record audit results
- add manual remediation scripts for attendance, schedule, and support domains
- add optional list coverage and related health/remediation tests

### 3. Remediation guards (`f6887762`)
- replace `IndexRemediationResult` with `RemediationResult` (discriminated union: `ok / code`)
- seal `delete` action at service layer — UI exposure cannot bypass this (`delete_disabled`)
- add daily execution limit (5/day) via `sessionStorage` (`daily_limit_exceeded`)
- add same-field duplicate prevention per session (`duplicate_action`)
- count and executed-set updated only on success, not on failure
- update operational run scripts and spec to use new result shape (8 guard cases)

### 4. Guarded remediation UI (`cf23791b`)
- add "インデックス追加" button to `additionCandidates` rows only in `SpIndexPressurePanel`
- `runningKey` disables all row buttons while one action is in flight (no parallel execution)
- `resultMap` stores per-row `RemediationResult`; shows `code`-based Japanese message
- success: button becomes "完了" (permanently disabled) + `handleReload()` for immediate re-check
- failure: guard reason shown inline; button remains re-pressable
- deletion candidates remain read-only — no button exposed
- add `SpIndexPressurePanel.spec.tsx` (7 cases): success, duplicate, limit, running-state disable

### 5. Nightly Patrol integration — Mode B: guarded add only
- add `nightly-index-remediation.ts`: Node.js-compatible remediation module
  - allowlist only (`KNOWN_REQUIRED_INDEXED_FIELDS` — no unknown lists)
  - `add` only (delete remains sealed)
  - per-run limit (`NIGHTLY_RUN_LIMIT=3`, overridable via `config.runLimit`)
  - in-memory executed-set (no sessionStorage — Node.js compatible)
  - fail-soft: field-level and list-level errors are caught independently
  - all results carry `source: 'nightly'`
- integrate into `nightly-runtime-patrol.ts`: runs after SP event fetch, before aggregation
  - results converted to `RawEvent[]` (type `'remediation'`) and merged into nightly summary
  - skips gracefully if `VITE_SP_TOKEN` / `VITE_SP_SITE_URL` not set
- add `nightly-index-remediation.spec.ts` (6 cases, `@vitest-environment node`):
  - add missing fields, skip already-indexed, runLimit + skipped_limit, fail-soft PATCH,
    fail-soft list fetch, source: nightly on all results

## Verification
- [x] `npm run typecheck` pass
- [x] `npm run lint` pass
- [x] 22 tests pass across guard service, panel interaction, and nightly remediation specs
