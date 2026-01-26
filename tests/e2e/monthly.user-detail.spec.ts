import { expect, test } from '@playwright/test';
import { gotoMonthlyRecordsPage, switchMonthlyTab, monthlyTestIds } from './_helpers/enableMonthly';

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

  test('@ci-smoke empty state', async ({ page }) => {
    // Setup with demo seed
    await gotoMonthlyRecordsPage(page, { seed: { monthlyRecords: true } });
    await switchMonthlyTab(page, 'detail');

    // Navigate to non-existent user
    await page.goto('/records/monthly?tab=user-detail&user=NONEXISTENT&month=2025-11', {
      waitUntil: 'domcontentloaded',
    });

    // Validate empty state is visible
    await expect(page.getByTestId(monthlyTestIds.detailEmptyState)).toBeVisible();
    await expect(page.getByText('データが見つかりませんでした')).toBeVisible();
  });
});