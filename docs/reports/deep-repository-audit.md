# Deep Repository Audit — March 2026 Night Run

**Generated**: 2026-03-10
**Branch context**: post Wave-2 modularization, stabilization phase
**Auditor**: Night Run Autonomous Pass

---

## 1. Files Over 400 Lines (TSX)

| Lines | File | Risk | Notes |
|-------|------|------|-------|
| 993 | `src/pages/OpeningVerificationPage.tsx` | 🔴 HIGH | Primary split target. Admin debug console. Pure render + logic. |
| 596 | `src/features/staff/StaffForm.tsx` | 🟡 MED | Large form. Split candidates: form sections, state |
| 578 | `src/features/schedules/routes/DayView.tsx` | 🟡 MED | Schedule view. Complex layout. |
| 569 | `src/features/nurse/medication/MedicationRound.tsx` | 🟡 MED | Clinical round. Multiple panels. |
| 557 | `src/components/DailyForm.tsx` | 🟡 MED | Large form. Section extraction opportunity. |
| 557 | `src/features/ibd/procedures/templates/HighRiskIncidentDialog.tsx` | 🟡 MED | Dialog. Extractable sections. |
| 543 | `src/features/schedules/routes/WeekView.tsx` | 🟡 MED | Schedule view. |
| 536 | `src/features/nurse/observation/BulkObservationList.tsx` | 🟡 MED | Bulk UI. |
| 531 | `src/pages/TokuseiSurveyResultsPage.tsx` | 🟡 MED | Survey results. Has inline sub-components already. |
| 525 | `src/features/ibd/procedures/templates/TimeBasedSupportRecordForm.tsx` | 🟡 MED | |
| 521 | `src/features/handoff/components/HandoffItem.tsx` | 🟡 MED | |
| 515 | `src/features/schedules/routes/MonthPage.tsx` | 🟡 MED | |
| 514 | `src/features/users/UsersPanel/UsersList.tsx` | 🟡 MED | |
| 513 | `src/features/schedules/routes/ScheduleCreateDialog.tsx` | 🟡 MED | |
| 513 | `src/features/nurse/observation/HealthObservationForm.tsx` | 🟡 MED | |
| 507 | `src/debug/HydrationHud.tsx` | 🟢 LOW | Debug panel. Low priority. |
| 504 | `src/pages/MonthlyRecordPage.tsx` | 🟡 MED | Previously partially split. |
| 492 | `src/hydration/RouteHydrationListener.tsx` | 🟢 LOW | Infrastructure. Skip. |
| 491 | `src/features/daily/components/split-stream/RecordPanel.tsx` | 🟡 MED | |
| 483 | `src/features/ibd/procedures/templates/SupportStepTemplateForm.tsx` | 🟡 MED | |
| 481 | `src/debug/SpDevPanel.tsx` | 🟢 LOW | Debug panel. |
| 480 | `src/pages/IBDDemoSections.tsx` | 🟡 MED | Already a split output — check further. |
| 478 | `src/features/daily/lists/DailyRecordList.tsx` | 🟡 MED | |
| 475 | `src/features/diagnostics/health/HealthDiagnosisPage.tsx` | 🟡 MED | |
| 474 | `src/pages/DailyRecordMenuPage.tsx` | 🟡 MED | |
| 468 | `src/features/ibd/procedures/templates/TimeFlowSupportRecordList.tsx` | 🟡 MED | |
| 464 | `src/pages/StaffAttendanceMonthlySummaryPage.tsx` | 🟡 MED | Has CircularProgress inline. |
| 462 | `src/features/today/transport/TransportStatusCard.tsx` | 🟡 MED | |
| 456 | `src/features/users/UserDetailSections/index.tsx` | 🟡 MED | Extraction in progress. |
| 456 | `src/features/records/monthly/MonthlySummaryTable.tsx` | 🟡 MED | |
| 456 | `src/features/nurse/home/NurseHomeDashboard.tsx` | 🟡 MED | |
| 452 | `src/features/daily/forms/BulkDailyRecordForm.tsx` | 🟡 MED | |
| 429 | `src/main.tsx` | 🟢 LOW | App bootstrap. Intentional. |
| 428 | `src/pages/ServiceProvisionFormPage.tsx` | 🟡 MED | Wave-2 did extract. Now 428 lines — OK threshold. |
| 426 | `src/pages/IBDHubPage.tsx` | 🟡 MED | |
| 421 | `src/features/handoff/components/CompactNewHandoffInput.tsx` | 🟡 MED | |
| 409 | `src/app/ProtectedRoute.tsx` | 🟢 LOW | Routing. Not a split target. |
| 402 | `src/pages/DashboardPageTabs.tsx` | 🟡 MED | Tab renderer. Possibly extractable. |

---

## 2. Files Over 300 Lines (TS — Non-test)

