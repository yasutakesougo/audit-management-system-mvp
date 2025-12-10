/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e files live outside the main tsconfig include set.
import '@/test/captureSp400';
import { expect, Page, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoMonth } from './utils/scheduleNav';
import { getOrgChipText, waitForDayViewReady, waitForMonthViewReady } from './utils/scheduleActions';

const OCTOBER_START = new Date('2025-10-01');
const NOVEMBER_TARGET = new Date('2025-11-26');

const openMonthView = async (page: Page, date: Date) => {
  await gotoMonth(page, date);
  await waitForMonthViewReady(page);
};

test.describe('Schedules month ARIA smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('shows guidance when no events exist', async ({ page }) => {
    await openMonthView(page, OCTOBER_START);

    const root = page.getByTestId('schedule-month-root');
    await expect(root).toBeVisible();
    await expect(root.getByText('予定なし').first()).toBeVisible();
  });

  test('exposes heading, navigation, and org indicator', async ({ page }) => {
    await openMonthView(page, NOVEMBER_TARGET);

    const heading = page.getByRole('heading', { level: 2, name: /2025年\s*11月/ });
    await expect(heading).toBeVisible();

    await expect(page.getByRole('button', { name: '前の月へ移動' })).toBeVisible();
    await expect(page.getByRole('button', { name: '今月に移動' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次の月へ移動' })).toBeVisible();

    const orgChipText = await getOrgChipText(page, 'month');
    expect(orgChipText).toContain('件');
  });

  test('month navigation updates the heading label', async ({ page }) => {
    await openMonthView(page, NOVEMBER_TARGET);

    const heading = page.getByRole('heading', { level: 2 });
    const before = (await heading.textContent())?.trim();

    await page.getByRole('button', { name: '前の月へ移動' }).click();

    await expect
      .poll(async () => (await heading.textContent())?.trim() ?? '')
      .not.toBe(before ?? '');
  });

  test('navigates to day view when a calendar card is clicked', async ({ page }) => {
    const targetIso = '2025-10-07';
    await openMonthView(page, OCTOBER_START);

    const dayCard = page.getByTestId(`${TESTIDS.SCHEDULES_MONTH_DAY_PREFIX}-${targetIso}`);
    await expect(dayCard).toBeVisible();
    await dayCard.click();

    await waitForDayViewReady(page);
    await expect(page).toHaveURL(/tab=day/);
    await expect(page.getByTestId(TESTIDS['schedules-day-heading'])).toBeVisible();
  });
});
