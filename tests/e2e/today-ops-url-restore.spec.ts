import { expect, test } from '@playwright/test';
import { bootTodayOpsPage } from './_helpers/bootTodayOpsPage';

test.describe('Today Ops Screen - URL Restore & autoNext priorities', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
    await bootTodayOpsPage(page);
  });

  test('prioritizes URL over localStorage, and correctly restores after reload', async ({ page }) => {
    // 1. Arrange: Inject localStorage with OFF value "0" before navigation
    await page.goto('/today');
    await page.evaluate(() => {
      window.localStorage.setItem('ams_quick_auto_next', '0');
    });

    // 2. Act: Navigate with URL param overulling the storage (autoNext=1)
    await page.goto('/today?mode=unfilled&userId=U-001&date=2026-02-26&autoNext=1');
    await page.waitForLoadState('networkidle');

    // URL should dominate localStorage and keep mode/user/autoNext
    await expect(page).toHaveURL(/mode=unfilled/);
    await expect(page).toHaveURL(/userId=U-?001/);
    await expect(page).toHaveURL(/autoNext=1/);

    // 3. Act: Reload the page
    await page.reload();
    await expect(page).toHaveURL(/mode=unfilled/);
    await expect(page).toHaveURL(/userId=U-?001/);
    await expect(page).toHaveURL(/autoNext=1/);

    // 4. Act: Remove the URL param to verify fallback to localStorage
    await page.goto('/today?mode=unfilled&userId=U-001&date=2026-02-26');
    await expect(page).toHaveURL(/mode=unfilled/);
    await expect(page).toHaveURL(/userId=U-?001/);
    await expect(page).not.toHaveURL(/autoNext=1/);
  });
});
