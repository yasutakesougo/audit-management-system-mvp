import { expect, test } from '@playwright/test';

test.describe('Today Ops Screen - URL Restore & autoNext priorities', () => {
  // Use VITE_E2E=1 to trigger the fallback Mock mechanism defined in TodayOpsPage
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1',
    },
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    // mock api calls since we only care about UI flow
    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } })
    }));
  });

  test('prioritizes URL over localStorage, and correctly restores after reload', async ({ page }) => {
    // 1. Arrange: Inject localStorage with OFF value "0" before navigation
    await page.goto('/today');
    await page.evaluate(() => {
      window.localStorage.setItem('ams_quick_auto_next', '0');
    });

    // 2. Act: Navigate with URL param overulling the storage (autoNext=1)
    await page.goto('/today?mode=unfilled&userId=U-001&date=2026-02-26&autoNext=1');

    // Drawer should open and be focused on U-001
    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible({ timeout: 2000 });

    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    await expect(embedForm.getByTestId('today-quickrecord-target-userid')).toHaveText('U-001');

    // Verify Switch is ON (true) because URL prioritises over internal localstorage ("0")
    const toggle = drawer.locator('input[type="checkbox"]').first();
    await expect(toggle).toBeChecked();

    // 3. Act: Reload the page
    await page.reload();
    await expect(drawer).toBeVisible({ timeout: 2000 });

    // Assert: Everything was retained, including the URL param priority
    await expect(embedForm.getByTestId('today-quickrecord-target-userid')).toHaveText('U-001');
    await expect(toggle).toBeChecked();

    // 4. Act: Remove the URL param to verify fallback to localStorage
    await page.goto('/today?mode=unfilled&userId=U-001&date=2026-02-26');
    await expect(drawer).toBeVisible({ timeout: 2000 });

    // Switch should now be OFF (false) based on the original localstorage injection
    await expect(toggle).not.toBeChecked();
  });
});
