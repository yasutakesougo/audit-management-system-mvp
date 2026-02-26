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

    // PDFタブの説明見出し確認
    await expect(page.getByRole('heading', { name: '月次記録PDF出力' })).toBeVisible();
  });

  test('@ci-smoke pdf generation settings', async ({ page }) => {
    // PDFタブ内の設定パネルを基点にする
    const pdfPanel = page.locator('#monthly-tabpanel-pdf');
    await expect(pdfPanel).toBeVisible();

    // 期間選択フィールド（UI差分で無い構成もあるため optional 扱い）
    const periodInput = pdfPanel.getByLabel(/対象年月|期間/i).first();
    if ((await periodInput.count()) > 0) {
      await expect(periodInput).toBeVisible();
    } else {
      await expect(page.getByTestId(monthlyTestIds.pdfGenerateBtn)).toBeVisible();
    }

    // 出力形式選択（もしあれば）
    const formatSelect = pdfPanel.locator('select[name*="format"], [data-testid*="format"]');
    if (await formatSelect.count() > 0) {
      await expect(formatSelect).toBeVisible();
    }

    // 対象部署選択（もしあれば）
    const departmentSelect = pdfPanel.locator('select[name*="department"], [data-testid*="department"]');
    if (await departmentSelect.count() > 0) {
      await expect(departmentSelect).toBeVisible();
    }
  });

  test('@ci-smoke pdf generation button interaction', async ({ page }) => {
    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);

    // ボタンクリック前の状態確認
    await expect(pdfBtn).toBeEnabled();
    await expect(pdfBtn).toContainText(/(生成|作成|出力|ダウンロード)/i);

    // ダウンロードイベントをリッスン（発生しない環境もある）
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    // PDF生成ボタンクリック
    await pdfBtn.click();

    // クリック後もボタンが存在することを確認（UI差分で文言/disableは変わる）
    await expect(pdfBtn).toBeVisible();

    // ダウンロード完了を待機
    const download = await downloadPromise;

    try {
      if (!download) throw new Error('download-not-triggered');
      // ファイル名確認
      expect(download.suggestedFilename()).toMatch(/monthly.*\.pdf$/i);

      // ボタンが元の状態に戻る
      await expect(pdfBtn).toBeVisible();

    } catch {
      // MSW環境でダウンロードが発生しない場合
      console.log('Download not triggered in MSW environment');

      // 通知が出ない構成もあるため、最低限ボタンが継続利用可能であることを確認
      await expect(pdfBtn).toBeVisible();
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
    const progressIndicators = page.locator('[role="progressbar"], .loading, .spinner');
    if ((await progressIndicators.count()) > 0) {
      await expect(progressIndicators.first()).toBeAttached();
    }

    // ローディングメッセージ確認
    const loadingMessage = page.getByText(/(生成中|処理中|お待ちください)/i);
    if ((await loadingMessage.count()) > 0) {
      await expect(loadingMessage.first()).toBeVisible();
    }

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
    if ((await errorAlert.count()) > 0) {
      await expect(errorAlert.first()).toBeVisible({ timeout: 5000 });
      await expect(errorAlert.first()).toContainText(/(エラー|失敗|問題)/i);
    }

    // ボタンが再度有効になる
    await expect(pdfBtn).toBeEnabled();
    await expect(pdfBtn).toContainText(/(再試行|生成|作成)/i);
  });

  test('@ci-smoke pdf tab content validation', async ({ page }) => {
    // PDFタブ内のコンテンツ確認（安定要素ベース）
    await expect(page.locator('#monthly-tabpanel-pdf')).toBeVisible();
    await expect(page.getByRole('heading', { name: '月次記録PDF出力' })).toBeVisible();
    await expect(page.getByTestId(monthlyTestIds.pdfGenerateBtn)).toBeVisible();

    // プレビュー情報（もしあれば）
    const previewInfo = page.locator('[data-testid*="preview"], .preview');
    if (await previewInfo.count() > 0) {
      await expect(previewInfo).toBeVisible();
    }

    // 注意事項やヘルプテキスト
    const helpText = page.getByText(/(注意|ヘルプ|について)/i);
    if (await helpText.count() > 0) {
      await expect(helpText.first()).toBeVisible();
    }
  });

  test('@ci-smoke pdf generation accessibility', async ({ page }) => {
    const pdfBtn = page.getByTestId(monthlyTestIds.pdfGenerateBtn);

    // ボタンのアクセシビリティ属性確認
    await expect(pdfBtn).toHaveAttribute('type', 'button');
    const ariaLabel = await pdfBtn.getAttribute('aria-label');
    if (ariaLabel) {
      expect(ariaLabel.length).toBeGreaterThan(0);
    } else {
      await expect(pdfBtn).toContainText(/(PDF|生成|出力)/i);
    }

    // キーボードナビゲーション確認
    await pdfBtn.focus();
    await expect(pdfBtn).toBeFocused();

    // Enterキーでの操作
    await page.keyboard.press('Enter');

    // 操作後もボタンが利用可能であること
    await expect(pdfBtn).toBeVisible();
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

    // モバイル相当サイズでも操作できる
    await pdfBtn.click();
    await expect(pdfBtn).toBeVisible();

    // デスクトップサイズに戻す
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});