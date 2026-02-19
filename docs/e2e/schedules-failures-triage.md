# Schedules E2E Failures Triage (Batch)

## Goal
- 既存 failures を「原因カテゴリ」に分解し、直し方針（Fix / Skip / Refactor）を決める。
- 1 failure = 1 issue に落とせる粒度にする。

## Run Context
- Date: 2026-02-19
- Branch: chore/schedules-e2e-failures-triage
- Command: E2E_BASE_URL=http://127.0.0.1:4173 ... npx playwright test tests/e2e/schedule-*.spec.ts tests/e2e/schedules*.spec.ts tests/e2e/dashboard-schedule-flow.spec.ts --project=chromium --workers=1 --reporter=json
- Env (key flags):
  - VITE_E2E_FORCE_SCHEDULES_WRITE=1
  - VITE_SKIP_SHAREPOINT=1
  - VITE_FEATURE_SCHEDULES_WEEK_V2=1

## Categories (choose one)
- Locator drift (testid/role/text changed)
- Navigation / route guard (gate / redirect / tab state)
- Timing / wait condition (async render / debounce / networkidle)
- Fixture / seed mismatch (data not present, date out of range)
- Feature-flag mismatch (flag assumptions differ)
- SharePoint / integration dependency (should be gated/skip or mocked)
- Actual product bug (real defect)
- Flaky (non-deterministic; needs stabilization)

