import { expect, test } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push(`[${type}] ${text}`);
      if (type === 'error' || type === 'warning') {
        console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);
      }
    });

    page.on('pageerror', (error) => {
      const errorMsg = error.message;
      pageErrors.push(errorMsg);
      console.log(`[PAGE ERROR] ${errorMsg}`);
    });

    await page.addInitScript(() => {
      window.ENV = {
        ...window.ENV,
        VITE_SP_SCOPE_DEFAULT: 'https://mock.sharepoint.com/AllSites.Read',
        VITE_SP_CLIENT_ID: 'mock-client-id',
        VITE_SP_TENANT_ID: 'mock-tenant-id',
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
      };
      localStorage.setItem('e2e:skipLogin', '1');
    });

    console.log('[TEST] Navigating to /');
    await page.goto('/');
    console.log(`[TEST] Current URL after goto: ${page.url()}`);

    try {
      await page.waitForURL(/\/dashboard(\?.*)?$/, { timeout: 15_000 });
      console.log(`[TEST] Redirected to: ${page.url()}`);
    } catch (e) {
      console.error(`[TEST] Failed to redirect to /dashboard. Current URL: ${page.url()}`);
      console.error(`[TEST] Console messages: ${JSON.stringify(consoleMessages, null, 2)}`);
      console.error(`[TEST] Page errors: ${JSON.stringify(pageErrors, null, 2)}`);
      const htmlSnippet = await page.content();
      console.error(`[TEST] Page HTML (first 1000 chars): ${htmlSnippet.substring(0, 1000)}`);
      throw e;
    }
  });

  test('renders dashboard summary sections', async ({ page }) => {
    console.log('[TEST] Waiting for dashboard-page testid');
    try {
      await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 30_000 });
    } catch (e) {
      console.error(`[TEST] dashboard-page not visible. Current URL: ${page.url()}`);
      const htmlSnippet = await page.content();
      console.error(`[TEST] Page HTML (first 2000 chars): ${htmlSnippet.substring(0, 2000)}`);
      throw e;
    }

    console.log('[TEST] dashboard-page is visible');
    await expect(page.getByRole('heading', { name: /今日の通所/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /日次記録状況/i })).toBeVisible({ timeout: 30_000 });
  });

  test('quick action navigates to daily activity records', async ({ page }) => {
    console.log('[TEST] Waiting for dashboard-page before clicking quick action');
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 30_000 });

    const quickAction = page
      .getByRole('link', { name: /支援記録（ケース記録）入力/ })
      .or(page.locator('a[href="/daily/activity"]'))
      .or(page.locator('a[href="/daily/activity/"]'));

    console.log('[TEST] Waiting for quick action link');
    try {
      await expect(quickAction.first()).toBeVisible({ timeout: 30_000 });
    } catch (e) {
      console.error(`[TEST] Quick action link not found. Current URL: ${page.url()}`);
      const allLinks = await page.locator('a').all();
      const hrefs = await Promise.all(allLinks.map(async (link) => await link.getAttribute('href')));
      console.error(`[TEST] All links on page: ${JSON.stringify(hrefs, null, 2)}`);
      throw e;
    }

    await quickAction.first().click();
    await expect(page).toHaveURL(/\/daily\/activity/);
    await expect(page.getByTestId('records-daily-root')).toBeVisible();
  });
});
