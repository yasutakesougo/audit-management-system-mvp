import { expect, test, type Page } from '@playwright/test';

import { prepareHydrationApp } from './_helpers/hydrationHud';

async function ensureHudVisible(page: Page) {
  const hud = page.getByTestId('prefetch-hud');
  const hudToggle = page.getByTestId('prefetch-hud-toggle');

  const [hudCount, toggleCount] = await Promise.all([hud.count(), hudToggle.count()]);

  if (hudCount > 0) {
    await expect(hud).toBeVisible();
    return hud;
  }

  if (toggleCount === 0) {
    test.skip(true, 'HUD devtools disabled in this environment; skipping HUD thresholds E2E.');
  }

  await hudToggle.click();
  await expect(hud).toBeVisible();
  return hud;
}

test.describe('HUD thresholds display', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const win = window as typeof window & {
        __ENV__?: Record<string, string | undefined>;
        __TEST_ENV__?: Record<string, unknown>;
      };
      const overrides = {
        VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.25',
        VITE_ABSENCE_MONTHLY_LIMIT: '3',
        VITE_FACILITY_CLOSE_TIME: '18:30',
        VITE_PREFETCH_HUD: '1',
        VITE_SP_RESOURCE: 'https://example.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/demo',
        VITE_MSAL_CLIENT_ID: 'dummy-client-id',
        VITE_MSAL_TENANT_ID: 'dummy-tenant-id',
      } as const;
      win.__ENV__ = {
        ...(win.__ENV__ ?? {}),
        ...overrides,
      };
      win.__TEST_ENV__ = { ...(win.__TEST_ENV__ ?? {}), ...overrides };
    });
    await prepareHydrationApp(page);
    await page.goto('/');
    // Wait for the app to at least render the toggle
    await expect(page.getByTestId('prefetch-hud-toggle')).toBeVisible({ timeout: 15000 });
  });

  test('renders configured thresholds in HUD', async ({ page }) => {
    await ensureHudVisible(page);

    const thresholds = page.getByTestId('hud-thresholds');
    const discrepancy = thresholds.getByTestId('hud-threshold-discrepancy');
    const absence = thresholds.getByTestId('hud-threshold-absence');
    const closeTime = thresholds.getByTestId('hud-threshold-closeTime');

    await expect(discrepancy).toHaveAttribute('data-value', '15m');
    await expect(absence).toHaveAttribute('data-value', '3');
    await expect(closeTime).toHaveAttribute('data-value', '18:30');
  });
});
