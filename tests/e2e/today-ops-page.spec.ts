import { expect, test } from '@playwright/test';

test.describe('Today Ops Screen', () => {
  // Use VITE_E2E=1 to trigger the fallback Mock mechanism defined in TodayOpsPage
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1', // Ensure custom env variable injection bypasses real APIs globally if needed
    },
  });

  test.beforeEach(async ({ page }) => {
    // mock api calls since we only care about UI flow
    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } })
    }));
  });

  test('displays unfilled banner for mockup data on /today', async ({ page }) => {
    // TodayOpsPage itself detects E2E and mocks unfilledCount to 3

    // Visit the today page
    await page.goto('/today');

    // Wait for the banner to be visible
    const banner = page.getByTestId('today-hero-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('未記録 3件');

    // Verify CTA button exists
    const ctaButton = page.getByTestId('today-hero-cta');
    await expect(ctaButton).toBeVisible();

    // Click the CTA and confirm console log output
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await ctaButton.click();

    // Give it a moment to process the console output
    await page.waitForTimeout(100);

    expect(consoleLogs.some(log => log.includes('Open Quick Record for Unfilled'))).toBeTruthy();
  });
});
