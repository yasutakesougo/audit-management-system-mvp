import { test, expect } from '@playwright/test';

test.describe('Diagnostics Health — read only', () => {
  let mutationRequests: string[];

  test.beforeEach(async ({ page }) => {
    mutationRequests = [];
    // Prevent accidental SharePoint mutations even when a regression reappears.
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const isSharePoint = url.pathname === '/api/sp-proxy' || url.hostname.endsWith('.sharepoint.com');
      if (isSharePoint && !['GET', 'HEAD'].includes(request.method())) {
        mutationRequests.push(request.method());
        await route.abort();
        return;
      }
      await route.continue();
    });
  });

  test('page load keeps writes and report saving disabled', async ({ page }) => {
    await page.goto('/diagnostics/health');
    await expect(page.getByTestId('diagnostics-readonly-notice')).toBeVisible();
    await expect(page.getByTestId('diagnostics-run')).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByTestId('diagnostics-save')).toBeDisabled();
    expect(mutationRequests).toEqual([]);
  });

  test('manual rerun cannot enable or execute SharePoint writes', async ({ page }) => {
    await page.goto('/diagnostics/health');
    const run = page.getByTestId('diagnostics-run');
    await expect(run).toBeEnabled({ timeout: 60_000 });
    await run.click();
    await expect(run).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByTestId('diagnostics-save')).toBeDisabled();
    expect(mutationRequests).toEqual([]);
  });
});
