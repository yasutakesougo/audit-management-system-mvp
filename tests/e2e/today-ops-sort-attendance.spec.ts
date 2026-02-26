import { expect, test } from '@playwright/test';

test.describe('Today Ops Screen - Sort Attendance', () => {
  // Use VITE_E2E=1 to trigger the fallback Mock mechanism defined in TodayOpsPage
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1',
    },
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });

    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } })
    }));
  });

  test('auto-next flow follows attendanceToday sorting policy sequentially substituting absent users', async ({ page }) => {
    // Visit the today page
    await page.goto('/today');

    // Wait for the banner to be visible
    const banner = page.getByTestId('today-hero-banner');
    await expect(banner).toBeVisible({ timeout: 2000 });

    // Click the CTA
    const ctaButton = page.getByTestId('today-hero-cta');
    await ctaButton.click();

    // Drawer should open
    const drawer = page.getByTestId('today-quickrecord-drawer');
    await expect(drawer).toBeVisible();

    const embedForm = drawer.getByTestId('today-quickrecord-form-embed');

    // 1st User tracking -- ensuring absent users (U001) are bypassed
    const firstUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    const firstUserId = firstUserIdText?.trim() || '';

    // Explicitly verify the ID bypasses the standard alphabetical sorting
    // In our mock, index 0 (U001) is "当日欠席", index 1 (U005) is "通所中". So U005 surfaces first.
    expect(firstUserId.replace(/-/g, '')).toBe('U005');
    await expect(page).toHaveURL(new RegExp(`userId=${firstUserId}`));

    // Mock the POST save API call
    await page.route('/api/daily-records', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // Fill validation
    await page.getByRole('textbox', { name: '記録者名' }).fill('E2E Reporter');

    // Save
    const saveBtn = embedForm.getByTestId('daily-table-main-save-button');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify it moved to the next user
    await expect(page).not.toHaveURL(new RegExp(`userId=${firstUserId}`));

    // 2nd User Tracking -- should sequentially select U012
    const secondUserIdText = await embedForm.getByTestId('today-quickrecord-target-userid').textContent();
    const secondUserId = secondUserIdText?.trim() || '';

    expect(secondUserId.replace(/-/g, '')).toBe('U012');
  });
});
