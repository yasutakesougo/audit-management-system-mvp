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
    await expect(page).toHaveURL(/.*userId=U-?\d+/);

    // Verify Drawer content is the embedded form form Step C
    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    await expect(embedForm).toBeVisible();

    // Verify Embed layer caught the target user id safely
    const targetUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    expect(targetUserIdText?.trim()).toMatch(/^U-?\d+/);

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

  test('continuous input toggle handles auto-next flow properly', async ({ page }) => {
    // 1. Visit the today page
    await page.goto('/today');

    // Wait for the banner to be visible
    const banner = page.getByTestId('today-hero-banner');
    await expect(banner).toBeVisible({ timeout: 2000 });

    // 2. Click the CTA
    const ctaButton = page.getByTestId('today-hero-cta');
    await ctaButton.click();

    // Drawer should open
    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible();

    // 3. Verify toggle is ON by default
    const toggle = drawer.locator('input[type="checkbox"]').first();
    await expect(toggle).toBeAttached({ timeout: 2000 });
    await expect(toggle).toBeChecked();

    // 4. Extract first user ID from the invisible embed block (safe vs DOM layout changes)
    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');
    const targetUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    const firstUserId = targetUserIdText?.trim() || '';
    expect(firstUserId).toMatch(/^U-?\d+/);

    // Mock the POST save API call to return 200 quickly so we bypass server layers
    await page.route('/api/daily-records', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // We do not need to fill full required form fields if they are missing required validation intercepts,
    // but typically Daily Record requires some basic data. We will attempt a direct Save and observe the URL update.
    // If the standard UI fails to save due to form emptiness, our mocked environment is typically configured to bypass it.

    // Fill required form fields to pass internal useTableDailyRecordForm validation
    await page.getByRole('textbox', { name: '記録者名' }).fill('E2E Reporter');

    // Save
    const saveBtn = embedForm.getByTestId('daily-table-main-save-button');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify it moved to the next user
    await expect(page).not.toHaveURL(new RegExp(`userId=${firstUserId}`));
    await expect(page).toHaveURL(/.*userId=U-?\d+/);

    // 5. Turn toggle OFF by clicking the label text directly to bypass MUI strictly controlled input latency
    await drawer.getByText('連続入力').click();
    await expect(toggle).not.toBeChecked();

    // Extract second user ID
    const secondUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    const secondUserId = secondUserIdText?.trim() || '';
    expect(secondUserId).toMatch(/^U-?\d+/);
    expect(secondUserId).not.toEqual(firstUserId);

    // Re-fill the reporter name because the form state resets after successful submission
    await page.getByRole('textbox', { name: '記録者名' }).fill('E2E Reporter 2');

    // Click save again
    await saveBtn.click();

    // Verify it closes and resets URL because toggle is OFF
    await expect(drawer).not.toBeVisible();
    await expect(page).not.toHaveURL(/.*mode=unfilled/);
  });
});
