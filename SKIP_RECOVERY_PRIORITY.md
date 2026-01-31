# Skip Recovery Priority & Patch Guide

**Date:** 2026-01-16  
**Total Skipped:** 6 tests  
**Strategy:** Recover by category (Timing/A11y first, Feature impl last)

---

## Priority 1: A11y/Keyboard (15 min, +1 test, HIGH VALUE) 🔥

### Test: `schedule-week.keyboard.spec.ts:39`
**Name:** keyboard focus moves across tabs and restores the week timeline

**Current Issue:**
```typescript
// User presses ArrowRight to move focus, then Enter
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');  // ❌ Does not trigger click
await waitForDayTimeline(page);      // ❌ URL still "tab=week"
```

**Root Cause:**  
Tab buttons in WeekPage.tsx do NOT handle keyboard activation (Enter/Space). Only `onClick` is implemented. This is an accessibility bug (WCAG 2.1 violation).

**Patch:**
```typescript
// File: src/features/schedules/WeekPage.tsx (line ~700-720)

// CURRENT:
<button
  key={key}
  type="button"
  role="tab"
  onClick={() => {
    if (tab === key) return;
    setTab(key);
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  }}
  ...
>

// ADD THIS:
<button
  key={key}
  type="button"
  role="tab"
  onClick={() => { /* existing logic */ }}
  onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (tab === key) return;
      setTab(key);
      const next = new URLSearchParams(searchParams);
      next.set('tab', key);
      setSearchParams(next, { replace: true });
    }
  }}
  ...
>
```

**Recovery Steps:**
1. Add `onKeyDown` handler to tab buttons (5 min)
2. Test locally: `npx playwright test tests/e2e/schedule-week.keyboard.spec.ts:39 --project=chromium`
3. Change `test.skip()` → `test()` in spec file (1 min)
4. Validate full suite still passes

**Value:**
- ✅ Accessibility compliance (keyboard-only users can navigate tabs)
- ✅ WCAG 2.1 Level A requirement met
- ✅ Small code change, big a11y impact

**Estimated Time:** 15 minutes  
**Risk:** Low (well-established HTML pattern)

---

## Priority 2: Timing/Wait Enhancement (20 min, +1 test) 🎯

### Test: `schedule-week.edit.aria.spec.ts:31`
**Name:** clicking a timeline card opens an edit dialog with data prefilled

**Current Issue:**
```typescript
const editor = await openWeekEventEditor(page, targetRow, { ... });
// ❌ Throws: "Menu did not appear and editor not visible"
```

**Root Cause:**  
`openWeekEventEditor()` expects menu to appear within timeout, but old schedule UI has race condition where menu/editor rendering is delayed.

**Patch A (Increase Timeout):**
```typescript
// File: tests/e2e/utils/scheduleActions.ts (line ~630-650)

// CURRENT:
const menu = page.getByRole('menu');
await menu.waitFor({ state: 'visible', timeout: 5000 });  // Too short

// CHANGE TO:
await menu.waitFor({ state: 'visible', timeout: 15000 });  // 3x longer
```

**Patch B (Add Retry Logic - Better):**
```typescript
// File: tests/e2e/utils/scheduleActions.ts

async function openEditorFromRowMenu(page: Page, row: Locator, ...): Promise<Locator> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await row.click();
    await page.waitForTimeout(500 * attempt);  // Progressive backoff
    
    const menu = page.getByRole('menu');
    const menuVisible = await menu.isVisible().catch(() => false);
    if (menuVisible) {
      // Success path (existing code)
      const items = menu.getByRole('menuitem');
      // ...
      return editor;
    }
    
    // Check if editor already appeared (skip menu entirely)
    const editorNow = page.getByTestId(TESTIDS['schedule-create-dialog']);
    if (await editorNow.isVisible().catch(() => false)) {
      return editorNow;
    }
    
    if (attempt < MAX_RETRIES) {
      console.log(`[openEditorFromRowMenu] Retry ${attempt}/${MAX_RETRIES}`);
    }
  }
  throw new Error('Menu did not appear after retries');
}
```

