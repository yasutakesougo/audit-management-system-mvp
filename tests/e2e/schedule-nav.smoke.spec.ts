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

test.describe('Schedules global navigation', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('week view can hop to month and back', async ({ page }) => {
    await openWeekView(page);

    const weekTab = page.getByRole('tab', { name: '週' });
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    const monthTab = page.getByRole('tab', { name: '月' });

    await monthTab.click();
    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);
    const monthChip = await getOrgChipText(page, 'month');
    await expect(monthChip).not.toEqual('');

    await weekTab.click();
    await waitForWeekViewReady(page);
    await expect(page).toHaveURL(/tab=week/);
    const weekChip = await getOrgChipText(page, 'week');
    await expect(weekChip).not.toEqual('');
  });

  test('day view exposes shared nav buttons', async ({ page }) => {
    await openDayView(page);

    await expect(page).toHaveURL(/tab=day/);
    await expect(page.getByRole('tab', { name: '週' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '月' })).toBeVisible();

    const weekTab = page.getByRole('tab', { name: '週' });
    await weekTab.click();
    await waitForWeekViewReady(page);
  });

  test('list view keeps tab navigation available', async ({ page }) => {
    await openWeekView(page);

    const listTab = page.getByRole('tab', { name: 'リスト' });
    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: '週' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '月' })).toBeVisible();
  });

  test('month view opened directly still links back to week', async ({ page }) => {
    await openMonthView(page);
    await expect(page).toHaveURL(/tab=month/);

    const chip = await getOrgChipText(page, 'month');
    await expect(chip).not.toEqual('');

    const weekTab = page.getByRole('tab', { name: '週' });
    await weekTab.click();
    await waitForWeekViewReady(page);
  });
});
