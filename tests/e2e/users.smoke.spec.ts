import { test, expect } from '@playwright/test';
import { installNetworkGuard } from '../helpers/networkGuard';

test.describe('Users dev harness (hermetic E2E)', () => {
  test('loads /dev/users without external calls', async ({ page }) => {
    // Enforce strict allowlist: localhost/127.0.0.1/data:/blob: only
    // Fail immediately on any external host (SharePoint, Graph, etc.)
    installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/dev/users');

    // Wait for stable markers
    await expect(page.getByTestId('users-dev-harness')).toBeVisible();
    await expect(page.getByTestId('users-dev')).toBeVisible();
    await expect(page.getByTestId('users-count')).toContainText('Count:');
  });

  test('Reload button works', async ({ page }) => {
    installNetworkGuard(page, 'allowlist-localhost');

    await page.goto('/dev/users');

    // Initial count should be 0
    await expect(page.getByTestId('users-count')).toContainText('Count: 0');

    // Click Reload button
    await page.getByRole('button', { name: 'Reload' }).click();

    // Count should increment
    await expect(page.getByTestId('users-count')).toContainText('Count: 1');
  });
});
