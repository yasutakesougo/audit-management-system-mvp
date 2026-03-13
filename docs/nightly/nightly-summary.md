# Nightly Summary

**Date:** 2026-03-14
**Branch:** `chore/nightly-maintenance-20260314`

---

## Bug Fixes

| # | Issue                                          | Files Changed | Tests Fixed |
|---|------------------------------------------------|---------------|-------------|
| 1 | Nav-Router dynamic route matching              | 3             | 3           |
| 2 | SupportPlanPermissions missing QueryClientProvider | 1         | 3           |
| 3 | Missing routes in SSOT path list               | 1             | —           |
| 4 | Orphan allowlist for /planning-sheet-list       | 1             | —           |

**Total: 6 test failures resolved** (7 → 1 remaining flaky)

---

## Tests Added

| Test File                            | Test Count | Target Module                      |
|--------------------------------------|------------|------------------------------------|
| `tests/unit/pathUtils.spec.ts`       | 24         | Navigation diagnostics pathUtils   |
| `tests/unit/timeFlowUtils.spec.ts`   | 19         | TimeFlow support record utilities  |
| `tests/unit/staffAttendanceDateUtils.spec.ts` | 18 | Staff attendance date utilities   |

**Total: 61 new test cases** — all passing

---

## Structural Risks

| Risk                                       | Severity | Recommended Action             |
|--------------------------------------------|----------|--------------------------------|
| 11+ duplicate `formatDate` implementations | High     | Consolidate to shared utility  |
| CsvImportPage.tsx (785 lines)              | Medium   | Tab-extraction modularization  |
| ComplianceDashboard.tsx (738 lines)        | Medium   | Sub-component splitting        |
| 5 unsafe `any` usages                      | Medium   | Fix 2 addressable, report 3   |
| viewSeparation.spec.ts flaky test          | Low      | Investigate vi.mock isolation  |

---

## Manual Review Required

| Item                                              | Category       |
|---------------------------------------------------|----------------|
| `src/domain/isp/schema.ts` (790 lines)            | Domain schema  |
| `src/data/isp/sharepoint/SharePointIspRepository.ts` (`: any`) | Forbidden path |
| `src/data/isp/sharepoint/SharePointPlanningSheetRepository.ts` (`: any`) | Forbidden path |
| `src/data/isp/sharepoint/SharePointProcedureRecordRepository.ts` (`: any`) | Forbidden path |
| `src/features/handoff/views/__tests__/viewSeparation.spec.ts` (flaky) | Test stability |

---

## Final Verification

| Check      | Result     |
|------------|------------|
| Typecheck  | ✅ Success  |
| Lint       | ✅ Clean    |
| Tests      | ⚠️ 1 flaky (pre-existing, not caused by changes) |
| Build      | ✅ Success  |