## Failure Table
| Spec | Test | Symptom | Category | Quick Fix | Proper Fix | Owner | Issue |
|---|---|---|---|---|---|---|---|
| schedule-conflicts.spec.ts | highlights the same conflicts in the week view | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedule-week-root').locator('[data-testid="schedule-warning-indicator"]') | Locator drift | ✅ FIXED (warning-indicator added to WeekView item) |  |  |  |
| schedule-create-dialog.aria.spec.ts | exposes dialog semantics, announces open state, and restores focus | Test timeout of 60000ms exceeded. | Timing / wait condition |  |  |  |  |
| schedule-day-view.spec.ts | 指定日の Day ビューが開き、タブとタイムラインが揃う | Error: expect(locator).toBeVisible() failed Locator: getByRole('heading', { name: /スケジュール/, level: 1 }) Expected: visible Timeout: 5000ms Er | SharePoint / integration dependency |  |  |  |  |
| schedule-day.happy-path.spec.ts | user can create and edit a day entry through the quick dialog | Error: expect(received).toBe(expected) // Object.is equality Expected: 1 Received: 0 Call Log: - Timeout 10000ms exceeded while waiting on t | Timing / wait condition |  |  |  |  |
| schedule-day.happy-path.spec.ts | week category filter narrows visible items | Error: expect(locator).toHaveCount(expected) failed Locator: getByTestId('schedules-week-root').first().locator('[data-testid="schedule-item | Locator drift | ✅ FIXED (data-category attribute added to WeekView item) |  |  |  |
| schedule-list-view.spec.ts | filters, sorts, paginates, and shows details | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedules-week-root').first().locator('[data-testid="schedule-item"]').fir | SharePoint / integration dependency |  |  |  |  |
| schedule-month-to-day.smoke.spec.ts | navigates from month calendar to day view with correct query params | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedules-day-popover') Expected: visible Timeout: 5000ms Error: element(s | SharePoint / integration dependency |  |  |  |  |
| schedule-month.aria.smoke.spec.ts | navigates to day view when a calendar card is clicked | Test timeout of 60000ms exceeded. | Navigation / route guard |  |  |  |  |
| schedule-org-filter.deep.spec.ts | filters week items for respite org | Error: expect(received).toBeGreaterThan(expected) Expected: > 0 Received: 0 Call Log: - Timeout 15000ms exceeded while waiting on the predic | SharePoint / integration dependency |  |  |  |  |
| schedule-org-filter.deep.spec.ts | filters week items for shortstay org | Error: expect(received).toBeGreaterThan(expected) Expected: > 0 Received: 0 Call Log: - Timeout 15000ms exceeded while waiting on the predic | SharePoint / integration dependency |  |  |  |  |
| schedule-org-filter.deep.spec.ts | invalid org falls back to all items | Error: expect(received).toBeGreaterThan(expected) Expected: > 0 Received: 0 Call Log: - Timeout 15000ms exceeded while waiting on the predic | SharePoint / integration dependency |  |  |  |  |
| schedule-org-filter.spec.ts | org param is absent when no org selected on Org tab | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedule-tab-org') Expected: visible Timeout: 10000ms Error: element(s) no | Navigation / route guard |  |  |  |  |
| schedule-org-filter.spec.ts | org param persists when switching between week, month, and day tabs | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedule-tab-org') Expected: visible Timeout: 10000ms Error: element(s) no | Navigation / route guard |  |  |  |  |
| schedule-org-filter.spec.ts | org param reflects Org tab selection and clears on all | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedule-tab-org') Expected: visible Timeout: 10000ms Error: element(s) no | Navigation / route guard |  |  |  |  |
| schedule-week-to-day.lane.smoke.spec.ts | preserves selected lane when switching to day view | Test timeout of 60000ms exceeded. | Timing / wait condition |  |  |  |  |
| schedule-week.deeplink.spec.ts | loads the requested week and preserves announcements after reload | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedules-week-day-2025-11-24') Expected: visible Timeout: 5000ms Error: e | SharePoint / integration dependency |  |  |  |  |
| schedule-week.filter.mobile.spec.ts | keeps the week view visible while using the mobile search toolbar | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedules-filter-toggle') Expected: visible Received: hidden Timeout: 5000 | SharePoint / integration dependency |  |  |  |  |
| schedule-week.keyboard.spec.ts | keyboard focus moves across tabs and restores the week view | Error: expect(received).toBe(expected) // Object.is equality Expected: "day" Received: "month" | Navigation / route guard |  |  |  |  |
| schedule-week.keyboard.spec.ts | search interactions do not change the active week view | Error: expect(locator).toHaveAttribute(expected) failed Locator: getByTestId('schedules-week-day-2025-11-24') Expected: "date" Timeout: 5000 | SharePoint / integration dependency |  |  |  |  |
| schedule-week.lanes.smoke.spec.ts | shows 3 lanes (User/Staff/Org) | Error: expect(locator).toBeVisible() failed Locator: getByTestId('schedules-week-lane-User') Expected: visible Timeout: 5000ms Error: elemen | SharePoint / integration dependency |  |  |  |  |
| schedule-week.smoke.spec.ts | renders week overview and passes Axe | Error: Axe violations detected for Schedules Week: aria-required-children (critical) → .w-full aria-required-parent (critical) → button[aria | Timing / wait condition |  |  |  |  |
| schedules-day-create-facility.smoke.spec.ts | Week lane -> Day create defaults to facility | Error: expect(locator).toBeVisible() failed Locator: getByRole('button', { name: /予定を追加/ }) Expected: visible Timeout: 5000ms Error: element | SharePoint / integration dependency |  |  |  |  |

## Notes / Patterns
- (例) "getByRole(tab, name=Week)" が複数ヒット → locator drift
- (例) "LIST_CHECK_PENDING" → gate / env mismatch

## Phase 1: Locator Drift (Completed)

**Objective:** Fix 3 locator drift failures with quick wins.

**Fix Summary:**
| # | Spec | Test | Fix | Status |
|---|---|---|---|---|
| 1 | schedule-conflicts | week view warning | Add `data-testid="schedule-warning-indicator"` to WeekView item with conditional wrapper for baseShiftWarnings | ✅ PASS |
| 2 | schedule-day.happy-path | category filter | Add `data-category={item.category ?? 'Org'}` attribute to WeekView button | ✅ PASS |
| 3 | schedule-list-view | list view items | **Reclassified as SharePoint/integration dependency** (not Locator drift) | ⏳ Defer to Phase 2 |

**Commit:** `6a519b92 (fix/schedules-locator-drift)` - "fix: add data-category and warning-indicator to WeekView schedule items"

**Updated Distribution:**
- Locator drift: ~~3~~ **2** (2 fixed) = 9% of total failures
- SharePoint / integration: ~~10~~ **11** (reclassified 1) = 50% of total
- Navigation / route guard: 5 (22.7%)
- Timing / wait condition: 4 (18.2%)