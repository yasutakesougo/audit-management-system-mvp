import { expect, test } from '@playwright/test';
import { gotoMonthlyRecordsPage, switchMonthlyTab } from './_helpers/enableMonthly';

test.describe('Monthly Records - User Detail (minimal smoke)', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: user-detail tab + sample user query
    await gotoMonthlyRecordsPage(page, {
      path: '/records/monthly?tab=user-detail&user=I001&month=2025-11',
    });

    // Ensure tab switch is complete (aria-selected + panel visible)
    await switchMonthlyTab(page, 'detail');
  });

  test('@ci-smoke user-detail tabpanel is visible', async ({ page }) => {
    // Core validation: aria-controls reverse lookup
    const tabEl = page.getByRole('tab', { name: /^利用者別詳細$/ });
    const panelId = await tabEl.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = page.locator(`#${panelId!}`);
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute('hidden', '');

    // Lightweight sanity check: tablist exists
    await expect(page.getByRole('tablist')).toBeVisible();
  });
});