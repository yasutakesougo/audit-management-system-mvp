import { expect, test } from '@playwright/test';

test.describe('Today Ops Screen', () => {
  // Use VITE_E2E=1 to trigger the fallback Mock mechanism defined in TodayOpsPage
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1', // Ensure custom env variable injection bypasses real APIs globally if needed
    },
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    // mock api calls since we only care about UI flow
    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } })
    }));
  });

  test('displays unfilled banner and opens Quick Record Drawer via URL state', async ({ page }) => {
    // Visit the today page
    await page.goto('/today');

    // Wait for the banner to be visible
    try {
      const banner = page.getByTestId('today-hero-banner');
      await expect(banner).toBeVisible({ timeout: 2000 });
      await expect(banner).toContainText('未記録 3件');
    } catch (e) {
      console.log("PAGE CONTENT ERROR DUMP:");
      console.log(await page.content());
      throw e;
    }

    // Verify CTA button exists
    const ctaButton = page.getByTestId('today-hero-cta');
    await expect(ctaButton).toBeVisible();

    // Click the CTA to open the Drawer
    await ctaButton.click();

    // Verify the Drawer is visible and URL is updated
    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/.*mode=unfilled/);

    // Verify Drawer content
    await expect(drawer).toContainText('未記録の一括照会');
    await expect(drawer).toContainText('PR3 Placeholder');

    // Close the Drawer
    const closeBtn = page.getByTestId('today-quickrecord-close');
    await closeBtn.click();

    // Verify the Drawer is hidden and URL is reset
    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/.*mode=unfilled/);
  });
});
