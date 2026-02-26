import { expect, test } from '@playwright/test';
import { bootAgenda } from './_helpers/bootAgenda';

test.describe('Dashboard - SP Lane Error Classification', () => {
  test('classifies network error when offline', async ({ page }) => {
    // 1. Simulate offline state BEFORE page load
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false });
    });

    // 2. Setup standard environment
    await bootAgenda(page, {
      envOverrides: {
        VITE_FEATURE_SCHEDULES: '1',
        VITE_FEATURE_SCHEDULES_SP: '1',
      },
      storageOverrides: { 'feature:schedulesP': '1', 'feature:schedulesSp': '1' },
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard?zeroscroll=0');

    // 3. Locate SP Lane in Today zone
    const zoneToday = page.getByTestId('dashboard-zone-today');
    const lane = zoneToday.getByTestId('schedules-sp-lane');

    // 4. Verify 'error' state and 'network' classification
    await expect(lane).toBeVisible();
    await expect(lane).toHaveAttribute('data-state', 'error', { timeout: 15000 });
    await expect(lane).toHaveAttribute('data-error-kind', 'network');
  });
});
