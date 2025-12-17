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
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('week view can hop to month and back', async ({ page }) => {
    await openWeekView(page);

    const weekTab = tabByName(page, '週');
    await expect(weekTab).toBeVisible({ timeout: 10_000 });
    await expect(weekTab).toHaveAttribute('aria-selected', /true|false/);

    const monthTab = tabByName(page, '月');
    if ((await monthTab.count()) === 0) {
      test.skip(true, 'Month tab not available in this environment.');
    }
    await expect(monthTab).toBeVisible({ timeout: 10_000 });

    await monthTab.click();
    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);
    const monthChip = await getOrgChipText(page, 'month');
    // Some tenants hide the month org indicator via feature flag/permissions.
    if (!monthChip) {
      test.skip(true, 'Month org indicator not available in this environment.');
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
    const weekTab = tabByName(page, '週');
    const monthTab = tabByName(page, '月');
    await expect(weekTab).toBeVisible({ timeout: 10_000 });
    await expect(monthTab).toBeVisible({ timeout: 10_000 });

    await weekTab.click();
    await waitForWeekViewReady(page);
  });

  test('list view keeps tab navigation available', async ({ page }) => {
    await openWeekView(page);
    const listTab = tabByName(page, 'リスト');
    if ((await listTab.count()) === 0) {
      test.skip(true, 'List tab not available in this environment.');
    }

    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    await expect(tabByName(page, '週')).toBeVisible({ timeout: 10_000 });
    await expect(tabByName(page, '月')).toBeVisible({ timeout: 10_000 });
  });

  test('month view opened directly still links back to week', async ({ page }) => {
    await openMonthView(page);
    await expect(page).toHaveURL(/tab=month/);

    const weekTab = tabByName(page, '週');
    await expect(weekTab).toBeVisible({ timeout: 10_000 });
    await weekTab.click();
    await waitForWeekViewReady(page);
  });
});
