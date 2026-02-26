import { expect, test } from '@playwright/test';
import { bootAgenda } from './_helpers/bootAgenda';

test.describe('Dashboard - Constant SP Lane', () => {
  test.beforeEach(async ({ page }) => {
    // bootAgenda handles standard setup
    await bootAgenda(page, {
      envOverrides: { VITE_FEATURE_SCHEDULES_SP: '1' },
      storageOverrides: { 'feature:schedulesSp': '1' },
    });
    // Set desktop width (>= 1200 for isDesktopSize)
    await page.setViewportSize({ width: 1280, height: 720 });
    // Use classic layout to ensure ScheduleSection is rendered
    await page.goto('/dashboard?zeroscroll=0');
    // Wait for the page to be ready
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });

  test('SP lane frame is visible (disabled mode is OK)', async ({ page }) => {
    // 1) Scope to "Today's Schedule" zone to handle potential duplicates in staff section
    const zoneToday = page.getByTestId('dashboard-zone-today');
    const lane = zoneToday.getByTestId('schedules-sp-lane');

    // 2) Wait for the specific reaching condition
    await expect(lane).toBeVisible();
    await expect(lane).toHaveCount(1);

    // Constant frame should have the title
    await expect(lane).toContainText('SharePoint 外部連携');

    // Safety: Verify state transition is happening with strict regex
    await expect(lane).toHaveAttribute('data-state', /^(disabled|idle|active|error)$/);

    // 3) Monitoring Hub Contract: verify source attribute exists and is valid
    await expect(lane).toHaveAttribute('data-source', /^(demo|seed|sp|polling)$/);
  });
});
