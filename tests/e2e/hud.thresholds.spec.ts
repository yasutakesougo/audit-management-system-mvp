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
      } as const;
      win.__ENV__ = {
        ...(win.__ENV__ ?? {}),
        ...overrides,
      };
      win.__TEST_ENV__ = { ...(win.__TEST_ENV__ ?? {}), ...overrides };
    });
    await prepareHydrationApp(page);
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('renders configured thresholds in HUD', async ({ page }) => {
    await ensureHudVisible(page);

    const thresholds = page.getByTestId('hud-thresholds');
    await expect(thresholds).toContainText('discrepancy=15m');
    await expect(thresholds).toContainText('absenceLimit=3');
    await expect(thresholds).toContainText('closeTime=18:30');
  });
});
