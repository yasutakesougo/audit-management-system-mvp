import { expect, test } from '@playwright/test';
import { setupPlaywrightEnv } from './_helpers/setupPlaywrightEnv';

test.describe('Authentication Flow (MSAL Mock)', () => {
  test('interactive login flow', async ({ page }) => {
    // 1. Start with login required
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_SKIP_LOGIN: '0',
        VITE_E2E_MSAL_MOCK: '1',
      }
    });

    await page.goto('/');

    // Check if we are on the home page or redirected to a login state
    // The app shell should show the Sign In button
    const signInButton = page.getByRole('button', { name: /サインイン/i });
    await expect(signInButton).toBeVisible();

    // 2. Click Sign In
    await signInButton.click();

    // Sign In button clicks handleSignIn which calls signIn().
    // Our mock signIn sets __E2E_MOCK_AUTH__=1 and reloads.

    // 3. Verify redirected/dashboard access
    // Depending on logic, it might stay on same page or go to dashboard
    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible({ timeout: 10000 });
  });

  test('session persistence after reload', async ({ page }) => {
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_SKIP_LOGIN: '0',
        VITE_E2E_MSAL_MOCK: '1',
      },
      storageOverrides: {
        __E2E_MOCK_AUTH__: '1'
      }
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible();
  });

  test('logout flow', async ({ page }) => {
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_SKIP_LOGIN: '0',
        VITE_E2E_MSAL_MOCK: '1',
      },
      storageOverrides: {
        __E2E_MOCK_AUTH__: '1'
      }
    });

    await page.goto('/dashboard');
    const signOutButton = page.getByRole('button', { name: /サインアウト/i });
    await expect(signOutButton).toBeVisible();

    await signOutButton.click();

    // signOut clears __E2E_MOCK_AUTH__ and reloads.
    await expect(page.getByRole('button', { name: /サインイン/i })).toBeVisible({ timeout: 10000 });
  });
});
