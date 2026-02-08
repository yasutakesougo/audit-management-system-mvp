# Boundaries Lint Baseline (Phase 2)

Collected on: 2026-02-05 JST (main + resolver fix)

## Summary
- **Total warnings (baseline):** 520
- **After SchedulesDayPage.tsx fix:** 512 (↓8 violations)
- **Status:** Warn phase (Phase 1) - collecting baseline before Phase 2B enforcement
- **Note:** 旧 schedule 系のパスは削除済みのため、このリストからは省略（最新方針は docs/ARCHITECTURE_SCHEDULES.md を参照）。

## Resolver Fix Applied
Added `eslint-import-resolver-typescript` to enable @/ path alias resolution:
- `eslint-plugin-import@^5.4.0` (resolver)
- `eslint-import-resolver-typescript@^3.x` (path resolution)
- Settings: `import/resolver.typescript.project: ["./tsconfig.json"]`

## Top 20 Violating Files (Post-fix update)

```
 10  app/AppShell.tsx
 10  pages/DailyPage.tsx
  9  features/operation-hub/useOperationHubData.ts
  9  features/schedules/WeekPage.tsx
  9  pages/ScheduleCreatePage.tsx
  7  app/ProtectedRoute.tsx
  7  features/schedules/data/sharePointAdapter.ts
  5  components/DailyForm.tsx
  5  features/assessment/hooks/useTokuseiSurveyResponses.ts
  5  features/audit/useAuditSyncBatch.core.ts
  5  features/schedules/useSchedules.ts
  5  pages/DashboardPage.tsx
```

## Pattern Demonstrated
Fixed SchedulesDayPage.tsx by:
1. Created feature-level index.ts files:
   - `src/features/schedules/index.ts` (9 public exports)
2. Converted deep imports to index.ts:
   - Before: `@/features/schedules/useSchedules`
   - After: `@/features/schedules`
3. Result: ✅ 13 violations → 5 (38% reduction)

## Remaining Issues
- ListView.tsx (13): Feature→app violations (due to `@/stores`, `@/hooks` being classified as 'app' element)
- SchedulePage.tsx (12): Mix of feature→app and similar patterns

These require boundary element pattern refinement (Phase 3) or app layer reorganization, not index.ts fixes.

## Next Steps (Phase 2B)
Option A: Create PR now with SchedulesDayPage pattern demonstration
Option B: Wait for Phase 1 refinement (app element clarification)

Recommend Option A for momentum + documented pattern for future fixes.