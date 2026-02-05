import { test, expect } from '@playwright/test';
import { installNetworkGuard } from '../helpers/networkGuard';

test.describe('Users page smoke (hermetic E2E)', () => {
  test('loads /users without external calls', async ({ page }) => {
    // Enforce strict allowlist: localhost/127.0.0.1/data:/blob: only
    // Fail immediately on any external host (SharePoint, Graph, etc.)
    installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/users');

    // Wait for stable markers
    console.info('[e2e] url=', page.url());
    console.info('[e2e] title=', await page.title());
    await page.waitForTimeout(250);
    await expect(page.getByTestId('users-panel-root')).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/users');

    // ---- Diagnostic: Verify page state ----
    const bodyText = (await page.locator('body').innerText()).slice(0, 1200);
    console.info('[e2e] before-expect url=', page.url());
    console.info('[e2e] before-expect title=', await page.title());
    console.info('[e2e] before-expect body(head)=', bodyText.replace(/\s+/g, ' '));

    await page.waitForTimeout(250);
    await expect(page.getByTestId('users-panel-search')).toBeVisible();
  });
});
