import { test } from '@playwright/test';

/**
 * Interactive authentication setup for integration tests.
 *
 * Usage:
 *   PLAYWRIGHT_PROJECT=integration npm run auth:setup
 *
 * This will open a browser, allow you to manually sign in via MSAL,
 * then save the authentication state to tests/.auth/storageState.json.
 *
 * Subsequent integration tests will reuse this saved auth state.
 */
test('auth setup (interactive)', async ({ page }) => {
  await page.goto('/');

  // Wait for manual sign-in to complete
  // AppShell renders only after successful authentication
  await page.getByTestId('app-shell').waitFor({ timeout: 120_000 });

  // Save authentication state
  await page.context().storageState({ path: 'tests/.auth/storageState.json' });

  console.log('✅ Authentication state saved to tests/.auth/storageState.json');
});
