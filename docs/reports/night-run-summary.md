# Night Run Summary — Second Stage (2026-03-10)

**Run completed:** 2026-03-10T21:55 JST (approx 22:30 JST actual)
**Branch:** current working branch
**Validation:** ✅ typecheck · ✅ lint · ✅ test · ✅ build

---

## Phase 1 — UserDetailSections Modularization

### Goal
Progressively reduce the rendering burden in `UserDetailSections/index.tsx` by extracting sub-components.

### Files Added
| File | Purpose |
|------|---------|
| `src/features/users/UserDetailSections/sectionHelpers.ts` | Pure `resolveChipProps()` helper + `ChipProps` type, extracted from index.tsx |
| `src/features/users/UserDetailSections/sections/MenuCardGrid.tsx` | Self-contained component for the grid of menu cards |
| `src/features/users/UserDetailSections/sections/TabPanelList.tsx` | Self-contained component for all tab-panel regions |

### Files Modified
| File | Change |
|------|--------|
| `src/features/users/UserDetailSections/index.tsx` | Replaced inline `resolveChipProps`, card-grid block, and tab-panel block with `MenuCardGrid` and `TabPanelList`. Import order normalized. 366 → 220 lines. |

### Result
- `index.tsx` now acts as orchestration only (state, navigation, layout glue).
- Card rendering and tab-panel rendering are isolated in dedicated components.
- `resolveChipProps` is centralized in `sectionHelpers.ts` (single source of truth shared between both new components).
- Existing `types.ts`, `helpers.tsx`, `menuSections.ts`, `SectionDetailContent.tsx`, `UserDetailHeader.tsx`, `ISPSummarySection.tsx` left untouched.

---

## Phase 2 — Shared UI Fallback Expansion

### Assessment
Reviewed all 5 target pages:

| Page | LoadingState | ErrorState | Status |
|------|-------------|------------|--------|
| `TodayOpsPage` | No loading/error pattern (delegates to TodayBentoLayout) | No error pattern | ⏭ Skip — no inline fallbacks present |
| `AnalysisDashboardPage` | No loading block | No error block | ⏭ Skip — data is store-driven, no async loading pattern |
| `TokuseiSurveyResultsPage` | ✅ Already uses `LoadingState` | ✅ Already uses `ErrorState` | Done — already adopted |

**DayClosePage / RecordManagementScreen:** Files not found in repository (named components do not exist as standalone pages). Deferred.

**Decision:** Phase 2 targets were either already compliant or did not match page names in the codebase. No regressions; no retrofitting needed.

---

## Phase 3 — SharePoint Type Hardening

### Files Modified
| File | Change |
|------|--------|
| `src/lib/spClient.ts` | Replaced 4× `config as unknown as EnvRecord` casts with a single `envRecord: EnvRecord = { ...config }` local variable. AppConfig values are all Primitive, so the spread is type-safe without double-cast. |
| `src/lib/sp/spFetch.ts` | Removed blanket `/* eslint-disable @typescript-eslint/no-explicit-any */`. Changed `isInvalidValue` param from `any` → `unknown`. Changed `mockResponse` data param from `any` → `unknown`. |
| `src/features/schedules/infra/SharePointScheduleRepository.ts` | Added typed local interfaces `ScheduleInputExtended` and `ScheduleRepoResult`. Replaced 4× `(input as any).field` casts with `(input as unknown as ScheduleInputExtended).field`. Replaced 2× `created/updated as any` with `as unknown as ScheduleRepoResult`. Removed redundant `eslint-disable-next-line` comments for those lines. |

### Deferred (No-Risk Rule)
- `SharePointUserRepository.ts` — already uses explicit narrowing and `Record<string, unknown>` throughout; no `any` patterns found.
- `spPostBatch.ts` — already uses `EnvRecord` typed `config`; no `any` patterns found.

---

## Phase 4 — Consistency Cleanup

Import ordering was normalized for all touched files:
1. React
2. External packages (react-router-dom, @mui/*)
3. Shared libs (@/testids, @/lib/*)
4. Feature modules (@/features/*)
5. Relative imports

Unused imports removed where detected. No repo-wide churn.

---

## Files Added (total)
```
src/features/users/UserDetailSections/sectionHelpers.ts
src/features/users/UserDetailSections/sections/MenuCardGrid.tsx
src/features/users/UserDetailSections/sections/TabPanelList.tsx
```

## Files Modified (total)
```
src/features/users/UserDetailSections/index.tsx
src/lib/spClient.ts
src/lib/sp/spFetch.ts
src/features/schedules/infra/SharePointScheduleRepository.ts
```

---

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Exit 0 |
| `npm run lint` | ✅ Exit 0 (0 warnings) |
| `npm run test` | ✅ Exit 0 |
| `npm run build` | ✅ Exit 0 |

---

## Deferred Tasks

| Task | Reason |
|------|--------|
| `DayClosePage` LoadingState adoption | Page does not exist in current repository |
| `RecordManagementScreen` LoadingState adoption | Page does not exist in current repository |
| Wave 3 modularization targets (`navigationConfig.ts` 687L, `sharePointAdapter.ts` 657L) | Out of scope for this run per Phase 6 roadmap |

---

## Recommended Next Steps

1. **Wave 3 modularization**: `navigationConfig.ts` (687 lines) is the highest-priority target. Partition into `routeCategories.ts` + `navigationConfig.ts`.
2. **`sharePointAdapter.ts`** (657 lines): Extract sub-mappers for each entity (schedule, user, attendance) into separate `mappers/` files.
3. **`BusinessJournalPreviewPage.tsx`** (636 lines): Partition preview sections.
4. **Test coverage**: Add unit tests for new `MenuCardGrid`, `TabPanelList`, and `sectionHelpers.ts`.
5. **Issue #767 Final**: Resolve 6 remaining TODOs (UsersDevHarnessPage, useTransportStatus, navigationConfig admin checks).
