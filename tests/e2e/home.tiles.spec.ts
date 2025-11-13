import { expect, test } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders dashboard summary sections', async ({ page }) => {
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /今日の通所/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /日次記録状況/i })).toBeVisible();
  });

  test('quick action navigates to daily activity records', async ({ page }) => {
    const quickAction = page
      .getByRole('link', { name: /活動日誌入力/ })
      .or(page.locator('a[href="/daily/activity"]'))
      .or(page.locator('a[href="/daily/activity/"]'));

    await expect(quickAction.first()).toBeVisible();
    await quickAction.first().click();

    await expect(page).toHaveURL(/\/daily\/activity/);
    await expect(page.getByTestId('records-daily-root')).toBeVisible();
  });
});
