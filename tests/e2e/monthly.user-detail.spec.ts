import { expect, test, type Page } from '@playwright/test';
import {
    gotoMonthlyRecordsPage,
    monthlyTestIds,
    switchMonthlyTab
} from './_helpers/enableMonthly';

const userSelectTrigger = (page: Page) =>
  page.getByTestId(monthlyTestIds.detailUserSelect).locator('[role="combobox"], button, [role="button"]').first();

const monthSelectTrigger = (page: Page) =>
  page.getByTestId(monthlyTestIds.detailMonthSelect).locator('[role="combobox"], button, [role="button"]').first();

test.describe('Monthly Records - User Detail Tests', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMonthlyRecordsPage(page);
    // 利用者別詳細タブに切り替え
    await switchMonthlyTab(page, 'detail');
  });

  test('@ci-smoke user detail tab renders', async ({ page }) => {
    // 詳細タブが選択されている
    await expect(page.getByTestId(monthlyTestIds.detailTab)).toHaveAttribute('aria-selected', 'true');

    // 利用者選択ドロップダウン確認
  await expect(userSelectTrigger(page)).toBeVisible();

    // 月選択ドロップダウン確認
  await expect(monthSelectTrigger(page)).toBeVisible();

    // 詳細記録テーブル確認
    await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();
  });

  test('@ci-smoke user selection functionality', async ({ page }) => {
  const userSelect = userSelectTrigger(page);

    // ユーザー選択ドロップダウンを開く
    await userSelect.click();

    // 選択肢が表示される
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // 最初のユーザーを選択
    const firstUser = page.getByRole('option').first();
    await expect(firstUser).toBeVisible();
    await firstUser.click();

    // テーブルが更新される
    await page.waitForTimeout(500);
    const detailTable = page.getByTestId(monthlyTestIds.detailRecordsTable);
    await expect(detailTable).toBeVisible();
  });

  test('@ci-smoke month selection for user detail', async ({ page }) => {
  const monthSelect = monthSelectTrigger(page);

    // 月選択ドロップダウンを開く
    await monthSelect.click();

    // 選択肢が表示される
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // 異なる月を選択
    const monthOption = page.getByRole('option').nth(1);
    if (await monthOption.count() > 0) {
      await monthOption.click();
      await page.waitForTimeout(500);
    }

    // 詳細テーブルが更新される
    const detailTable = page.getByTestId(monthlyTestIds.detailRecordsTable);
    await expect(detailTable).toBeVisible();
  });

  test('@ci-smoke detail records table structure', async ({ page }) => {
    // まずユーザーを選択
  const userSelect = userSelectTrigger(page);
    await userSelect.click();
    const firstUser = page.getByRole('option').first();
    if (await firstUser.count() > 0) {
      await firstUser.click();
      await page.waitForTimeout(500);
    }

    const detailTable = page.getByTestId(monthlyTestIds.detailRecordsTable);
    await expect(detailTable).toBeVisible();

    // テーブルヘッダーの確認
    await expect(page.getByRole('columnheader', { name: /記録日|日付/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /完了状況|ステータス/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /特記事項/ })).toBeVisible();

    // テーブルがアクセシブル
    await expect(detailTable).toHaveAttribute('role', 'table');
  });

  test('@ci-smoke user detail KPI display', async ({ page }) => {
    // ユーザーを選択
  const userSelect = userSelectTrigger(page);
    await userSelect.click();
    const firstUser = page.getByRole('option').first();
    if (await firstUser.count() > 0) {
      await firstUser.click();
      await page.waitForTimeout(500);
    }

    // KPI 統計カードの表示確認
    await expect(page.getByText(/完了率/)).toBeVisible();
    await expect(page.getByText(/完了行数/)).toBeVisible();
    await expect(page.getByText(/対象日数/)).toBeVisible();

    // 数値が表示されている
    await expect(page.locator('text=/\\d+%/')).toBeVisible(); // 完了率（％）
    await expect(page.locator('text=/\\d+\\/\\d+/')).toBeVisible(); // 完了行数/予定行数
  });

  test('@ci-smoke navigation from summary to detail', async ({ page }) => {
    // 組織サマリータブに切り替え
    await switchMonthlyTab(page, 'summary');

    const summaryTable = page.getByTestId(monthlyTestIds.summaryTable);
    await expect(summaryTable).toBeVisible();

    // サマリーテーブルの行をクリック（最初の行）
    const firstRow = summaryTable.locator('tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      // 詳細タブに自動切り替えされる
      await expect(page.getByTestId(monthlyTestIds.detailTab)).toHaveAttribute('aria-selected', 'true');

      // ユーザーが自動選択される
  await expect(userSelectTrigger(page)).toBeVisible();

      // 詳細テーブルが表示される
      await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();
    }
  });

  test('@ci-smoke detail table data validation', async ({ page }) => {
    // ユーザーを選択
  const userSelect = userSelectTrigger(page);
    await userSelect.click();
    const firstUser = page.getByRole('option').first();
    if (await firstUser.count() > 0) {
      await firstUser.click();
      await page.waitForTimeout(500);
    }

    const detailTable = page.getByTestId(monthlyTestIds.detailRecordsTable);
    const rows = detailTable.locator('tbody tr');

    if (await rows.count() > 0) {
      const firstRow = rows.first();

      // 日付形式の確認（YYYY-MM-DD）
      await expect(firstRow.locator('td').first()).toContainText(/\d{4}-\d{2}-\d{2}/);

      // ステータス表示の確認
      const statusCell = firstRow.locator('td').nth(1);
      await expect(statusCell).toContainText(/(完了|進行中|未入力|空)/);

      // 特記事項セルの確認
      const notesCell = firstRow.locator('td').nth(2);
      await expect(notesCell).toBeVisible();
    }
  });

  test('@ci-smoke empty state handling', async ({ page }) => {
    // データのないユーザー/月を選択してもエラーにならない
  const monthSelect = monthSelectTrigger(page);

    // 未来の月を選択（データが存在しない可能性が高い）
    await monthSelect.click();
    const futureMonth = page.getByRole('option', { name: /2025|未来/ }).first();
    if (await futureMonth.count() > 0) {
      await futureMonth.click();
      await page.waitForTimeout(500);
    }

    // エラーメッセージまたは空状態メッセージの確認
    const detailTable = page.getByTestId(monthlyTestIds.detailRecordsTable);
    await expect(detailTable).toBeVisible();

    // 「データがありません」などのメッセージが表示される
    await expect(page.getByText(/(データがありません|記録が見つかりません|No data)/i)).toBeVisible();
  });

  test('@ci-smoke responsive layout check', async ({ page }) => {
    // モバイルサイズに変更
    await page.setViewportSize({ width: 375, height: 667 });

    // 詳細タブの要素が適切に表示される
  await expect(userSelectTrigger(page)).toBeVisible();
  await expect(monthSelectTrigger(page)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();

    // タブレットサイズに変更
    await page.setViewportSize({ width: 768, height: 1024 });

    // レイアウトが崩れていないことを確認
    await expect(page.getByTestId(monthlyTestIds.detailRecordsTable)).toBeVisible();

    // デスクトップサイズに戻す
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('@ci-smoke keyboard navigation', async ({ page }) => {
    // ユーザー選択ドロップダウンにフォーカス
  await userSelectTrigger(page).focus();

    // Enterキーで開く
    await page.keyboard.press('Enter');
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // 矢印キーで選択
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // 選択が完了する
    await page.waitForTimeout(500);

    // 月選択にTabで移動
    await page.keyboard.press('Tab');
  const monthSelect = monthSelectTrigger(page);
    await expect(monthSelect).toBeFocused();
  });
});