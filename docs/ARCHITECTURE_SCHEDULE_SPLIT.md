# Architecture: /schedule vs /schedules Feature Split

**Date:** 2026-01-16  
**Status:** ⚠️ Active Issue (affects 3 E2E tests)  
**Priority:** Medium (defer org filter to Phase 2)

---

## The Problem

The codebase currently has **two separate schedule implementations**:

### `/schedule` (Singular - Old Timeline UI)
- **Location:** `src/features/schedule/`
- **Components:** TimelineWeek, TimelineDay, MonthView, SchedulePage
- **Features:** 
  - Organization filter (事業所別) ✅
  - Quick edit dialog ✅
  - Timeline/grid views ✅
  - Old-style UI ✅
- **Route:** `/schedules/week` with `enableWeekV2: false`
- **Status:** Legacy, works but complex

### `/schedules` (Plural - New Tabbed UI)
- **Location:** `src/features/schedules/`
- **Components:** WeekPage, WeekView, DayView, MonthPage
- **Features:**
  - Tab-based routing (week/day/month/timeline) ✅
  - Simpler event display ✅
  - New-style UI ✅
  - Organization filter ❌ **NOT IMPLEMENTED**
- **Route:** `/schedules/week?tab=week|day|month|timeline`
- **Status:** Active development, some features missing

---

## Impact on E2E Testing

### Tests Written for NEW UI but Expecting OLD UI Features

**Problem Tests:**
```typescript
// tests/e2e/schedule-org-filter.spec.ts
await gotoWeek(page, TARGET_DATE);  // Navigates to /schedules/week (NEW UI)
await selectOrg(page, 'shortstay');  // Tries to find "事業所別" tab (NOT in new UI)
// ❌ Fails: Expected element not found
```

**Why It Happened:**
1. Tests assume all schedule features available in `/schedules` UI
2. But org filter component is only in `/schedule` (old) feature
3. Test runner can't distinguish which feature is loaded
4. Org filter tab expected but doesn't exist in new UI

---

## Current State & Recommendation

### Option A: Implement in New UI (Recommended)
- **Timeline:** Phase 2 (after core schedule views stable)
- **Effort:** 2-3 hours
- **Benefit:** Unified UI, remove test ambiguity
- **Downside:** Requires more implementation work

### Option B: Migrate Tests to Old UI
- **Timeline:** Immediate (1 hour)
- **Effort:** Move 3 tests to /schedule feature
- **Benefit:** Quick fix, tests work today
- **Downside:** Tests old implementation, masks need for new UI feature

### Option C: Keep Split (Current State)
- **Timeline:** Now (tests skipped)
- **Effort:** Maintain skip documentation
- **Benefit:** Prevents test failures, clarifies issue
- **Downside:** Feature not in new UI until Phase 2

**Recommendation:** **Option A + maintain Option C skips**
- Keep tests skipped now (prevents CI failure)
- Implement org filter in WeekPage.tsx in Phase 2
- Recover 3 tests when feature is ready
- Document timeline in backlog

---

## How to Fix Each Component

### New UI Enhancement Path (/schedules/WeekPage.tsx)

**Component:** WeekPage.tsx (line ~600-700)
- Current: Has org tab skeleton but not wired up
- Needed: Connect org selection to event filtering

**Steps:**
1. Uncomment or create OrgTab component similar to new UI structure
2. Add state management for selected org
3. Wire org filter to `filteredTimelineEvents` computation
4. Update test expectations to match new UI org filter UI

**Files to Modify:**
- `src/features/schedules/WeekPage.tsx` - Add org filter tab
- `src/features/schedules/views/OrgTab.tsx` - Create if missing
- `tests/e2e/schedule-org-filter.spec.ts` - Update to use new UI patterns

**Estimated Time:** 2-3 hours

---

## For Future E2E Development

### Guidelines to Prevent Recurrence

1. **Test Isolation:** Each test should be aware of which feature it's testing
   ```typescript
   // Good
   const TEST_FEATURE = 'schedules'; // or 'schedule'
   await page.goto(`/${TEST_FEATURE}/week?...`);
   
   // Bad (ambiguous which feature loaded)
   await gotoWeek(page, date); // Hidden routing choice
   ```

2. **Feature Documentation:** Mark tests with feature requirement
   ```typescript
   test('...', async ({ page }) => {
     // REQUIRES: /schedule feature (old UI) with enableWeekV2=false
     // OR: /schedules feature with org filter implemented
     await bootSchedule(page, { enableWeekV2: false }); // Clear which feature
   ```

3. **Gradual Migration:** When moving between UIs, create parallel test suites
   ```
   tests/e2e/schedule-LEGACY/    // Old UI tests
   tests/e2e/schedule-NEW/       // New UI tests
   tests/e2e/schedule-COMPAT/    // Tests that work in both
   ```

---

## Architecture Decision Log

**Decision:** Keep both features active during transition period  
**Rationale:** Allows gradual migration without major refactors  
**Tradeoff:** Increases test maintenance burden  
**Mitigation:** Clear documentation + skip inventory  

**Next Phase:** Consolidate to single feature when new UI feature-complete  

---

## Related Issues

- `schedule-org-filter.spec.ts` (3 tests) - Waiting for org filter in new UI
- `/schedules/WeekPage.tsx` - Org filter component skeleton exists but not functional
- `/schedule/SchedulePage.tsx` - Old UI has complete org filter (reference impl)

---

## References

**Old UI (Reference Implementation):**
- Org filter: `src/features/schedule/views/OrgTab.tsx`
- Usage example: `src/features/schedule/SchedulePage.tsx` (line 264)

**New UI (Target Implementation):**
- Location: `src/features/schedules/WeekPage.tsx`
- Comments: Search for "TODO: org" or "org filter"

