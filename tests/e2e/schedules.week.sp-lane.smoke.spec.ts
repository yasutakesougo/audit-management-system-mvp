import { expect, test } from '@playwright/test';
import { bootAgenda } from './_helpers/bootAgenda';

test.describe('Schedules Week - SP Lane', () => {
  test.beforeEach(async ({ page }) => {
    await bootAgenda(page, {
      envOverrides: { VITE_FEATURE_SCHEDULES_SP: '1' },
      storageOverrides: { 'feature:schedulesSp': '1' },
    });
  });

  test('shows SP lane on desktop viewport', async ({ page }) => {
    // Set desktop width (>= 1200 for isDesktopSize)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard?zeroscroll=0');

    const lane = page.getByTestId('schedules-sp-lane');
    // Reaching condition: Wait for the lane to be visible (DOM condition)
    await expect(lane).toBeVisible();
    await expect(page.getByTestId('dashboard-section-schedule')).toBeVisible();
  });

  test('keeps the SP lane in the dashboard stack on mobile viewport', async ({ page }) => {
    // Set mobile width (e.g., iPhone size)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard?zeroscroll=0');

    const lane = page.getByTestId('schedules-sp-lane');
    await expect(lane).toBeVisible();
  });
});
