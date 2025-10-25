// tests/e2e/support-procedures.e2e.ts
// Playwright E2E test for /records/support-procedures using data-testid conventions
import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testing/testids';

test.describe('支援手順兼記録画面 E2E', () => {
  test('フォーム表示・記録保存・トースト表示', async ({ page }) => {
    await page.goto('/records/support-procedures');
  await expect(page.getByTestId(TESTIDS.supportProcedures.form.root)).toBeVisible();
  await expect(page.getByTestId(TESTIDS.supportProcedures.table.root)).toBeVisible();
  // 1行目の編集
  // ここはrow(id)関数式で取得するのが推奨ですが、現状はrootのみ
  // const firstRow = page.getByTestId(TESTIDS.supportProcedures.table.row(1)).first();
  // await firstRow.click();
  // 入力例: 本人のやること
  // await firstRow.getByRole('textbox', { name: /本人/ }).fill('テスト本人TODO');
  // 入力例: 職員のやること
  // await firstRow.getByRole('textbox', { name: /職員/ }).fill('テスト職員TODO');
  // 保存ボタン
  await page.getByTestId(TESTIDS.supportProcedures.form.save).click();
  // 成功トースト
  await expect(page.getByTestId(TESTIDS.supportProcedures.toast.root)).toBeVisible();
  // 成功アイコン・メッセージ
  // await expect(page.getByTestId(TESTIDS.supportProcedures.toast.success)).toBeVisible();
  // await expect(page.getByTestId(TESTIDS.supportProcedures.toast.message)).toContainText('保存');
  });
});
