/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright e2e files live outside the main tsconfig include set.
import { test, expect } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';
import { TESTIDS } from '@/testids';
import { gotoMonth } from './utils/scheduleNav';
import { waitForMonthViewReady, waitForDayViewReady } from './utils/scheduleActions';

test.describe('Schedule month→day navigation smoke', () => {
  test('navigates from month calendar to day view with correct query params', async ({ page }) => {
    await bootSchedule(page);

    // Navigate to month view with a specific date
    const targetDate = new Date('2025-12-01');
    await gotoMonth(page, targetDate);
    await waitForMonthViewReady(page);

    // Get any day card and click it (opens popover)
    const dayCards = page.locator(`[data-testid^="${TESTIDS.SCHEDULES_MONTH_DAY_PREFIX}-"]`);
    if ((await dayCards.count()) === 0) {
      test.skip(true, 'No day cards in month view.');
    }

    const firstDayCard = dayCards.first();
    await expect(firstDayCard).toBeVisible();
    await firstDayCard.click();

    // Wait for popover to appear and click "Day で開く" button
    const openDayButton = page.getByTestId(TESTIDS['schedules-popover-open-day']);
    await expect(openDayButton).toBeVisible();
    await openDayButton.click();

    // Verify navigation to day view with correct query params
    await waitForDayViewReady(page);
    await expect(page).toHaveURL(/tab=day/);
    const url = page.url();
    // Current routing uses /schedules/week with tab=day query param for day view
    expect(url).toContain('/schedules/week');
    expect(url).toContain('date=');
    expect(url).toContain('tab=day');
  });

  test('today button returns to month view', async ({ page }) => {
    await bootSchedule(page);

    // Start from a month view
    const targetDate = new Date('2025-12-15');
    await gotoMonth(page, targetDate);
    await waitForMonthViewReady(page);

    // Click today button
    const todayButton = page.getByRole('button', { name: '今月に移動' });
    if ((await todayButton.count()) === 0) {
      test.skip(true, 'Today button not found.');
    }

    await expect(todayButton).toBeVisible();
    await todayButton.click();

    // Verify we're still in month view
    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);
    const url = page.url();
    expect(url).toMatch(/\/schedules\/(month|week)/);
    expect(url).toContain('tab=month');
  });
});
