import { expect, test } from '@playwright/test';
import { gotoMonthlyRecordsPage, monthlyTestIds, switchMonthlyTab } from './_helpers/enableMonthly';
import { selectFirstMuiOption } from './utils/muiSelect';

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

  test('@ci-smoke user-detail renders selects and effective params', async ({ page }) => {
    await expect(page.getByTestId('monthly-user-detail-mounted')).toBeVisible();
    const params = page.getByTestId('monthly-user-detail-effective-params');
    await expect(params).toContainText('user=I001');
    await expect(params).toContainText('month=2025-11');

    await expect(page.getByTestId(monthlyTestIds.detailUserSelect)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.detailMonthSelect)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();
  });

  test('smoke: month select works', async ({ page }) => {
    const monthSelect = page.getByTestId(monthlyTestIds.detailMonthSelect);

    await selectFirstMuiOption(page, monthSelect);

    await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();
  });

  test('smoke: detail records table structure', async ({ page }) => {
    const table = page.getByTestId(monthlyTestIds.detailRecordsTable);
    await expect(table).toBeVisible();

    const headers = table.getByRole('columnheader');
    await expect(headers).toHaveCount(2);

    const rows = await table.getByRole('row').count();
    expect(rows).toBeGreaterThan(1); // header + at least one data row
  });

  test('smoke: KPI display', async ({ page }) => {
    await expect(page.getByTestId(monthlyTestIds.detailKpiRoot)).toBeVisible();
  });

  test('smoke: navigation from summary', async ({ page }) => {
    await switchMonthlyTab(page, 'summary');

    const summaryTable = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(summaryTable).toBeVisible();

    const firstRow = summaryTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    const detailBtn = firstRow.getByRole('button', { name: /詳細|表示|開く/ });
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();

    await expect(page).toHaveURL(/tab=user-detail/);
    await expect(page).toHaveURL(/user=/);
    await expect(page).toHaveURL(/month=/);

    await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();
  });
});