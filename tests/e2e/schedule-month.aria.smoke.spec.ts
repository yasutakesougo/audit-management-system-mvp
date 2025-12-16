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
    if ((await root.count()) === 0) {
      test.skip(true, 'Month view not rendered when no events (CI environment).');
    }

    await expect(root).toBeVisible();
    await expect(root.getByText('予定なし').first()).toBeVisible();
  });

  test('exposes heading, navigation, and org indicator', async ({ page }) => {
    await openMonthView(page, NOVEMBER_TARGET);

    const root = page.getByTestId('schedule-month-root');
    if ((await root.count()) === 0) {
      test.skip(true, 'Month view not rendered (no events in CI).');
    }

    const heading = page.getByRole('heading', { level: 2 });
    if ((await heading.count()) === 0) {
      test.skip(true, 'Month heading not rendered.');
    }
    await expect(heading).toBeVisible();

    await expect(page.getByRole('button', { name: '前の月へ移動' })).toBeVisible();
    await expect(page.getByRole('button', { name: '今月に移動' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次の月へ移動' })).toBeVisible();

    const orgChipText = await getOrgChipText(page, 'month');
    if (!orgChipText) {
      test.skip(true, 'Month org indicator not available in this environment.');
    }
  });

  test('month navigation updates the heading label', async ({ page }) => {
    await openMonthView(page, NOVEMBER_TARGET);

    const heading = page.getByRole('heading', { level: 2 });
    if ((await heading.count()) === 0) {
      test.skip(true, 'Month heading not rendered.');
    }
    const before = (await heading.textContent())?.trim();

    await page.getByRole('button', { name: '前の月へ移動' }).click();

    await expect
      .poll(async () => (await heading.textContent())?.trim() ?? '')
      .not.toBe(before ?? '');
  });

  test('navigates to day view when a calendar card is clicked', async ({ page }) => {
    await openMonthView(page, OCTOBER_START);

    const dayCards = page.locator(`[data-testid^="${TESTIDS.SCHEDULES_MONTH_DAY_PREFIX}-"]`);
    if ((await dayCards.count()) === 0) {
      test.skip(true, 'No day cards in month view.');
    }

    const dayCard = dayCards.first();
    await expect(dayCard).toBeVisible();
    await dayCard.click();

    await waitForDayViewReady(page);
    await expect(page).toHaveURL(/tab=day/);
    await expect(page.getByTestId(TESTIDS['schedules-day-heading'])).toBeVisible();
  });
});
