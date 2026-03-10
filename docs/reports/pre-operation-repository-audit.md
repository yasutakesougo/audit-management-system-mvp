# Pre-Operation Repository Audit Report

## 1. Overview
This report identifies maintainability risks, structural technical debt, and type unsafety across the Audit Management System repository. The goal is to highlight actionable, low-risk areas for immediate cleanup (Issue 2 and 3) while deferring high-risk rewrites.

## 2. Audit Method
- Custom AST-level and regex-based scanning across `src/` to identify file size anomalies, mixed responsibilities, type unsafety (`any`, `unknown as`, non-null assertions), and pending `TODO`s.
- Manual evaluation of architectural risk to categorize candidates into actionable vs. deferred.

## 3. Findings by Category

### Files over 600 lines
- `src/pages/OpeningVerificationPage.tsx` (994 lines)

### Files over 400 lines (Top 10)
- `src/features/staff/StaffForm.tsx` (597 lines)
- `src/features/meeting/meetingSharePointSchema.ts` (596 lines)
- `src/features/users/UserDetailSections/index.tsx` (596 lines)
- `src/features/users/useUserForm.ts` (583 lines)
- `src/features/schedules/routes/DayView.tsx` (579 lines)
- `src/pages/AnalysisDashboardPage.tsx` (578 lines)
- `src/features/handoff/handoffApi.ts` (576 lines)
- `src/features/nurse/medication/MedicationRound.tsx` (570 lines)
- `src/components/DailyForm.tsx` (558 lines)
- `src/features/ibd/procedures/templates/HighRiskIncidentDialog.tsx` (558 lines)

### Mixed-Responsibility Files (UI + State + Helper + Type)
- `src/features/users/UserDetailSections/index.tsx`
- `src/features/schedules/routes/DayView.tsx`
- `src/features/nurse/medication/MedicationRound.tsx`
- `src/pages/MonthlyRecordPage.tsx`
- `src/pages/AnalysisDashboardPage.tsx`

### Unsafe Type Usage (`any`, `as any`, `unknown as`)
High concentration in infrastructure and adapters:
- `src/features/schedules/data/sharePointAdapter.ts` (20 occurrences)
- `src/infra/sharepoint/repos/schedulesRepo.ts` (14 occurrences)
- `src/features/schedules/infra/SharePointScheduleRepository.ts` (12 occurrences)
- `src/lib/sp/spFetch.ts` (10 occurrences)

### Unsafe Non-Null Assertions (`!.`)
- `src/features/schedules/routes/WeekView.tsx`
- `src/features/daily/components/split-stream/ProcedurePanel.tsx`

### Pending TODO / FIXME Comments
- `src/features/dashboard/generateTodos.ts`
- `src/sharepoint/spListRegistry.ts`
- And 22 other infrastructure and UI locations.

### Duplicated Loading/Error UI Patterns
- Multiple page components contain ad-hoc `return <div>Loading...</div>` or inline error boundary definitions instead of importing shared generic boundaries/spinners.

## 4. Prioritized Candidate List

### Low-Risk Candidates (Good for splitting)
- **`src/features/users/UserDetailSections/index.tsx`**: Highly modularizable into individual section components.
- **`src/pages/AnalysisDashboardPage.tsx`**: UI layout can be separated from data fetching logic.
- **`src/pages/MonthlyRecordPage.tsx`**: Clean split between page layout and table/data components.

### Medium-Risk Candidates
- **`src/features/schedules/routes/DayView.tsx`**: Complex state but clear UI boundaries.
- **`src/features/staff/StaffForm.tsx`**: Form heavy, requires careful context/lifting.

### High-Risk Candidates (Do not touch)
- **`src/pages/OpeningVerificationPage.tsx`**: Critical operational path. Too large (994 lines) to split safely without deep functional testing.
- **`src/features/schedules/data/sharePointAdapter.ts`**: High risk of breaking contract if types are tightened improperly.

## 5. Tonight Top 5 (Execution Targets)
1. **`src/features/users/UserDetailSections/index.tsx`** (Action: Split into separate component files, normalize imports)
2. **`src/pages/AnalysisDashboardPage.tsx`** (Action: Extract data hooks and sub-charts)
3. **`src/hooks/usePersistedFilters.ts`** or related minor types (Action: Tighten type safety, fix `any`)
4. **`src/pages/MonthlyRecordPage.tsx`** (Action: Split if time permits)
5. **Shared Loading/Error entry points** (Action: Create/unify `LoadingState` and `ErrorState` components and apply to touched files)

## 6. Deferred/High-Risk Candidates
- `src/pages/OpeningVerificationPage.tsx` (Deferred due to size/criticality)
- Core `spClient`/`spFetch` adapter typings (Deferred, fixing `any` casually might break list parsers implicitly relying on structural casts)

## 7. Handoff Notes
- **For Issue 2:** Start with `src/features/users/UserDetailSections/index.tsx`. Extract out the sub-sections into their own files next to `index.tsx`. Then do `AnalysisDashboardPage.tsx` by pulling out the layout into `AnalysisDashboardStats.tsx` etc.
- **For Issue 3:** Don't blanket remove `any` in `SchedulesRepo`. Focus on the page hooks in the modules touched in Issue 2, converting their error states into shared `PageErrorBoundary` or `LoadingState` usage.
