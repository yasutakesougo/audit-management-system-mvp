import { test, expect } from '@playwright/test';
import { installNetworkGuard } from '../helpers/networkGuard';

test.describe('Users page smoke (hermetic E2E)', () => {
  test('loads /users without external calls', async ({ page }) => {
    // Enforce strict allowlist: localhost/127.0.0.1/data:/blob: only
    // Fail immediately on any external host (SharePoint, Graph, etc.)
    installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/users');

    // Wait for stable markers
    await expect(page.getByTestId('users-panel-root')).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/users');
    await expect(page.getByTestId('users-panel-search')).toBeVisible();
  });
});
