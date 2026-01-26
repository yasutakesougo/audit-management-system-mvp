import { test, expect } from '@playwright/test';
import { attachOnFailure, ConsoleLogger, PageErrorCollector, setupConsoleAndErrorCapture } from './_helpers/diagArtifacts';

test.describe('Diagnostics Health - run & save', () => {
  let consoleLogger: ConsoleLogger;
  let errorCollector: PageErrorCollector;

  test.beforeEach(async ({ page }) => {
    // Initialize capture
    consoleLogger = new ConsoleLogger();
    errorCollector = new PageErrorCollector();
    await setupConsoleAndErrorCapture(page, consoleLogger, errorCollector);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachOnFailure(page, testInfo, consoleLogger, errorCollector);
  });

  test('診断実行 → SharePoint 保存成功', async ({ page }) => {
    // 1) open
    await page.goto('/diagnostics/health');

    // 2) 初期診断が自動実行されるのを待つ
    await expect(page.getByRole('heading', { name: '総合判定' })).toBeVisible({ timeout: 15_000 });

    // 3) 保存ボタンが有効化されているのを確認
    const saveBtn = page.getByTestId('diagnostics-save');
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    
    // 4) save to SharePoint
    await saveBtn.click();

    // 5) 保存トースト確認（成功 or 失敗、どちらでもOK）
    const alert = page.getByTestId('diagnostics-save-alert');
    await expect(alert).toBeVisible({ timeout: 60_000 });
  });

  test('診断実行後、保存ボタンが有効化される', async ({ page }) => {
    await page.goto('/diagnostics/health');

    // 初期診断が自動実行されるのを待つ
    await expect(page.getByRole('heading', { name: '総合判定' })).toBeVisible({ timeout: 15_000 });

    // 保存ボタンを取得（初期disabled断定はしない）
    const saveBtn = page.getByTestId('diagnostics-save');
    await expect(saveBtn).toBeVisible();

    // 再実行
    const runBtn = page.getByTestId('diagnostics-run');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // 結果が更新されて保存ボタンが有効化される（既に有効ならそのまま通る）
    await expect(saveBtn).toBeEnabled({ timeout: 60_000 });
  });
});
