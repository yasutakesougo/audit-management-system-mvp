# Technical Debt Audit Report

**Date:** 2026-03-14
**Branch:** `chore/nightly-maintenance-20260314`
**Mode:** Read-only analysis — no code changes made

---

## 1. Large Files (≥ 600 lines)

| Lines | File                                                     | Category         |
|-------|----------------------------------------------------------|------------------|
| 790   | `src/domain/isp/schema.ts`                               | 🚫 Domain schema |
| 785   | `src/pages/admin/CsvImportPage.tsx`                      | Page component   |
| 738   | `src/features/safety/components/ComplianceDashboard.tsx`  | Feature component|

**Notes:**
- `schema.ts` is a Zod domain schema — **change-forbidden** per rules
- `CsvImportPage.tsx` is a new page (added in recent sprint); candidate for
  tab-extraction modularization
- `ComplianceDashboard.tsx` is a new safety feature; candidate for splitting
  into sub-components

**Recommendation:** CsvImportPage and ComplianceDashboard should be
modularized in the next sprint cycle.

---

## 2. Layer Violations (UI → Adapter Direct Access)

**Result: ✅ No violations found**

Searched for:
- `from '@/sharepoint'` in pages → 0 hits
- `from '@/data'` in pages → 0 hits
- `from '@/features/.*/adapter'` in pages → 0 hits

The ports-and-adapters architecture is properly maintained.

---

## 3. Naming Inconsistencies (status / state / result)

Files with high density of mixed `status`/`state`/`result` naming:

| File                              | Count | Concern Level |
|-----------------------------------|-------|---------------|
| `types.ts` (various)              | 22    | ⚠️ Medium     |
| `SharePointScheduleRepository.ts` | 20    | ⚠️ Medium     |
| `useNurseSync.ts`                 | 16    | ⚠️ Medium     |
| `RouteHydrationListener.tsx`      | 15    | Low           |
| `handoffStateMachine.ts`          | 14    | Low (FSM)     |

**Notes:** Most instances are legitimate — `status` for data states,
`state` for React/FSM states, `result` for function returns. The main
concern is `SharePointScheduleRepository.ts` which mixes `status` and
`state` for SharePoint field mapping vs internal state. Consider adding
a naming convention comment header.

---

## 4. Unsafe `any` Usage

| File                                        | Line | Context                                    |
|---------------------------------------------|------|--------------------------------------------|
| `SharePointIspRepository.ts`                | 99   | `const created: any = await client.add...` |
| `SharePointPlanningSheetRepository.ts`      | 87   | `const created: any = await client.add...` |
| `SharePointProcedureRecordRepository.ts`    | 87   | `const created: any = await client.add...` |
| `useComplianceForm.ts`                      | 73   | `(draft?.data as any)?.compliance`         |
| `useComplianceForm.ts`                      | 134  | `compliance: nextCompliance as any`        |

**Total: 5 instances** (down from historical highs)

**Notes:**
- The 3 SharePoint repository instances share the same pattern — the
  `addListItemByTitle` return type is `any` from the SharePoint client SDK.
  These are in **forbidden paths** (`src/data/isp/sharepoint/`).
- The 2 `useComplianceForm.ts` instances are casting to bridge a type gap
  between the draft form data and the compliance sub-schema. This is in a
  **support-plan feature** area and may be addressable.

**Recommendation:** The `useComplianceForm.ts` instances could be fixed by
adding a proper `ComplianceData` type assertion. Mark SharePoint instances
as `manual-review-required`.

---

## 5. Duplicate Logic Candidates

### Date Formatting

Multiple date formatting implementations exist:

| File                                    | Functions                        |
|-----------------------------------------|----------------------------------|
| `ircCalendarTypes.ts`                   | `formatDate`, `formatDateTime`   |
| `helpers.ts` (support-plan-guide)       | `formatDate`                     |
| `dayViewHelpers.ts`                     | `formatDate`                     |
| `weekViewHelpers.ts`                    | `formatDate`                     |
| `ircEventLogic.ts`                      | `formatDate`                     |
| `supportPlanDeadline.ts`               | `formatDate`                     |
| `handoffFormatters.ts`                  | `formatDate`, `formatTime`       |
| `attendance.logic.ts`                   | `formatDate`                     |

**11+ separate `formatDate`/`formatTime` implementations** across the
codebase. These should be consolidated into a shared `lib/dateFormat.ts`
utility.

**Risk:** Inconsistent date formatting across features. Currently each
implementation handles its own locale/format logic, which could lead to
divergent display patterns.

---

## 6. Circular Dependency Candidates

**Detected patterns (heuristic, not tool-validated):**

| Potential Cycle                                  | Risk     |
|--------------------------------------------------|----------|
| `features/handoff/` ↔ `features/daily/`          | ⚠️ Low   |
| `features/support-plan-guide/` ↔ `features/ibd/` | ⚠️ Low   |

**Notes:** No definitive cycles confirmed. The dependency direction follows
the established feature-to-feature integration pattern via hooks. A full
`madge` analysis is recommended for comprehensive detection.

---

## Summary

| Category              | Issues Found | Severity     | Action Needed              |
|-----------------------|--------------|--------------|----------------------------|
| Large files (≥600)    | 3            | ⚠️ Medium    | Modularize (next sprint)   |
| Layer violations      | 0            | ✅ Clean      | None                       |
| Naming inconsistency  | 2 files      | ⚠️ Low       | Add naming convention docs |
| Unsafe `any`          | 5            | ⚠️ Medium    | Fix 2, report 3           |
| Duplicate logic       | 11+ formatters | ⚠️ High   | Consolidate `formatDate`   |
| Circular dependencies | 0 confirmed  | ✅ Clean      | Run full madge analysis    |

## Manual Review Required

| Item                                     | Reason                              |
|------------------------------------------|--------------------------------------|
| `src/domain/isp/schema.ts` (790 lines)   | Domain schema — change forbidden     |
| `SharePointIspRepository.ts` `:any`      | Forbidden path                       |
| `SharePointPlanningSheetRepository.ts` `:any` | Forbidden path                  |
| `SharePointProcedureRecordRepository.ts` `:any` | Forbidden path              |
| `viewSeparation.spec.ts` flaky test      | Requires investigation              |
