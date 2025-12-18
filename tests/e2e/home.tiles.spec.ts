import { expect, test } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Initialize SharePoint environment variables to prevent bootstrap errors
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

    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
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
    await expect(page.getByTestId('records-daily-root')).toBeVisible();
  });
});
