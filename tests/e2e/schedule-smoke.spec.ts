import { expect, test } from '@playwright/test';

test.describe('Schedule smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature:schedules', '1');
    });
  });

  test('shows tabs and demo appointments on week view', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByTestId('tab-week')).toBeVisible();
    await expect(page.getByTestId('tab-day')).toBeVisible();
    await expect(page.getByTestId('tab-timeline')).toBeVisible();

    const items = page.getByTestId('schedule-item');
    await expect(items.first()).toBeVisible();
  });
});

