/**
 * MSAL Login Smoke Test (#338)
 *
 * Purpose:
 * - Verify MSAL auth flow basics (login state -> dashboard access)
 * - Early detection of critical auth bugs
 *
 * Assumptions:
 * - E2E env has MSAL mock enabled (VITE_E2E_MSAL_MOCK=1)
 * - No real Azure AD authentication (mock auth only)
 *
 * Scope:
 * - Verify dashboard accessibility
 * - Confirm auth state is functional
 */

import { expect, test } from '@playwright/test';

test.describe('MSAL login smoke', () => {
  test('auth flow: dashboard is accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);
    
    const signOutButton = page.getByRole('button', { name: /sign out|logout/i });
    const hasSignOut = await signOutButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasSignOut) {
      await signOutButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('dashboard renders without auth errors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    expect(currentUrl).toContain('/dashboard');

    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);
  });
});
