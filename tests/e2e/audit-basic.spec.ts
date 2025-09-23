import { test, expect } from '@playwright/test';

test('loads audit panel via /audit route and shows heading', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('h2:has-text("監査ログ")')).toBeVisible();
});
