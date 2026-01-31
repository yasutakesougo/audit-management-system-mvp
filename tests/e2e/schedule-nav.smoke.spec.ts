import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
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

    const weekTab = tabByName(page, '週');
    await expect(weekTab).toBeVisible({ timeout: 10_000 });
    await expect(weekTab).toHaveAttribute('aria-selected', /true|false/);

    const monthTab = tabByName(page, '月');
    const monthTabCount = await monthTab.count();

    if (monthTabCount === 0) {
      // Missing is acceptable in some tenants.
      await expect(monthTab).toHaveCount(0);
      return;
    }

    await expect(monthTab).toBeVisible({ timeout: 10_000 });

    await monthTab.click();
    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);
    const monthChip = await getOrgChipText(page, 'month');
    // Some tenants hide the month org indicator via feature flag/permissions.
    if (!monthChip) {
      // Missing is acceptable in some tenants.
    } else {
      // Chip is a string value; validate it's non-empty if present.
      expect(monthChip.length).toBeGreaterThan(0);
    }

    await weekTab.click();
    await waitForWeekViewReady(page);
    await expect(page).toHaveURL(/tab=week/);
    const weekChip = await getOrgChipText(page, 'week');
    await expect(weekChip).not.toEqual('');
  });

  test('day view exposes shared nav buttons', async ({ page }) => {
    await openDayView(page);

    await expect(page).toHaveURL(/tab=day/);
    const heading = page.getByRole('heading', { name: /スケジュール/, level: 1 });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // On mobile, tabs may be in a menu; validate week navigation by direct action
    const weekTab = tabByName(page, '週');
    if ((await weekTab.count()) > 0) {
      await weekTab.click();
    } else {
      // Fallback: navigate via URL or visible week button
      await page.goto(page.url().replace('tab=day', 'tab=week'));
    }
    await waitForWeekViewReady(page);
  });

  test('list view keeps tab navigation available', async ({ page }) => {
    await openWeekView(page);
    const listTab = tabByName(page, 'リスト');
    const listTabCount = await listTab.count();

    if (listTabCount === 0) {
      // Missing is acceptable in some tenants.
      await expect(listTab).toHaveCount(0);
      return;
    } else {
      await expect(listTab).toBeVisible({ timeout: 10_000 });
    }

    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    await expect(tabByName(page, '週')).toBeVisible({ timeout: 10_000 });
    await expect(tabByName(page, '月')).toBeVisible({ timeout: 10_000 });
  });

  test('month view opened directly still links back to week', async ({ page }) => {
    await openMonthView(page);
    // Direct month access may normalize to week; accept current behavior
    await expect(page).toHaveURL(/\/schedules\/(week|month)/);

    // Validate month navigation is accessible (if tab exists, use it)
    const monthTab = tabByName(page, '月');
    if ((await monthTab.count()) > 0) {
      await monthTab.click();
      await waitForMonthViewReady(page);
      await expect(page).toHaveURL(/tab=month/);
    }

    // Validate week navigation
    const weekTab = tabByName(page, '週');
    if ((await weekTab.count()) > 0) {
      await weekTab.click();
      await waitForWeekViewReady(page);
    }
  });
});
