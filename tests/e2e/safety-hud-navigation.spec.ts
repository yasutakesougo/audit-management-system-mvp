import { expect, test } from '@playwright/test';

test.describe('Dashboard Safety HUD - Navigation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard?zeroscroll=0');
    await page.waitForLoadState('networkidle');
  });

  test('Safety HUD alerts navigation', async ({ page }) => {
    console.log('Testing Safety HUD alert navigation...');

    const legacySafetyHUD = page.getByTestId('dashboard-safety-hud');
    const briefingHUD = page.getByTestId('dashboard-briefing-hud');
    const hasLegacyHUD = (await legacySafetyHUD.count()) > 0;
    const hasBriefingHUD = (await briefingHUD.count()) > 0;

    if (hasLegacyHUD) {
      await expect(legacySafetyHUD).toBeVisible();
    }
    if (hasBriefingHUD) {
      await expect(briefingHUD).toBeVisible();
    }

    const alerts = page
      .locator('[data-testid^="safety-hud-alert-"]')
      .or(page.locator('[data-testid^="briefing-alert-"]'));
    const alertCount = await alerts.count();

    console.log(`Found ${alertCount} Safety HUD alerts`);

    if (alertCount > 0) {
      const firstAlert = alerts.first();
      await expect(firstAlert).toBeVisible();
      const alertText = await firstAlert.textContent();
      console.log(`First alert content: ${alertText?.substring(0, 100)}...`);

      const beforeUrl = page.url();
      await firstAlert.click();
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      console.log(`Navigated to: ${currentUrl}`);

      const isSamePageJump = currentUrl === beforeUrl || currentUrl.includes('/dashboard');
      const validNavigation =
        currentUrl.includes('/daily/activity') ||
        currentUrl.includes('/daily/attendance') ||
        currentUrl.includes('/admin/integrated-resource-calendar');
      expect(isSamePageJump || validNavigation).toBeTruthy();

    } else {
      console.log('ℹ️ No alerts found - this is expected in normal operation');

      const safetySection = page.getByTestId('dashboard-section-safety');
      await expect(safetySection).toBeVisible();
      console.log('✅ Safety section is visible');
    }
  });

  test('Multiple alerts priority order', async ({ page }) => {
    console.log('Testing alert priority ordering...');

    const alerts = page
      .locator('[data-testid^="safety-hud-alert-"]')
      .or(page.locator('[data-testid^="briefing-alert-"]'));
    const alertCount = await alerts.count();

    console.log(`Found ${alertCount} alerts for priority testing`);

    if (alertCount > 1) {
      type Severity = 'error' | 'warning' | 'info';

      const severities: Severity[] = [];

      for (let i = 0; i < Math.min(alertCount, 3); i++) {
        const alert = alerts.nth(i);
        const classList = await alert.getAttribute('class') || '';
        const testId = await alert.getAttribute('data-testid') || '';

        let severity: Severity = 'info'; // default

        if (classList.includes('error') || testId.includes('error')) {
          severity = 'error';
        } else if (classList.includes('warning') || testId.includes('warning')) {
          severity = 'warning';
        }

        severities.push(severity);
        console.log(`Alert ${i + 1}: severity = ${severity}`);
      }

      // 順序の検証（error -> warning -> info）
      const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
      let isCorrectOrder = true;

      for (let i = 0; i < severities.length - 1; i++) {
        const current = severityOrder[severities[i]];
        const next = severityOrder[severities[i + 1]];
        if (current > next) {
          isCorrectOrder = false;
          break;
        }
      }

      console.log(`Alert order: [${severities.join(', ')}] - ${isCorrectOrder ? 'Correct' : 'Incorrect'}`);
      expect(isCorrectOrder).toBeTruthy();

    } else {
      console.log('ℹ️ Not enough alerts to test priority ordering');
    }
  });

  test('Safety HUD responsive behavior', async ({ page }) => {
    console.log('Testing Safety HUD responsive behavior...');

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByTestId('dashboard-section-safety')).toBeVisible();

    console.log('✅ Safety HUD visible on desktop');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('dashboard-section-safety')).toBeVisible();
    console.log('✅ Safety HUD visible on mobile');
  });
});