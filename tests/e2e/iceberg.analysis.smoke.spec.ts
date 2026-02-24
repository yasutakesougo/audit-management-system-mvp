import { expect, test } from '@playwright/test';

import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Iceberg Analysis smoke', () => {
  test('loads page, selects user, sees nodes, and saves session', async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      initialPath: '/analysis/iceberg',
    });

    // Page title should be visible
    await expect(page.getByText('Iceberg Workspace')).toBeVisible({ timeout: 10_000 });

    // Empty state should show prompt
    await expect(page.getByText('上部のドロップダウンから分析対象を選択してください')).toBeVisible();

    // Select a user from the dropdown
    const userSelect = page.getByLabel('分析対象');
    await expect(userSelect).toBeVisible({ timeout: 5_000 });
    await userSelect.click();

    // Wait for dropdown options, pick the first user
    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible({ timeout: 5_000 });
    await firstOption.click();

    // Demo nodes should appear on the canvas
    // The IcebergCard components contain behavior/assessment/environment labels
    await expect(page.getByText('他害(叩く)')).toBeVisible({ timeout: 5_000 });

    // Save button should be enabled
    const saveBtn = page.getByTestId('iceberg-save-btn');
    await expect(saveBtn).toBeEnabled();

    // Click save
    await saveBtn.click();

    // Snackbar with success message should appear
    await expect(page.getByText('分析を保存しました')).toBeVisible({ timeout: 10_000 });
  });
});
