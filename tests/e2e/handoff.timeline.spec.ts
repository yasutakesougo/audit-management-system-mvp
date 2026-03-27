import { expect, test } from '@playwright/test';

/**
 * Validates that the handoff quick-note Dialog is accessible from both:
 * 1. The page-level "今すぐ申し送り" button on /handoff-timeline
 * 2. The global footer "申し送り" button
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

  test('footer button opens same dialog on /handoff-timeline', async ({ page }) => {
    // Click the footer quick action
    await page.getByTestId('handoff-footer-quicknote').click();

    // Same dialog should appear
    const dialog = page.getByTestId('handoff-quicknote-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('handoff-quicknote-card')).toBeVisible();
  });
});
