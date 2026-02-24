import { expect, test } from '@playwright/test';

import { bootstrapDashboard } from './utils/bootstrapApp';

test.describe('Iceberg Analysis', () => {
  test('loads page, selects user, sees nodes, and saves manually', async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      initialPath: '/analysis/iceberg',
    });

    // Page title should be visible
    await expect(page.getByText('Iceberg Workspace')).toBeVisible({ timeout: 10_000 });

    // Select a user from the dropdown
    const userSelect = page.getByLabel('分析対象');
    await userSelect.click();

    // Pick the first user
    const firstOption = page.getByRole('option').first();
    await firstOption.click();

    // Demo nodes should appear
    await expect(page.getByText('他害(叩く)')).toBeVisible({ timeout: 5_000 });

    // Status should be visible
    const statusChip = page.getByTestId('iceberg-save-status');
    await expect(statusChip).toBeVisible();

    // Click manual save
    const saveBtn = page.getByTestId('iceberg-save-btn');
    await saveBtn.click();

    // Chip should show saved status
    await expect(statusChip).toContainText('保存済み', { timeout: 10_000 });
  });

  test('auto-saves after change', async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      initialPath: '/analysis/iceberg',
    });

    // Select user
    const userSelect = page.getByLabel('分析対象');
    await userSelect.click();
    await page.getByRole('option').first().click();

    // Wait for demo nodes
    const node = page.getByText('他害(叩く)');
    await expect(node).toBeVisible();

    // Wait for initial auto-save to complete
    const statusChip = page.getByTestId('iceberg-save-status');
    await expect(statusChip).toContainText('保存済み', { timeout: 10_000 });

    // Simulate a change by clicking "仮説リンク" which modifies the session
    await page.getByText('仮説リンク (Demo)').click();

    // Observe auto-save transition
    // Saving status appears after 600ms debounce
    await expect(statusChip).toContainText('保存中', { timeout: 2000 });
    await expect(statusChip).toContainText('保存済み', { timeout: 10_000 });
  });
});
