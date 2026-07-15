import { expect, test } from '@playwright/test';

/**
 * Validates that the handoff quick-note Dialog is accessible from both:
 * 1. The page-level "今すぐ申し送り" button on /handoff-timeline
 * 2. The retired global footer action is not exposed in the standard app shell
 */
test.describe('Handoff Timeline quick note Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/handoff-timeline');
  });

  test('page button opens quick note dialog', async ({ page }) => {
    // Click the page-level button
    await page.getByTestId('handoff-page-quicknote-open').click();

    // Page-owned dialog should appear
    const pageDialog = page.getByTestId('handoff-page-quicknote-dialog');
    await expect(pageDialog).toBeVisible();
    // Footer-owned dialog should stay closed (regression guard: prevent double-open)
    await expect(page.getByTestId('handoff-quicknote-dialog')).toBeHidden();

    // QuickNote card should be inside the dialog
    await expect(pageDialog.getByTestId('handoff-quicknote-card')).toBeVisible();

    // Close the dialog
    await pageDialog.getByRole('button', { name: '申し送りダイアログを閉じる' }).click();
    await expect(pageDialog).toBeHidden();
  });

  test('standard app shell exposes only the page quick-note entry', async ({ page }) => {
    await expect(page.getByTestId('handoff-page-quicknote-open')).toBeVisible();
    await expect(page.getByTestId('handoff-footer-quicknote')).toHaveCount(0);
  });
});
