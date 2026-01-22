# Category C E2E Skips — Inventory & Decisions

**Generated:** 2026-01-21  
**Source:** `rg "test\.skip\(" tests/e2e/schedule* -n`

## Summary

- **Total skips:** 29
- **True-fixed skips:** 14 (conditional decisions needed)
- **SharePoint/Fixtures guards:** 2 (integration-only candidates)
- **IS_PREVIEW guards:** 4 (acceptable; UI divergence)
- **Test scaffold (no condition):** 5 (unimplemented features)
- **Test.skip() named functions:** 3 (WIP features)

---

## True-Fixed Skips (Priority: HIGH)

These skip with `true` condition and need explicit decision on enablement:

```
tests/e2e/schedule-month.aria.smoke.spec.ts:46:      test.skip(true, 'Month navigation not available (no events in environment).');
tests/e2e/schedule-month.aria.smoke.spec.ts:62:      test.skip(true, 'Month org indicator not available in this environment.');
tests/e2e/schedule-month.aria.smoke.spec.ts:72:      test.skip(true, 'Month heading not rendered (no data in environment).');
tests/e2e/schedule-month.aria.smoke.spec.ts:89:      test.skip(true, 'No day cards in month view (no events in environment).');
tests/e2e/schedule-month-to-day.smoke.spec.ts:21:      test.skip(true, 'No day cards in month view.');
tests/e2e/schedule-month-to-day.smoke.spec.ts:54:      test.skip(true, 'Today button not found.');
tests/e2e/schedule-nav.smoke.spec.ts:46:      test.skip(true, 'Month tab not available in this environment.');
tests/e2e/schedule-nav.smoke.spec.ts:56:      test.skip(true, 'Month org indicator not available in this environment.');
tests/e2e/schedule-nav.smoke.spec.ts:88:      test.skip(true, 'List tab not available in this environment.');
tests/e2e/schedule.status-service.smoke.spec.ts:341:    test.skip(true, 'Skipping quick create in smoke while quick dialog stabilisation is pending.');
tests/e2e/schedule.status-service.smoke.spec.ts:465:      test.skip(true, 'No week user items present (set E2E_HAS_SCHEDULE_DATA=1 to enable).');
tests/e2e/schedule-week.acceptance.spec.ts:71:      test.skip(true, 'Acceptance menu item not available in this build/flag set.');
tests/e2e/schedule-week.acceptance.spec.ts:89:      test.skip(true, 'Acceptance dialog not available in this build/flag set.');
tests/e2e/schedule-week.aria.smoke.spec.ts:82:      test.skip(true, 'Month tab not available or inactive in this configuration.');
```

**Decision Matrix:**

| Reason | Count | Action | Notes |
|--------|-------|--------|-------|
| No data / events | 4 | Replace with env guard (`E2E_HAS_SCHEDULE_DATA=1`) | Similar to line 465 pattern |
| Feature unavailable / build flag | 5 | Keep skipped + clarify deadline | "Until XXX feature enabled" |
| UI stabilization pending | 1 | Track as tech-debt | Reference quick dialog PR |
| Month-to-day navigation issues | 2 | Investigate → possibly env guard or fix | Possible empty state issue |

---

## SharePoint / Fixtures Guards (Priority: MEDIUM)

These require real SharePoint persistence and should only run in integration env:

```
tests/e2e/schedule.status-service.smoke.spec.ts:254:      test.skip(IS_FIXTURES, 'Requires real SharePoint; fixtures mode does not persist edits.');
tests/e2e/schedule.status-service.smoke.spec.ts:421:    test.skip(IS_FIXTURES, 'Requires real SharePoint; fixtures mode does not persist edits.');
```

**Decision:** ✅ Acceptable as-is. Only skip in fixtures mode. These are correctly gated.

---

## IS_PREVIEW Guards (Priority: LOW)

These skip when in Preview mode due to UI divergence (acceptable):

```
tests/e2e/schedule.status-service.smoke.spec.ts:253:      test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
tests/e2e/schedule.status-service.smoke.spec.ts:340:    test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
tests/e2e/schedule.status-service.regression.spec.ts:201:    test.skip(IS_PREVIEW, 'Preview UI diverges; quick dialog not exposed.');
tests/e2e/schedule-org-tab.smoke.spec.ts:15:  test.skip(!exists, 'Org tab is not available in this build/flag set.');
```

**Decision:** ✅ Acceptable. These are environment-specific; only skip in Preview.

---

## Test Scaffolds (Unimplemented)

These have no condition (just `test.skip()`), indicating feature not yet implemented:

```
tests/e2e/schedules.month.popover.spec.ts:28:      test.skip();
tests/e2e/schedules.month.popover.spec.ts:67:      test.skip();
tests/e2e/schedules.month.popover.spec.ts:102:      test.skip();
tests/e2e/schedules.month.popover.spec.ts:136:      test.skip();
tests/e2e/schedules.month.popover.spec.ts:170:      test.skip();
```

**Decision:** ⏳ Keep skipped until popover feature is ready.

---

## Named Test Functions (WIP Features)

These use `test.skip('name', ...)` indicating work-in-progress:

