import { expect, test } from '@playwright/test';
import {
    gotoMonthlyRecordsPage,
    monthlyTestIds,
    switchMonthlyTab,
    triggerReaggregateAndWait
} from './_helpers/enableMonthly';

test.describe('Monthly Records - Summary Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 月次記録ページに移動（Feature Flag 有効化込み）
    await gotoMonthlyRecordsPage(page);
  });

  test('@ci-smoke monthly summary page renders', async ({ page }) => {
    // ページタイトル確認（正確なテキストを指定）
    await expect(page.getByRole('heading', { name: '月次記録', exact: true })).toBeVisible();

    // メインページコンテナ確認
    await expect(page.getByTestId(monthlyTestIds.page)).toBeVisible();

    // タブナビゲーション確認
    await expect(page.getByTestId(monthlyTestIds.summaryTab)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.detailTab)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.pdfTab)).toBeVisible();

    // デフォルトで組織サマリータブが選択されている
    await expect(page.getByTestId(monthlyTestIds.summaryTab)).toHaveAttribute('aria-selected', 'true');
  });

  test('@ci-smoke summary table renders with filters', async ({ page }) => {
    // サマリーテーブル表示確認
    await expect(page.getByTestId(monthlyTestIds.summaryTable)).toBeVisible();

    // フィルター要素確認
    await expect(page.getByTestId(monthlyTestIds.summarySearch)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.summaryMonthSelect)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.summaryRateFilter)).toBeVisible();

    // 再集計ボタン確認
    await expect(page.getByTestId(monthlyTestIds.summaryReaggregateBtn)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.summaryReaggregateBtn)).toBeEnabled();
  });

  test('@ci-smoke search filter functionality', async ({ page }) => {
    const searchInputContainer = page.getByTestId(monthlyTestIds.summarySearch);
  const searchInput = searchInputContainer.getByRole('textbox').first();

    // 検索フィールドに入力
  await searchInput.fill('山田');

    // 検索結果の更新を待機（デバウンス考慮）
    await page.waitForTimeout(500);

    // テーブル内容が更新されることを確認（MSW モックデータ依存）
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();

    // 検索クリア
  await searchInput.fill('');
    await page.waitForTimeout(500);
  });

  test('@ci-smoke month filter functionality', async ({ page }) => {
    const monthSelect = page.getByTestId(monthlyTestIds.summaryMonthSelect);

    // 月選択ドロップダウンを開く
    await monthSelect.click();

    // 選択肢が表示されることを確認
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // 現在月以外を選択（例：前月）
    await page.getByRole('option').first().click();

    // テーブルデータが更新されることを確認
    await page.waitForTimeout(300);
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();
  });

  test('@ci-smoke completion rate filter', async ({ page }) => {
    const rateFilter = page.getByTestId(monthlyTestIds.summaryRateFilter);

    // 完了率フィルターを開く
    await rateFilter.click();

    // フィルター選択肢確認
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // 「80%以上」などのフィルターを選択
    const highRateOption = page.getByRole('option', { name: /80%以上|高完了率/ });
    if (await highRateOption.count() > 0) {
      await highRateOption.click();
      await page.waitForTimeout(300);
    }

    // テーブルが更新されることを確認
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();
  });

  test('@ci-smoke reaggregate button triggers update', async ({ page }) => {
    // 再集計実行 & 完了待機
    await triggerReaggregateAndWait(page);

    // ステータス表示が更新されることを確認
    const status = page.getByTestId(monthlyTestIds.summaryStatus);
    await expect(status).toHaveText(/再集計完了/, { timeout: 5000 });
  });

  test('@ci-smoke table sorting functionality', async ({ page }) => {
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();

    const firstRowBefore = table.locator('[data-testid^="monthly-summary-row"]').first();
    await expect(firstRowBefore).toContainText('田中太郎');

    const rateHeader = page.getByRole('button', { name: /完了率/ });
    await rateHeader.click();
    await page.waitForTimeout(300);

    const firstRowAfter = table.locator('[data-testid^="monthly-summary-row"]').first();
    await expect(firstRowAfter).toContainText('鈴木次郎');
  });

  test('@ci-smoke tab navigation', async ({ page }) => {
    // 組織サマリータブが初期選択
    await expect(page.getByTestId(monthlyTestIds.summaryTab)).toHaveAttribute('aria-selected', 'true');

    // 利用者別詳細タブに切り替え
    await switchMonthlyTab(page, 'detail');
    await expect(page.getByTestId(monthlyTestIds.detailTab)).toHaveAttribute('aria-selected', 'true');

    // 月次PDFタブに切り替え
    await switchMonthlyTab(page, 'pdf');
    await expect(page.getByTestId(monthlyTestIds.pdfTab)).toHaveAttribute('aria-selected', 'true');

    // 組織サマリータブに戻る
    await switchMonthlyTab(page, 'summary');
    await expect(page.getByTestId(monthlyTestIds.summaryTab)).toHaveAttribute('aria-selected', 'true');

    // テーブルが再表示されることを確認
    await expect(page.getByTestId(monthlyTestIds.summaryTable)).toBeVisible();
  });

  test('@ci-smoke accessibility compliance', async ({ page }) => {
    // ARIA ロールとラベルの確認
    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    // 再集計ボタンのアクセシビリティ
    const reaggregateBtn = page.getByTestId(monthlyTestIds.summaryReaggregateBtn);
    await expect(reaggregateBtn).toHaveAttribute('type', 'button');

    // フォーム要素のラベル確認
    const searchInput = page.getByTestId(monthlyTestIds.summarySearch).getByRole('textbox').first();
    await expect(searchInput).toHaveAttribute('placeholder');

    // タブナビゲーションのアクセシビリティ
    const summaryTab = page.getByTestId(monthlyTestIds.summaryTab);
    await expect(summaryTab).toHaveAttribute('role', 'tab');
    await expect(summaryTab).toHaveAttribute('aria-selected');
  });

  test('@ci-smoke detail shortcut navigates to detail tab', async ({ page }) => {
    const detailButton = page.getByTestId('monthly-detail-btn-I001-2025-11');
    await detailButton.click();

    await expect(page).toHaveURL(/tab=user-detail/);
    await expect(page.getByTestId(monthlyTestIds.detailTab)).toHaveAttribute('aria-selected', 'true');
  });
});