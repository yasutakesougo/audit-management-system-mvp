import { test, expect } from '@playwright/test';

test.describe('Kiosk UX Regression (Smoke)', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test('kiosk mode: 1-tap navigation to schedule and back to today', async ({ page }) => {
    // 1. 事前準備: UIからの設定切替ではなく、localStorageへの流し込みで確実・高速にキオスクモードをON
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'audit:settings:v1',
        JSON.stringify({
          colorMode: 'system',
          density: 'comfortable',
          fontSize: 'medium',
          colorPreset: 'default',
          layoutMode: 'kiosk', // Target: キオスクモード専属テスト
          hiddenNavGroups: [],
          hiddenNavItems: [],
          lastModified: Date.now(),
        })
      );
    });

    // 2. 基点となるTodayダッシュボードへアクセス
    await page.goto('/today?kiosk=1&provider=memory');
    await page.waitForLoadState('networkidle');

    // URLが想定通りか確認
    await expect(page).toHaveURL(/\/today/);

    // 3. 【検証】1タップ導線の確認（スケジュールへの遷移）
    // 現場向けの「📅 スケジュール」ボタン（リンク）が表示されているか
    const scheduleBtn = page
      .getByRole('button', { name: /スケジュール/, exact: false })
      .or(page.getByRole('link', { name: /スケジュール/, exact: false }))
      .filter({ hasText: /^スケジュール$/ }) // Exact text match if possible
      .first();

    await scheduleBtn.waitFor({ state: 'visible', timeout: 5000 });
    await scheduleBtn.click();

    // スケジュール画面に確実に遷移したかのアサーション
    await expect(page).toHaveURL(/\/schedule/);

    // 4. 【検証】セーフティネットの確認（帰還導線）
    // 左上に常設される「← 今日の業務に戻る」ボタン
    const backBtn = page
      .getByRole('button', { name: /今日の業務に戻る/, exact: false })
      .or(page.getByRole('link', { name: /今日の業務に戻る/, exact: false }))
      .filter({ hasText: /戻る/ })
      .first();

    await backBtn.waitFor({ state: 'visible', timeout: 5000 });
    await backBtn.click();

    // 確実にダッシュボード（/today）に帰還できているか
    await expect(page).toHaveURL(/\/today|^\/$/);
  });

  test('kiosk mode: FAB fallback menu can navigate back to normal mode', async ({ page }) => {
    // 1. 事前準備
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'audit:settings:v1',
        JSON.stringify({
          colorMode: 'system',
          density: 'comfortable',
          fontSize: 'medium',
          colorPreset: 'default',
          layoutMode: 'kiosk', // Target: キオスクモード専属テスト
          hiddenNavGroups: [],
          hiddenNavItems: [],
          lastModified: Date.now(),
        })
      );
    });

    // 2. 基点となるTodayダッシュボードへアクセス
    await page.goto('/today?provider=memory');
    await page.waitForLoadState('networkidle');

    // 3. FAB（長押しメニュー）の存在検証
    const fabContainer = page.getByTestId('kiosk-exit-fab');
    await expect(fabContainer).toBeVisible();

    // 4. FABを長押し（1.5秒）してアクションシートを開く
    // Playwrightのネイティブな pointerEvent をエミュレートして `HOLD_DURATION_MS(1500)` を発火させる
    const fabButton = fabContainer.locator('button');
    await fabButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(1600); // 1.5s 以上ホールド
    await page.mouse.up();

    // 5. アクションシートが展開されたことを検証
    const actionSheet = page.getByTestId('kiosk-action-sheet');
    await expect(actionSheet).toBeVisible();

    // 6. 「通常モードに戻る」導線のクリック
    const exitItem = page.getByTestId('kiosk-action-exit');
    await exitItem.click();

    // 7. キオスクモードが解除され、FABが消失した（設定が戻った）ことを検証して完了
    await expect(fabContainer).toBeHidden();
  });

  test('kiosk mode: display monitoring countdown for impending deadlines', async ({ page }) => {
    // 1. KioskモードをURLパラメータで強制し、メモリプロバイダーを使用
    await page.goto('/today?kiosk=1&provider=memory');
    await page.waitForLoadState('networkidle');

    // 2. モニタリングアラートセクションが表示されているか検証
    const monitoringHeader = page.getByText('モニタリング期限', { exact: false });
    await expect(monitoringHeader).toBeVisible();

    // 3. モックデータ（User One）のカウントダウンが表示されているか検証
    const monitoringSection = page.getByTestId('kiosk-monitoring-alerts');
    await expect(monitoringSection.getByText('User One')).toBeVisible();
    await expect(monitoringSection.getByText(/次回会議まで/)).toBeVisible();
    
    // 進捗リング（プログレス）の存在確認
    const progressRing = page.locator('svg').filter({ has: page.locator('circle') });
    await expect(progressRing.first()).toBeVisible();
  });
});