**Recovery Steps:**
1. Implement Patch B with retry (15 min)
2. Test: `npx playwright test tests/e2e/schedule-week.edit.aria.spec.ts:31 --project=chromium`
3. Unskip test (1 min)
4. Validate suite

**Value:**
- ✅ Removes flake from old UI editor tests
- ✅ Pattern reusable for other menu interactions
- ✅ Retry logic = more resilient tests

**Estimated Time:** 20 minutes  
**Risk:** Low (retry is standard E2E pattern)

---

## Priority 3: Component Rendering (30 min, +1 test) ⚙️

### Test: `schedule-week.smoke.spec.ts:38`
**Name:** week tab stays active when switching views

**Current Issue:**
```typescript
await dayTab.click();           // Switch to day view
await expect(dayPanel).toBeVisible();  // ✅ Works
await weekTab.click();          // Switch back to week
await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible({ timeout: 15_000 });
// ❌ Grid never appears
```

**Root Cause Hypothesis:**  
WeekView component may not be re-mounting/re-rendering properly after tab switch from day→week. Or data is not refetching.

**Investigation Steps (10 min):**
1. Check if WeekView is using `useSchedules()` hook correctly
2. Verify `useEffect` dependencies include tab state
3. Check if `filteredTimelineEvents` recomputes on tab change

**Patch (If Data Not Refetching):**
```typescript
// File: src/features/schedules/WeekPage.tsx (line ~200-250)

// Add dependency to force refetch on tab change:
useEffect(() => {
  if (tab === 'week') {
    // Trigger data refetch or component remount
    const { from, to } = makeRange(weekStart, weekEnd);
    reload(); // If useSchedules exposes reload()
  }
}, [tab, weekStart, weekEnd]);
```

**Patch (If Grid Not Rendering):**
```typescript
// File: src/features/schedules/WeekView.tsx

// Ensure grid has proper loading/empty state:
{loading ? (
  <div>Loading...</div>
) : events.length === 0 ? (
  <EmptyState />
) : (
  <div data-testid={TESTIDS['schedules-week-grid']}>
    {/* Grid content */}
  </div>
)}
```

**Recovery Steps:**
1. Investigate WeekView data flow (10 min)
2. Apply appropriate patch (10 min)
3. Test: `npx playwright test tests/e2e/schedule-week.smoke.spec.ts:38 --project=chromium`
4. Unskip test (1 min)

**Value:**
- ✅ Confirms tab switching state management works
- ✅ May reveal data loading bug in production
- ✅ Solidifies WeekView rendering logic

**Estimated Time:** 30 minutes  
**Risk:** Medium (requires understanding component lifecycle)

---

## Priority 4-6: Feature Implementation (DEFER) ⏸️

### Tests: `schedule-org-filter.spec.ts` (3 tests)
1. defaults to merged org view when org query param is absent
2. keeps selected org when navigating weeks
3. preserves org selection across week, month, and day tabs

**Issue:** Organization filter (事業所別 tab) not implemented in `/schedules` UI.

**Why Defer:**
- Requires 2-3 hours feature development
- /schedule vs /schedules architecture decision needed first
- Not blocking core functionality

**Decision Tree:**

### Option A: Implement in New UI (Recommended for Long-term)
**When:** After core schedule views stabilized (110+ tests passing)

**Scope:**
1. Create `src/features/schedules/views/OrgTab.tsx`
2. Wire org selection to WeekPage.tsx state
3. Filter events by org in `filteredTimelineEvents` computation
4. Persist org param in URL (`?org=shortstay`)

**Files to Change:**
```
src/features/schedules/WeekPage.tsx       - Add org state + filtering
src/features/schedules/views/OrgTab.tsx   - New component (copy from /schedule)
tests/e2e/schedule-org-filter.spec.ts     - Update expectations for new UI
```

