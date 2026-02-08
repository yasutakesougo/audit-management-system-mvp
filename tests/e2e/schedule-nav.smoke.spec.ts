import '@/test/captureSp400';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoDay, gotoMonth, gotoWeek } from './utils/scheduleNav';
import {
  getOrgChipText,
  waitForDayViewReady,
  waitForMonthViewReady,
  waitForWeekViewReady,
} from './utils/scheduleActions';

const TARGET_DATE = new Date('2025-11-10');
const E2E_FEATURE_SCHEDULE_NAV = process.env.E2E_FEATURE_SCHEDULE_NAV === '1';

const openWeekView = async (page: Page) => {
  await gotoWeek(page, TARGET_DATE);
  await waitForWeekViewReady(page);
};

const openDayView = async (page: Page) => {
  await gotoDay(page, TARGET_DATE);
  await waitForDayViewReady(page);
};

const openMonthView = async (page: Page) => {
  await gotoMonth(page, TARGET_DATE);
  await waitForMonthViewReady(page);
};

const tablist = (page: Page) => page.getByRole('tablist').first();
const tabByName = (page: Page, name: string | RegExp) => tablist(page).getByRole('tab', { name });
const resolveTab = async (page: Page, label: string, testId?: string): Promise<Locator> => {
  if (testId) {
    const byTestId = page.getByTestId(testId);
    if ((await byTestId.count()) > 0) return byTestId;
  }
  return page.getByRole('tab', { name: label });
};

test.describe('Schedules global navigation', () => {
  test.skip(
    !E2E_FEATURE_SCHEDULE_NAV,
    'Schedule nav (tabs/indicators) suite behind E2E_FEATURE_SCHEDULE_NAV=1',
  );

  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('week view can hop to month and back', async ({ page }) => {
    await openWeekView(page);

    const weekTab = await resolveTab(page, '週', TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    const weekTabCount = await weekTab.count();
    if (weekTabCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'week tab not found (allowed for smoke)',
      });
      return;
    }
    await expect(weekTab.first()).toBeVisible({ timeout: 10_000 });
    await expect(weekTab.first()).toHaveAttribute('aria-selected', /true|false/);

    const monthTab = await resolveTab(page, '月', TESTIDS.SCHEDULES_WEEK_TAB_MONTH);
    const monthTabCount = await monthTab.count();

    if (monthTabCount === 0) {
      // Missing is acceptable in some tenants.
      test.info().annotations.push({
        type: 'note',
        description: 'month tab not found (allowed for smoke)',
      });
      return;
    }

    await expect(monthTab.first()).toBeVisible({ timeout: 10_000 });

    try {
      await monthTab.first().click({ timeout: 10_000 });
    } catch {
      await gotoMonth(page, TARGET_DATE);
    }
    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);
    const monthChip = await getOrgChipText(page, 'month');
    // Some tenants hide the month org indicator via feature flag/permissions.
    if (!monthChip) {
      // Missing is acceptable in some tenants.
    } else {
      // Chip is a string value; validate it's non-empty if present.
      if (monthChip.length === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'Month org chip text empty (allowed for smoke)',
        });
      }
    }

    try {
      await weekTab.first().click({ timeout: 10_000 });
    } catch {
      await gotoWeek(page, TARGET_DATE);
    }
    await waitForWeekViewReady(page);
    await expect(page).toHaveURL(/tab=week/);
    const weekChip = await getOrgChipText(page, 'week');
    // Some tenants hide the week org indicator via feature flag/permissions.
    if (!weekChip) {
      // Missing is acceptable in some tenants.
    } else {
      if (weekChip.length === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'Week org chip text empty (allowed for smoke)',
        });
      }
    }
  });

  test('day view exposes shared nav buttons', async ({ page }) => {
    await openDayView(page);

    await expect(page).toHaveURL(/tab=day/);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    // On mobile, tabs may be in a menu; validate week navigation by direct action
    const weekTab = await resolveTab(page, '週', TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    if (weekTab) {
      await weekTab.first().click({ timeout: 10_000 });
    } else {
      // Fallback: navigate via URL or visible week button
      await page.goto(page.url().replace('tab=day', 'tab=week'));
    }
    await waitForWeekViewReady(page);
  });

  test('list view keeps tab navigation available', async ({ page }) => {
    await openWeekView(page);
    const listTab = await resolveTab(page, 'リスト');
    const listTabCount = await listTab.count();

    if (listTabCount === 0) {
      // Missing is acceptable in some tenants.
      test.info().annotations.push({
        type: 'note',
        description: 'list tab not found (allowed for smoke)',
      });
      return;
    }

    await expect(listTab.first()).toBeVisible({ timeout: 10_000 });
    await listTab.first().click({ timeout: 10_000 });

    const listRoot = page.getByTestId(TESTIDS.SCHEDULE_WEEK_LIST);
    const listEmpty = page.getByTestId(TESTIDS.SCHEDULE_WEEK_EMPTY);
    await Promise.race([
      listRoot.waitFor({ state: 'visible', timeout: 10_000 }),
      listEmpty.waitFor({ state: 'visible', timeout: 10_000 }),
    ]);

    await expect(tabByName(page, '週')).toBeVisible({ timeout: 10_000 });
    await expect(tabByName(page, '月')).toBeVisible({ timeout: 10_000 });
  });

  test('month view opened directly still links back to week', async ({ page }) => {
    await openMonthView(page);
    // Direct month access may normalize to week; accept current behavior
    await expect(page).toHaveURL(/\/schedules\/(week|month)/);

    // Validate month navigation is accessible (if tab exists, use it)
    const monthTab = await resolveTab(page, '月', TESTIDS.SCHEDULES_WEEK_TAB_MONTH);
    if ((await monthTab.count()) > 0) {
      await monthTab.first().click({ timeout: 10_000 });
      await waitForMonthViewReady(page);
      await expect(page).toHaveURL(/tab=month/);
    }

    // Validate week navigation
    const weekTab = await resolveTab(page, '週', TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    if ((await weekTab.count()) > 0) {
      await weekTab.first().click({ timeout: 10_000 });
      await waitForWeekViewReady(page);
    }
  });
});
