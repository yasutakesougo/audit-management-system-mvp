import { test, expect } from '@playwright/test';

test.describe('Schedules week ARIA smoke', () => {
  test('announces heading and exposes list semantics', async ({ page }) => {
    await page.goto('/schedules/week?week=2025-11-10');
    await page.getByTestId('schedules-week-page').waitFor();

    const heading = page.getByTestId('schedules-week-heading');
    await expect(heading).toBeVisible();
  await expect(heading).toHaveText(/週間スケジュール（\d{4}\/\d{2}\/\d{2} – \d{4}\/\d{2}\/\d{2}）/);

    const list = page.locator('[data-testid="schedules-week-grid"]');
    const empty = page.getByTestId('schedules-empty');
    await expect(list.or(empty)).toBeVisible();
  });
});