**Estimated Time:** 2-3 hours  
**Value:** +3 tests, feature parity with old UI

---

### Option B: Redirect Tests to Old UI (Quick Fix)
**When:** If need immediate test coverage

**Scope:**
1. Change tests to use old `/schedule` feature instead
2. Add `enableWeekV2: false` to test bootSchedule options
3. Update navigation expectations

**Files to Change:**
```
tests/e2e/schedule-org-filter.spec.ts     - Change bootSchedule({ enableWeekV2: false })
                                            - Update to use old UI expectations
```

**Estimated Time:** 1 hour  
**Value:** +3 tests, but tests old implementation

---

## Recovery Execution Plan

### Phase 1: Quick Wins (1 hour, +2 tests)
```bash
# Step 1: A11y keyboard (15 min)
vim src/features/schedules/WeekPage.tsx  # Add onKeyDown
npx playwright test tests/e2e/schedule-week.keyboard.spec.ts:39 --project=chromium
# If pass: unskip test

# Step 2: Editor wait (20 min)
vim tests/e2e/utils/scheduleActions.ts   # Add retry logic
npx playwright test tests/e2e/schedule-week.edit.aria.spec.ts:31 --project=chromium
# If pass: unskip test

# Validate suite still passes
npx playwright test --project=chromium --workers=1
# Expected: 105 passed (was 103)
```

### Phase 2: Component Fix (1 hour, +1 test)
```bash
# Step 3: WeekView rendering (30 min)
# Investigate + patch WeekView data flow
npx playwright test tests/e2e/schedule-week.smoke.spec.ts:38 --project=chromium
# If pass: unskip test

# Validate suite
npx playwright test --project=chromium --workers=1
# Expected: 106 passed
```

### Phase 3: Feature Impl (BACKLOG, 2-3 hours, +3 tests)
**Decision Required:** Implement in new UI vs test old UI?  
**When:** After deciding /schedule vs /schedules long-term strategy

---

## Success Criteria per Phase

### Phase 1 Complete ✅
- [ ] Keyboard navigation works (1 test recovered)
- [ ] Editor opens reliably (1 test recovered)
- [ ] 105/219 passing (from 103)
- [ ] No new flakes introduced

### Phase 2 Complete ✅
- [ ] Tab switching preserves grid (1 test recovered)
- [ ] 106/219 passing
- [ ] WeekView data flow validated

### Phase 3 Complete ✅
- [ ] Org filter functional in new UI
- [ ] 109/219 passing (53 skipped total)
- [ ] Feature parity achieved

---

## Quick Reference: Which Test to Recover First?

**If you have 15 minutes:** Priority 1 (keyboard)  
**If you have 30 minutes:** Priority 1 + 2 (keyboard + editor)  
**If you have 1 hour:** Priority 1 + 2 (Phase 1 complete)  
**If you have 2 hours:** Priority 1 + 2 + 3 (all timing/a11y fixed)  
**If you have 3+ hours:** All priorities + org filter feature impl

---

## Pattern Reusability

**Keyboard Handler Pattern (Priority 1):**
- Applicable to: Any button/tab component with keyboard navigation
- Template: Check for Enter/Space, preventDefault, trigger same logic as onClick

**Retry Pattern (Priority 2):**
- Applicable to: Any async UI element (menus, dialogs, overlays)
- Template: Progressive backoff + attempt limit + fallback check

**Data Refetch Pattern (Priority 3):**
- Applicable to: Any component that switches views/tabs
- Template: useEffect with tab dependency → trigger reload/remount

---

## Bottom Line

**Fastest ROI:** Priority 1 (15 min) → +1 test, high a11y value  
**Best Value:** Priority 1+2 (35 min total) → +2 tests, remove flakes  
**Complete Short-term:** Phase 1+2 (2 hours) → +3 tests, all timing/a11y fixed  
**Long-term:** Defer org filter to Phase 3 after architecture decision

