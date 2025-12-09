import { expect, test } from '@playwright/test';

import { prepareHydrationApp } from './_helpers/hydrationHud';

async function ensureHudVisible(page: import('@playwright/test').Page) {
  const hud = page.getByTestId('prefetch-hud');
  const hudToggleSelector = '[data-testid="prefetch-hud-toggle"]';

  if ((await hud.count()) > 0) {
    await expect(hud).toBeVisible();
    return hud;
  }

  const toggle = await page
    .waitForSelector(hudToggleSelector, {
      state: 'visible',
      timeout: 10_000,
    })
    .catch(() => null);

  if (!toggle) {
    throw new Error(
      'HUD toggle (data-testid="prefetch-hud-toggle") not found or not visible after 10s. Ensure the HUD devtools are enabled and rendered on the "/" route, or increase the timeout.'
    );
  }

  await page.click(hudToggleSelector);
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
