# Refactor Candidates — March 2026 Night Run

**Generated**: 2026-03-10
**Status**: Active refactor targets for this night run and subsequent passes.

---

## Priority 1 — Night Run Immediate Targets

### 1.1 `src/pages/OpeningVerificationPage.tsx` (993 lines)
**Type**: Large page, mixed responsibilities
**Action**: Split into:
- `OpeningVerificationPage.tsx` — orchestrator (~200 lines)
- `openingVerificationTypes.ts` — local interfaces (`FieldCheckResult`, `CrudResult`, `SelectCheckResult`)
- `openingVerificationConstants.ts` — `DAY0_REQUIRED_KEYS`, `FIELD_MAPS`, `TYPE_EXPECTATIONS`, `FIELD_TYPE_HINTS`, `SELECT_TARGETS`
- `components/OvpStep1ListTable.tsx` — Step1 results table
- `components/OvpStep2FieldTable.tsx` — Step2 field results table
- `components/OvpStep3SelectTable.tsx` — Step3 SELECT results table
- `components/OvpStep4CrudTable.tsx` — Step4 CRUD results table
- `components/OvpLogConsole.tsx` — Log console panel
- `components/OvpControls.tsx` — Button control bar (optional, if clean)

**Risk**: Low. Admin debug page. No shared contracts.

---

### 1.2 `src/features/users/UserDetailSections/index.tsx` (456 lines)
**Type**: Tab/section renderer, extraction in progress
**Action**: Extract:
- `MenuGrid.tsx` — menu cards Grid
- `QuickAccessBar.tsx` — quick access buttons
- `UserTabPanel.tsx` — tab panel content renderer
- `SectionDetailContent.tsx` — `renderSectionDetails` function (extracted to component)

**Risk**: Low. Already extraction pattern established. Existing files: `types.ts`, `helpers.tsx`, `menuSections.ts`, `UserDetailHeader.tsx`, `ISPSummarySection.tsx`.

---

### 1.3 `src/pages/TokuseiSurveyResultsPage.tsx` (531 lines)
**Type**: Page with inline sub-components
**Action**: Extract existing inline components to separate files:
- `TokuseiFilterBar.tsx` — filter controls section
- `TokuseiResponseList.tsx` — left-panel response list
- `TokuseiResponseDetail.tsx` — right-panel detail view
- `TokuseiEmptyState.tsx` — EmptyState helper (or use shared `ErrorState`)Adopt `LoadingState` for the loading block.

**Risk**: Low. Self-contained page. No shared contracts.

---

### 1.4 `src/pages/StaffAttendanceMonthlySummaryPage.tsx` (464 lines)
**Type**: Page with inline CircularProgress
**Action**:
- Adopt `LoadingState` for the `CircularProgress` block
- Extract summary table section if feasible

**Risk**: Low for LoadingState adoption.

---

## Priority 2 — Next Pass Targets

### 2.1 `src/app/config/navigationConfig.ts` (441 lines)
Wave-3 target. Partition route categories into sub-files.

### 2.2 `src/features/daily/lists/DailyRecordList.tsx` (478 lines)
Extract list row, list header, or filter bar.

### 2.3 `src/features/nurse/home/NurseHomeDashboard.tsx` (456 lines)
Dashboard split — extract cards/widgets.

### 2.4 `src/features/handoff/components/HandoffItem.tsx` (521 lines)
Handoff item — extract sub-sections.

### 2.5 `src/features/schedules/routes/DayView.tsx` (578 lines)
Schedule day view. Complex, high-risk. Defer until stable.

---

## Priority 3 — Type Safety Improvements

### 3.1 `src/lib/spClient.ts` — `config as any` (3 instances)
Replace with typed intersection `AppConfig & EnvRecord` or narrow `readEnv` signature.

### 3.2 `src/features/schedules/data/sharePointAdapter.ts` (10 `any` hits)
Add internal SP response types. Extract typed mappers.

### 3.3 `src/lib/sp/spFetch.ts` and `spListWrite.ts` (5 hits each)
Add typed `RequestOptions` and `SpResponseMeta` interfaces.

### 3.4 `src/features/users/useUserForm.ts` constants
Move constants to separate `useUserFormConstants.ts` (no type changes needed, pure cleanup).

---

## Priority 4 — SharePoint Adapter Hardening

### 4.1 `src/features/schedules/infra/SharePointScheduleRepository.ts`
Narrow SP item response type (`SpScheduleRow`). Extract parse helpers. No contract change.

### 4.2 `src/features/daily/infra/SharePointDailyRecordRepository.ts`
Similar narrowing. Add typed `DailyRecordRow`.

### 4.3 `src/infra/sharepoint/repos/schedulesRepo.ts`
Investigate duplication with `SharePointScheduleRepository`. If confirmed different, add typed response.

---

## Priority 5 — LoadingState / ErrorState Adoption

Files to touch:
- `TokuseiSurveyResultsPage.tsx` — Replace inline `CircularProgress+Stack` block
- `StaffAttendanceMonthlySummaryPage.tsx` — Replace inline loading block
- `SupportPlanGuidePage.tsx` — Check for inline CircularProgress
- Pages touched in Phase 2 — Normalize as extracted

---

## Deferred — High Risk or Scope Creep

| File | Reason for Deferral |
|------|---------------------|
| `src/features/schedules/infra/SharePointScheduleRepository.ts` | Contract-sensitive. Team alignment needed. |
| `src/app/config/navigationConfig.ts` | Router-wide impact. Needs careful categorization. |
| `src/lib/mappers/schedule.ts` | Sub-mapper extraction needs test coverage confirmation. |
| `src/features/schedules/routes/DayView.tsx` | Complex view with shared state. High refactor surface. |
| `src/infra/sharepoint/repos/schedulesRepo.ts` | Potential duplication issue — needs investigation. |
