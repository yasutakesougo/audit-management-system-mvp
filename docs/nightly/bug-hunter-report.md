# Bug Hunter Report

**Date:** 2026-03-14
**Branch:** `chore/nightly-maintenance-20260314`
**Base:** `main` @ `8d6ce877`

## Initial Diagnostic

| Check     | Initial State | Final State |
|-----------|--------------|-------------|
| Typecheck | ✅ Pass       | ✅ Pass      |
| Lint      | ✅ Pass       | ✅ Pass      |
| Tests     | ❌ 7 failures | ⚠️ 1 flaky   |
| Build     | ✅ Pass       | ✅ Pass      |

## Bugs Fixed

### 1. Nav ↔ Router Consistency: Missing Dynamic Route Matching

**Files changed:**
- `src/app/navigation/diagnostics/navigationDiagnostics.ts`
- `src/app/navigation/diagnostics/pathUtils.ts`
- `tests/unit/navigation-router.spec.ts`

**Root Cause:** The `missingInRouter` analysis in `navigationDiagnostics.ts`
used only `Set.has()` for exact matching. Nav hrefs like
`/support-planning-sheet/new` could not match dynamic router patterns like
`/support-planning-sheet/:planningSheetId`.

**Fix:** Added `matchesAnyRoute()` helper that falls back to `matchDynamic()`
for dynamic patterns. Also enhanced `matchDynamic()` itself to handle optional
route params (`:param?`), and updated the test's matching logic similarly.

**Tests fixed:** 3 (navigation-router.spec.ts × 1, nav-router-consistency.spec.ts × 2)

---

### 2. SupportPlanPermissions Test: Missing QueryClientProvider

**File changed:** `tests/unit/SupportPlanPermissions.spec.tsx`

**Root Cause:** `SupportPlanGuidePage` now uses `useSupportPlanBundle()` and
`useIcebergEvidence()` which internally call `useQuery()` from
`@tanstack/react-query`. The test rendered the page without a
`QueryClientProvider`, causing "No QueryClient set" errors.

**Fix:** Added a `createWrapper()` factory that wraps renders in
`QueryClientProvider` with `retry: false`.

**Tests fixed:** 3

---

### 3. Missing Route in SSOT Path List

**File changed:** `src/app/routes/appRoutePaths.ts`

**Root Cause:** Two routes were missing from `APP_ROUTE_PATHS`:
- `settings/operation-flow` — existed in `adminRoutes.tsx` and
  `navigationConfig.ts` but was omitted from the SSOT path list.
- `admin/individual-support` — was listed without the `:userCode?` optional
  param, diverging from the actual route definition.

**Fix:** Added `settings/operation-flow` and updated
`admin/individual-support` to `admin/individual-support/:userCode?`.

---

### 4. Orphan Route Allowlist Update

**File changed:** `src/app/navigation/diagnostics/pathUtils.ts`

**Root Cause:** `/planning-sheet-list` was a newly added route (intentionally
reachable only via in-app links, not sidebar navigation) that was not in the
orphan allowlist.

**Fix:** Added to `ORPHAN_ALLOWLIST_DETAILS` with category `Drilldown`.

---

## Pre-existing Issues (Not Fixed)

### viewSeparation.spec.ts — Flaky test

**File:** `src/features/handoff/views/__tests__/viewSeparation.spec.ts`

**Symptom:** Fails intermittently during full suite runs, passes when run in
isolation. The error occurs on `HandoffDayView` export test — likely a
`vi.mock()` module interception timing issue when modules are pre-loaded by
other tests in the same worker.

**Recommendation:** Mark as `manual-review-required`. Consider adding
`vi.hoisted()` or moving to an isolated test pool.

---

## Forbidden Path Violations

None. All changes were in:
- `src/app/navigation/diagnostics/` (navigation utilities)
- `src/app/routes/appRoutePaths.ts` (route SSOT — metadata only)
- `tests/unit/` (test files)

No changes to domain, business logic, schemas, repositories, or API contracts.
