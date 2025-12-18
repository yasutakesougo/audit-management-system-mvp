import { expect, test } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`CONSOLE ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log('PAGEERROR:', err));
    await page.goto('/');
    await expect(page).toHaveURL(/\/(dashboard)?\/?$/);
  });

  test('renders dashboard summary sections', async ({ page }) => {
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /今日の通所/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /日次記録状況/i })).toBeVisible({ timeout: 30_000 });
  });

  test('quick action navigates to daily activity records', async ({ page }) => {
    const quickAction = page
      .getByRole('link', { name: /支援記録（ケース記録）入力/ })
      .or(page.locator('a[href="/daily/activity"]'))
      .or(page.locator('a[href="/daily/activity/"]'));

    await expect(quickAction.first()).toBeVisible({ timeout: 30_000 });
    await quickAction.first().click();

    await expect(page).toHaveURL(/\/daily\/activity/);
    await expect(page.getByTestId('records-daily-root')).toBeVisible({ timeout: 30_000 });
  });
});
