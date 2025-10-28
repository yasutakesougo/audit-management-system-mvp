import { expect, test } from '@playwright/test';

import { prepareHydrationApp } from './_helpers/hydrationHud';

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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('renders configured thresholds in HUD', async ({ page }) => {
    const hudToggle = page.getByTestId('prefetch-hud-toggle');
    const hud = page.getByTestId('prefetch-hud');
    if ((await hud.count()) === 0) {
      await hudToggle.click();
    }
    await expect(hud).toBeVisible();

    const thresholds = page.getByTestId('hud-thresholds');
    await expect(thresholds).toContainText('discrepancy=15m');
    await expect(thresholds).toContainText('absenceLimit=3');
    await expect(thresholds).toContainText('closeTime=18:30');
  });
});
