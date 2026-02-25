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
    await page.goto('/schedules/week');

    const lane = page.getByTestId('schedules-sp-lane');
    // Reaching condition: Wait for the lane to be visible (DOM condition)
    await expect(lane).toBeVisible();
    await expect(lane).toContainText('SharePoint 外部連携');

    // Safety: Verify state transition is happening with strict regex
    await expect(lane).toHaveAttribute('data-state', /^(disabled|idle|active|error)$/);
    await expect(lane).toHaveAttribute('data-source', /^(demo|seed|sp|polling)$/);
  });

  test('does not show SP lane on mobile viewport (because isDesktopSize gate)', async ({ page }) => {
    // Set mobile width (e.g., iPhone size)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/schedules/week');

    const lane = page.getByTestId('schedules-sp-lane');
    await expect(lane).toHaveCount(0);
  });
});
