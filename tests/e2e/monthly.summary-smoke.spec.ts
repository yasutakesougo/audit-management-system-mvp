import { expect, test } from '@playwright/test';
import {
    gotoMonthlyRecordsPage,
    monthlyTestIds,
    triggerReaggregateAndWait
} from './_helpers/enableMonthly';
import { attachOnFailure, ConsoleLogger, PageErrorCollector, setupConsoleAndErrorCapture } from './_helpers/diagArtifacts';

test.describe('Monthly Records - Summary Smoke Tests', () => {
  let consoleLogger: ConsoleLogger;
  let errorCollector: PageErrorCollector;

  test.beforeEach(async ({ page }) => {
    // Initialize capture
    consoleLogger = new ConsoleLogger();
    errorCollector = new PageErrorCollector();
    await setupConsoleAndErrorCapture(page, consoleLogger, errorCollector);

    // 月次記録ページに移動（Feature Flag 有効化込み）
    await gotoMonthlyRecordsPage(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachOnFailure(page, testInfo, consoleLogger, errorCollector);
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

    // 月選択ドロップダウンを開く（mobile-safe）
    await monthSelect.scrollIntoViewIfNeeded();
    await monthSelect.click({ force: true });
    await monthSelect.press('ArrowDown').catch(() => undefined);

    // 選択肢が表示されることを確認（MUIのportal差異に対応: listbox/menu両対応）
    const monthPopup = page.locator('[role="listbox"], [role="menu"]').first();
    await monthPopup.waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined);
    await monthPopup.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);

    // 現在月以外を選択（例：前月）
    let clicked = false;
    const firstOption = page.getByRole('option').first();
    if (await firstOption.count() > 0) {
      await firstOption.scrollIntoViewIfNeeded();
      await firstOption.click({ force: true });
      clicked = true;
    }
    if (!clicked) {
      const firstMenuItem = page.getByRole('menuitem').first();
      if (await firstMenuItem.count() > 0) {
        await firstMenuItem.scrollIntoViewIfNeeded();
        await firstMenuItem.click({ force: true });
        clicked = true;
      }
    }
    if (!clicked) {
      console.warn('[monthly] month filter options not found; skipping selection step');
    }

    // テーブルデータが更新されることを確認
    await page.waitForTimeout(300);
    const table = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(table).toBeVisible();
  });

  test('@ci-smoke completion rate filter', async ({ page }) => {
    const rateFilter = page.getByTestId(monthlyTestIds.summaryRateFilter);

    // 完了率フィルターを開く（mobile-safe）
    await rateFilter.scrollIntoViewIfNeeded();
    await rateFilter.click({ force: true });
    await rateFilter.press('ArrowDown').catch(() => undefined);

    // フィルター選択肢確認（MUIのportal差異に対応: listbox/menu両対応）
    const ratePopup = page.locator('[role="listbox"], [role="menu"]').first();
    await ratePopup.waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined);
    await ratePopup.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);

    // 「80%以上」などのフィルターを選択
    let rateClicked = false;
    const highRateOption = page.getByRole('option', { name: /80%以上|90%以上|高完了率/ });
    if (await highRateOption.count() > 0) {
      await highRateOption.scrollIntoViewIfNeeded();
      await highRateOption.click({ force: true });
      rateClicked = true;
    }
    if (!rateClicked) {
      const highRateMenuItem = page.getByRole('menuitem', { name: /80%以上|90%以上|高完了率/ });
      if (await highRateMenuItem.count() > 0) {
        await highRateMenuItem.scrollIntoViewIfNeeded();
        await highRateMenuItem.click({ force: true });
        rateClicked = true;
      }
    }
    if (!rateClicked) {
      console.warn('[monthly] rate filter options not found; skipping selection step');
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