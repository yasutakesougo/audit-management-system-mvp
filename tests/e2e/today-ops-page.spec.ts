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

    // Verify Drawer content is the embedded form form Step C
    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    await expect(embedForm).toBeVisible();

    // Close the Drawer
    const closeBtn = page.getByTestId('today-quickrecord-close');
    await closeBtn.click();

    // Verify the Drawer is hidden and URL is reset
    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/.*mode=unfilled/);
  });

  test('opens Quick Record Drawer with focused user when tapping a user card', async ({ page }) => {
    // Visit the today page
    await page.goto('/today');

    // Wait for the user list to be visible and click the first user card
    const firstUserCard = page.locator('[role="button"]').filter({ hasText: '記録' }).first();
    await expect(firstUserCard).toBeVisible({ timeout: 2000 });

    // Extract the user ID from the URL after click, since we don't know the exact mocked ID beforehand
    await firstUserCard.click();

    // Verify the Drawer is visible
    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/.*userId=/);

    // Verify Drawer content is the embedded form form Step C
    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    await expect(embedForm).toBeVisible();

    // Verify that the user was actually selected in the form's User Picker
    const selectionCountAlert = embedForm.getByTestId('selection-count');
    await expect(selectionCountAlert).toBeVisible();
    await expect(selectionCountAlert).toContainText('1人の利用者が選択されています');

    // Close the Drawer
    const closeBtn = page.getByTestId('today-quickrecord-close');
    await closeBtn.click();

    // Verify the Drawer is hidden and URL is reset
    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/.*userId=/);
  });
});