| Lines | File | Risk | Notes |
|-------|------|------|-------|
| 589 | `src/features/meeting/meetingSharePointSchema.ts` | 🟡 MED | Schema file. Large but intentional. |
| 583 | `src/features/users/useUserForm.ts` | 🟡 MED | Large hook — well-structured, constants separable. |
| 575 | `src/features/handoff/handoffApi.ts` | 🟡 MED | SP adapter. |
| 550 | `src/lib/env.ts` | 🟡 MED | Config loader. Intentionally large. |
| 545 | `src/features/resources/useIntegratedResourceCalendar.ts` | 🟡 MED | Complex hook. |
| 545 | `src/features/operation-hub/useOperationHubData.ts` | 🟡 MED | Orchestrator hook. |
| 514 | `src/features/schedules/infra/SharePointScheduleRepository.ts` | 🟡 MED | Adapter. Phase 5 candidate. |
| 499 | `src/features/schedules/hooks/useScheduleCreateForm.ts` | 🟡 MED | |
| 498 | `src/lib/mappers/schedule.ts` | 🟡 MED | Mapper. Extract sub-mappers. |
| 485 | `src/features/diagnostics/health/checks.ts` | 🟡 MED | Health checks. |
| 479 | `src/infra/sharepoint/repos/schedulesRepo.ts` | 🔴 HIGH | Duplicate of SharePointScheduleRepository? Check. |
| 472 | `src/features/daily/infra/SharePointDailyRecordRepository.ts` | 🟡 MED | SP adapter. |
| 441 | `src/app/config/navigationConfig.ts` | 🟡 MED | Wave-3 target. Route categorization. |
| 436 | `src/features/attendance/useAttendance.ts` | 🟢 LOW | Wave-2 done. Now OK. |
| 432 | `src/features/daily/components/time-flow/hooks/useTimeFlowState.ts` | 🟡 MED | Complex hook. |
| 343 | `src/features/users/infra/SharePointUserRepository.ts` | 🟢 LOW | Phase 5. Already clean. |

---

## 3. Mixed-Responsibility Files

| File | Issue |
|------|-------|
| `src/pages/OpeningVerificationPage.tsx` | Types + constants + step logic + export + full JSX render in one file |
| `src/features/users/useUserForm.ts` | Constants + validators + pure helpers + hook — extractable |
| `src/lib/spClient.ts` | Has `useSP` React hook + pure factory + placeholder stubs — mixed concerns |
| `src/lib/env.ts` | Config reading + Zod schema + runtime validation — large but borderline |
| `src/features/operation-hub/useOperationHubData.ts` | Orchestration + data transforms in one hook |

---

## 4. Repeated Loading/Error/Fallback Patterns

- **`CircularProgress` inline fallbacks (not using `LoadingState`)**: Found in:
  - `TokuseiSurveyResultsPage.tsx` (lines 333-342: manual CircularProgress + Stack)
  - `StaffAttendanceMonthlySummaryPage.tsx`
  - `SupportPlanGuidePage.tsx`
  - `ServiceProvisionFormPage.tsx`
  - Various features with ad-hoc `isLoading ? <CircularProgress> : null` patterns

- **`LoadingState` already adopted in**:
  - `UserDetailSections/index.tsx` (inline/Suspense fallback)
  - Several TodayOps components

- **`ErrorState` adoption gaps**: Many pages use ad-hoc `Alert severity="error"` without the shared `ErrorState` component.

---

## 5. Type Safety Hotspots (`any` / `unknown as` / weak assertions)

| Count | File | Pattern |
|-------|------|---------|
| 10 | `src/features/schedules/data/sharePointAdapter.ts` | `as any`, `unknown as` |
| 8 | `src/lib/zodErrorUtils.ts` | `as any` |
| 6 | `src/features/schedules/infra/SharePointScheduleRepository.ts` | `as any` |
| 5 | `src/features/schedules/repositoryFactory.ts` | `as any` |
| 5 | `src/lib/sp/spFetch.ts` | `as any` |
| 5 | `src/lib/sp/spListWrite.ts` | `as any` |
| 5 | `src/infra/sharepoint/repos/schedulesRepo.ts` | `as any` |
| 4 | `src/lib/env.schema.ts` | `as any` |
| 4 | `src/lib/spClient.ts` | `config as any` (3 instances) |
| 3 | `src/auth/msalConfig.ts` | `as any` |
| 3 | `src/lib/sp/spPostBatch.ts` | `as any` |
| 2 | `src/lib/env.ts` | `as any` |
| 2 | `src/domain/daily/spMap.ts` | `as any` |

**Key pattern in `spClient.ts`**: `config as any` cast to satisfy `spFetch` / `postBatch` — addressable by narrowing the internal `EnvRecord` type intersection.

---

## 6. Barrel Export Gaps and Issues

- `src/components/ui/` — No barrel `index.ts`. Consumers import each component directly.
- `src/features/users/UserDetailSections/` — Has limited barrel (`index.tsx` re-exports selectively).
- `src/pages/` — No barrel (appropriate for pages).
- `src/features/shared/` — Small, check if barrel needed.

---

## 7. Safe Split Candidates (Priority Order)

1. **`OpeningVerificationPage.tsx` (993 lines)** — Highest value. Extractable: types, constants, step handlers, result tables, log console.
2. **`UserDetailSections/index.tsx` (456 lines)** — Extraction in progress. Tab panel and section detail rendering extractable.
3. **`TokuseiSurveyResultsPage.tsx` (531 lines)** — Already has internal sub-components. Extract to separate files.
4. **`DailyRecordMenuPage.tsx` (474 lines)** — Menu + form + state. Partial extract.
5. **`StaffAttendanceMonthlySummaryPage.tsx` (464 lines)** — Has CircularProgress fallback. LoadingState adoption + section extract.

---

## 8. Deferred High-Risk Areas

- `src/features/schedules/infra/SharePointScheduleRepository.ts` — Contract-sensitive. Defer.
- `src/infra/sharepoint/repos/schedulesRepo.ts` — Potential duplication with above. Needs investigation before touching.
- `src/app/config/navigationConfig.ts` — Route categorization (Wave-3 target). High dependency surface.
- `src/features/handoff/handoffApi.ts` — Complex SP adapter. Phase 5 candidate but sensitive.
- `src/lib/mappers/schedule.ts` — Sub-mapper extraction is valuable but risky without full test coverage.

---

## 9. Import/Export Consistency Notes

- Import ordering is inconsistent across pages (MUI, React, features mixed order).
- `import type` is used in adapters but missing in several hook files.
- Some files have leftover unused imports (Phase 6 target — touched files only).