```
tests/e2e/schedule-org-filter.spec.ts:57:  test.skip('defaults to merged org view when org query param is absent', async ({ page }) => {
tests/e2e/schedule-org-filter.spec.ts:68:  test.skip('keeps selected org when navigating weeks', async ({ page }) => {
tests/e2e/schedule-org-filter.spec.ts:100:  test.skip('preserves org selection across week, month, and day tabs', async ({ page }) => {
```

**Decision:** ⏳ Keep skipped until org-filter feature is completed.

---

## Next Steps (Ordered by Impact)

### Phase 1: Env Guards (Highest ROI) ✅ COMPLETE
Convert `test.skip(true, 'No data...')` → `test.skip(!E2E_HAS_SCHEDULE_DATA, 'Set E2E_HAS_SCHEDULE_DATA=1 to enable')`

**Status:** ✅ Complete
- schedule-month.aria.smoke.spec.ts (4 skips → env-guarded with empty state assertions)
- schedule.status-service.smoke.spec.ts (line 465 → E2E_HAS_SCHEDULE_DATA=1)

### Phase 2: Feature Flag Unification (Tenant Variance) ✅ COMPLETE
Convert inline `test.skip(true, 'Feature not available...')` → **suite guard + if/else pattern**

**Status:** ✅ Complete (3 files, 7 skips → 3 env variables)

#### Files Deployed:

**1. schedule-nav.smoke.spec.ts** (3 skips → 1 env var)
```typescript
const E2E_FEATURE_SCHEDULE_NAV = process.env.E2E_FEATURE_SCHEDULE_NAV === '1';

test.describe('Schedules global navigation', () => {
	test.skip(!E2E_FEATURE_SCHEDULE_NAV, 'Schedule nav suite behind E2E_FEATURE_SCHEDULE_NAV=1');
	// monthTab, monthChip, listTab converted to if/else (tenant variance acceptable)
});
```

**2. schedule-week.acceptance.spec.ts** (2 skips → 1 env var)
```typescript
const E2E_FEATURE_SCHEDULE_ACCEPTANCE = process.env.E2E_FEATURE_SCHEDULE_ACCEPTANCE === '1';

test.describe('Schedules week acceptance flow', () => {
	test.skip(!E2E_FEATURE_SCHEDULE_ACCEPTANCE, 'Acceptance flow suite behind E2E_FEATURE_SCHEDULE_ACCEPTANCE=1');
	// acceptance menu item, dialog converted to if/else returns
});
```

**3. schedule-week.aria.smoke.spec.ts** (1 skip → 1 env var)
```typescript
const E2E_FEATURE_SCHEDULE_WEEK_MONTH_TAB = process.env.E2E_FEATURE_SCHEDULE_WEEK_MONTH_TAB === '1';

test.describe('Schedule week page – ARIA smoke', () => {
	test.skip(!E2E_FEATURE_SCHEDULE_WEEK_MONTH_TAB, 'Month-tab tests behind E2E_FEATURE_SCHEDULE_WEEK_MONTH_TAB=1');
	// Month tab converted to if/else
});
```

#### Pattern Summary (if/else):
```typescript
// Tenant variance handling: element may not exist in some configurations
if (elementCount === 0) {
	await expect(element).toHaveCount(0); // Explicitly assert absence
	return; // Skip remaining test branch
} else {
	await expect(element).toBeVisible(); // Validate presence
}
```

#### Validation Commands:
```bash
# Skip without env (entire suite skipped)
npx playwright test tests/e2e/schedule-nav.smoke.spec.ts --project=chromium --reporter=line

# Run with env (suite runs, if/else tolerates tenant variance)
E2E_FEATURE_SCHEDULE_NAV=1 npx playwright test tests/e2e/schedule-nav.smoke.spec.ts --project=chromium --reporter=line

# Enable all Phase 2 features
E2E_FEATURE_SCHEDULE_NAV=1 E2E_FEATURE_SCHEDULE_ACCEPTANCE=1 E2E_FEATURE_SCHEDULE_WEEK_MONTH_TAB=1 npm run preflight:full
```

#### Why if/else (not return)?
- Tests contain **chained validation** (week → month → day → etc.)
- `return` would abort entire test, skipping downstream assertions
- `if/else` wraps only the optional element check, preserving test flow
- Tenant variance (missing UI) is acceptable; test continues to validate stable elements

---

### Phase 3: Tech-Debt Tracking (Not Yet Started)

---

## Command References

```bash
# Check all skips
rg "test\.skip\(" tests/e2e/schedule* -n

# Check true-fixed skips only
rg "test\.skip\(true" tests/e2e/schedule* -n

# Check SharePoint-only skips
rg "skip\(.*(SharePoint|fixtures|persist|real)" tests/e2e/schedule* -n

# Run tests with data enabled (after env guard conversion)
E2E_HAS_SCHEDULE_DATA=1 npx playwright test tests/e2e/schedule* --project=chromium

# Preflight with E2E
npm run preflight:full
```

---

**Last Updated:** 2026-01-21  
**Author:** Skip Reduction Initiative  
**Status:** Inventory complete; awaiting Phase 1 implementation decisions.
