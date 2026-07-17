import { expect, test } from '@playwright/test';
import { setupPlaywrightEnv } from './_helpers/setupPlaywrightEnv';

test.describe('Authentication Flow (MSAL Mock)', () => {
  test('exposes an authenticated mock session', async ({ page }) => {
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_SKIP_LOGIN: '0',
        VITE_E2E_MSAL_MOCK: '1',
      }
    });

    await page.goto('/');

    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /サインイン/i })).toHaveCount(0);
  });

  test('persists the authenticated mock session after reload', async ({ page }) => {
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_SKIP_LOGIN: '0',
        VITE_E2E_MSAL_MOCK: '1',
      }
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible();
  });

  test('keeps the deterministic mock session after no-op logout', async ({ page }) => {
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_SKIP_LOGIN: '0',
        VITE_E2E_MSAL_MOCK: '1',
      }
    });

    await page.goto('/dashboard');
    const signOutButton = page.getByRole('button', { name: /サインアウト/i });
    await expect(signOutButton).toBeVisible();

    await signOutButton.click();

    await expect(page.getByRole('button', { name: /サインアウト/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /サインイン/i })).toHaveCount(0);
  });
});
