import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoWeek } from './utils/scheduleNav';
import { waitForWeekViewReady } from './utils/wait';

test.describe('Schedule week – mobile toolbar/search', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapScheduleEnv(page);
  });

  test('keeps the week view visible while using the mobile search toolbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekViewReady(page);

    const filterToggle = page.getByTestId(TESTIDS.SCHEDULES_FILTER_TOGGLE);
    await expect(filterToggle).toBeVisible();
    await filterToggle.click();

    const filterDialog = page.getByTestId(TESTIDS.SCHEDULES_FILTER_DIALOG);
    await expect(filterDialog).toBeVisible();

    const searchInput = filterDialog.getByTestId(TESTIDS['schedules-filter-query']);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('早番');
    await expect(searchInput).toHaveValue('早番');

    const closeButton = filterDialog.getByRole('button', { name: '閉じる' });
    await expect(closeButton).toBeEnabled();
    await closeButton.click();

    const grid = page.getByTestId(TESTIDS['schedules-week-grid']);
    await expect(grid).toBeVisible();
  });
});
