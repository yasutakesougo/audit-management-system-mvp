import { expect, test } from '@playwright/test';
import {
    gotoMonthlyRecordsPage,
    monthlyTestIds,
    switchMonthlyTab
} from './_helpers/enableMonthly';

test.describe('Monthly Records - PDF Tab Tests', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMonthlyRecordsPage(page);
    // 月次PDFタブに切り替え
    await switchMonthlyTab(page, 'pdf');
  });

  test('@ci-smoke pdf tab renders', async ({ page }) => {
    // PDFタブが選択されている
    await expect(page.getByTestId(monthlyTestIds.pdfTab)).toHaveAttribute('aria-selected', 'true');

    // PDF生成ボタン確認
    await expect(page.getByTestId(monthlyTestIds.pdfGenerateBtn)).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.pdfGenerateBtn)).toBeEnabled();

    // PDFタブの説明文確認
    await expect(page.getByText(/月次レポート|PDF|帳票/i)).toBeVisible();
  });

  test('@ci-smoke pdf generation settings', async ({ page }) => {
    // 期間選択フィールドの確認
    await expect(page.getByLabel(/対象年月|期間/i)).toBeVisible();

    // 出力形式選択（もしあれば）
    const formatSelect = page.locator('select[name*="format"], [data-testid*="format"]');
    if (await formatSelect.count() > 0) {
      await expect(formatSelect).toBeVisible();
    }

    // 対象部署選択（もしあれば）
    const departmentSelect = page.locator('select[name*="department"], [data-testid*="department"]');
    if (await departmentSelect.count() > 0) {
      await expect(departmentSelect).toBeVisible();
    }
  });

  test('@ci-smoke pdf generation button interaction', async ({ page }) => {
    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);

    // ボタンクリック前の状態確認
    await expect(pdfBtn).toBeEnabled();
    await expect(pdfBtn).toContainText(/(生成|作成|出力|ダウンロード)/i);

    // ダウンロードイベントをリッスン（MSWモック環境）
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

    // PDF生成ボタンクリック
    await pdfBtn.click();

    // ローディング状態の確認
    await expect(pdfBtn).toContainText(/(生成中|処理中|作成中)/i);
    await expect(pdfBtn).toBeDisabled();

    try {
      // ダウンロード完了を待機
      const download = await downloadPromise;

      // ファイル名確認
      expect(download.suggestedFilename()).toMatch(/monthly.*\.pdf$/i);

      // ボタンが元の状態に戻る
      await expect(pdfBtn).toBeEnabled();
      await expect(pdfBtn).toContainText(/(生成|作成|出力|ダウンロード)/i);

    } catch {
      // MSW環境でダウンロードが発生しない場合
      console.log('Download not triggered in MSW environment');

      // 代わりに成功通知を確認
      const successAlert = page.locator('[role="alert"]');
      await expect(successAlert).toBeVisible({ timeout: 5000 });
      await expect(successAlert).toContainText(/(生成完了|ダウンロード|準備完了)/i);
    }
  });

  test('@ci-smoke pdf generation progress feedback', async ({ page }) => {
    // MSWモックでPDF生成APIをシミュレート
    await page.route('**/api/monthly-records/pdf**', async (route) => {
      // 遅延を追加してローディング状態をテスト
      await page.waitForTimeout(1000);

      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition': 'attachment; filename="monthly-report-2024-11.pdf"'
        },
        body: Buffer.from('%PDF-1.4 Mock PDF Content')
      });
    });

    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);
    await pdfBtn.click();

    // プログレスインジケーター確認
    await expect(page.locator('[role="progressbar"], .loading, .spinner')).toBeVisible();

    // ローディングメッセージ確認
    await expect(page.getByText(/(生成中|処理中|お待ちください)/i)).toBeVisible();

    // 完了後の状態確認
    await expect(pdfBtn).toBeEnabled({ timeout: 10000 });
  });

  test('@ci-smoke pdf generation error handling', async ({ page }) => {
    // MSWモックでエラーレスポンスをシミュレート
    await page.route('**/api/monthly-records/pdf**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'PDF generation failed',
          message: 'サーバーエラーが発生しました'
        })
      });
    });

    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);
    await pdfBtn.click();

    // エラーアラートの確認
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText(/(エラー|失敗|問題)/i);

    // ボタンが再度有効になる
    await expect(pdfBtn).toBeEnabled();
    await expect(pdfBtn).toContainText(/(再試行|生成|作成)/i);
  });

  test('@ci-smoke pdf tab content validation', async ({ page }) => {
    // PDFタブ内のコンテンツ確認
    await expect(page.getByText(/月次記録レポート|Monthly Report/i)).toBeVisible();

    // 生成オプションの説明
    await expect(page.getByText(/(対象月|出力形式|レポート設定)/i)).toBeVisible();

    // プレビュー情報（もしあれば）
    const previewInfo = page.locator('[data-testid*="preview"], .preview');
    if (await previewInfo.count() > 0) {
      await expect(previewInfo).toBeVisible();
    }

    // 注意事項やヘルプテキスト
    await expect(page.getByText(/(注意|ヘルプ|について)/i)).toBeVisible();
  });

  test('@ci-smoke pdf generation accessibility', async ({ page }) => {
    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);

    // ボタンのアクセシビリティ属性確認
    await expect(pdfBtn).toHaveAttribute('type', 'button');
    await expect(pdfBtn).toHaveAttribute('aria-label');

    // キーボードナビゲーション確認
    await pdfBtn.focus();
    await expect(pdfBtn).toBeFocused();

    // Enterキーでの操作
    await page.keyboard.press('Enter');

    // ローディング状態のアクセシビリティ
    await expect(pdfBtn).toHaveAttribute('aria-busy', 'true');
  });

  test('@ci-smoke pdf settings persistence', async ({ page }) => {
    // 期間設定を変更
    const monthInput = page.getByLabel(/対象年月|期間/i);
    if (await monthInput.count() > 0) {
      await monthInput.fill('2024-10');
    }

    // 他のタブに移動
    await switchMonthlyTab(page, 'summary');
    await page.waitForTimeout(300);

    // PDFタブに戻る
    await switchMonthlyTab(page, 'pdf');

    // 設定が保持されていることを確認
    if (await monthInput.count() > 0) {
      await expect(monthInput).toHaveValue('2024-10');
    }
  });

  test('@ci-smoke pdf generation with different parameters', async ({ page }) => {
    // 複数の設定パターンでPDF生成をテスト
    const testCases = [
      { month: '2024-11', description: '当月レポート' },
      { month: '2024-10', description: '前月レポート' },
    ];

    for (const testCase of testCases) {
      // 期間を設定
      const monthInput = page.getByLabel(/対象年月|期間/i);
      if (await monthInput.count() > 0) {
        await monthInput.fill(testCase.month);
      }

      // PDF生成ボタンクリック
      const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);
      await pdfBtn.click();

      // 処理完了まで待機
      await expect(pdfBtn).toBeEnabled({ timeout: 5000 });

      // 成功通知またはダウンロード確認
      const alert = page.locator('[role="alert"]');
      if (await alert.count() > 0) {
        await expect(alert).toContainText(/(完了|成功|ダウンロード)/i);
      }

      // 次のテストのために少し待機
      await page.waitForTimeout(500);
    }
  });

  test('@ci-smoke pdf generation mobile compatibility', async ({ page }) => {
    // モバイルサイズに変更
    await page.setViewportSize({ width: 375, height: 667 });

    // PDFタブが適切に表示される
    await expect(page.getByTestId(monthlyTestIds.pdfGenerateBtn)).toBeVisible();

    // ボタンが適切なサイズで表示される
    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);
    const boundingBox = await pdfBtn.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThan(40); // モバイルで十分なタップターゲット
    }

    // タップでPDF生成が動作する
    await pdfBtn.tap();
    await expect(pdfBtn).toContainText(/(生成中|処理中)/i);

    // デスクトップサイズに戻す
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});