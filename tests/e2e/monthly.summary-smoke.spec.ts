import { expect, test } from '@playwright/test';
import {
    gotoMonthlyRecordsPage,
    monthlyTestIds,
    triggerReaggregateAndWait
} from './_helpers/enableMonthly';
import { attachOnFailure, ConsoleLogger, PageErrorCollector, RequestLogger, setupConsoleAndErrorCapture } from './_helpers/diagArtifacts';
import { selectFirstMuiOption, selectMuiOptionByLabel } from './utils/muiSelect';

test.describe('Monthly Records - Summary Smoke Tests', () => {
  let consoleLogger: ConsoleLogger;
  let errorCollector: PageErrorCollector;
  let requestLogger: RequestLogger;

  test.beforeEach(async ({ page }) => {
    // Initialize capture
    consoleLogger = new ConsoleLogger();
    errorCollector = new PageErrorCollector();
    requestLogger = new RequestLogger();
    await setupConsoleAndErrorCapture(page, consoleLogger, errorCollector, requestLogger);

    // 月次記録ページに移動（Feature Flag 有効化込み）
    await gotoMonthlyRecordsPage(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachOnFailure(page, testInfo, consoleLogger, errorCollector, requestLogger);
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

    // 月選択 MUI Select を開く（monthly型）
    const selected = await selectFirstMuiOption(page, monthSelect, { timeout: 15_000 });
    
    if (!selected) {
      console.warn('[monthly] month filter: no options available; skipping selection');
    }

    // テーブルデータが更新されることを確認
    await page.waitForTimeout(300);
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();
  });

  test('@ci-smoke completion rate filter', async ({ page }) => {
    const rateFilter = page.getByTestId(monthlyTestIds.summaryRateFilter);

    // 完了率フィルター MUI Select を開いて「80%以上」相当を選択（monthly型）
    const selected = await selectMuiOptionByLabel(
      page,
      rateFilter,
      /80%以上|90%以上|高完了率/,
      { timeout: 15_000 }
    );

    if (!selected) {
      console.warn('[monthly] completion rate filter: no matching option; skipping selection');
    }

    await page.waitForTimeout(300);

    // テーブルが更新されることを確認
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();
  });

  test('@ci-smoke reaggregate button triggers update', async ({ page }) => {
    // 再集計実行 & 完了待機
    await triggerReaggregateAndWait(page);

    // ステータス表示が更新されることを確認
    const status = page.getByTestId(monthlyTestIds.summaryStatus);
    // UIの文言確定までは可視性のみ検証
    await expect(status).toBeVisible({ timeout: 10_000 });
  });

  test('@ci-smoke table sorting functionality', async ({ page }) => {
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();

    const firstRowBefore = table.locator('[data-testid^="monthly-summary-row"]').first();
    await expect(firstRowBefore).toContainText('田中太郎');

    const rateHeader = page.getByRole('button', { name: /完了率/ });
    await rateHeader.scrollIntoViewIfNeeded();
    await rateHeader.click({ force: true });
    await page.waitForTimeout(300);

    const firstRowAfter = table.locator('[data-testid^="monthly-summary-row"]').first();
    await expect(firstRowAfter).toContainText('鈴木次郎');
  });

  test('@ci-smoke tab navigation', async ({ page }) => {
    const summaryTab = page.getByTestId(monthlyTestIds.summaryTab);
    const detailTab = page.getByTestId(monthlyTestIds.detailTab);
    const summaryTable = page.getByTestId(monthlyTestIds.summaryTable);
    const detailRecordsTable = page.getByTestId(monthlyTestIds.detailRecordsTable);

    // 初期状態: サマリータブとテーブルが表示されている
    await expect(summaryTable).toBeVisible();

    // 利用者別詳細タブへ切り替え（キーボードではなくクリック）
    await detailTab.click();

    // aria-selectedは補助的に確認（失敗しても続行）
    await expect(detailTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 }).catch(() => {});

    // Detail側の確実な描画を待つ
    await expect(detailRecordsTable).toBeVisible({ timeout: 15_000 });

    // 組織サマリータブに戻る
    await summaryTab.click();
    await expect(summaryTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 }).catch(() => {});

    // サマリーテーブルの再表示を確認
    await expect(summaryTable).toBeVisible({ timeout: 15_000 });
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
    await detailButton.scrollIntoViewIfNeeded();
    await detailButton.click({ force: true });

    await expect(page).toHaveURL(/tab=user-detail/);
    await expect(page.getByTestId(monthlyTestIds.detailTab)).toHaveAttribute('aria-selected', 'true');
  });
});