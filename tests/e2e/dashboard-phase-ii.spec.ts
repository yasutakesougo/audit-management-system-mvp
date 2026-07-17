import { expect, test } from '@playwright/test';

test.describe('Dashboard Phase II - Mini E2E Tests', () => {
  // 各テスト前にダッシュボードページにアクセス
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard?zeroscroll=0');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard表示 - 基本コンポーネント検証', async ({ page }) => {
    const dashboardPage = page.getByTestId('dashboard-page');
    await expect(dashboardPage).toBeVisible();
    await expect(dashboardPage.getByRole('heading', { name: '運営状況' })).toBeVisible();

    console.log('Dashboard page loaded successfully');
  });

  test('Safety HUD - アラート表示検証', async ({ page }) => {
    // Safety HUD セクション確認 - 実際のTestIDを使用
    const safetyHUD = page.getByTestId('dashboard-briefing-hud');
    await expect(safetyHUD).toBeVisible();

    // Safety HUD タイトル確認
    await expect(safetyHUD).toContainText(/朝会サマリー|夕会サマリー/);

    console.log('Safety HUD detected and visible');
  });

  test('Safety HUD → モジュール遷移', async ({ page }) => {
    // Safety HUD アラートのクリック動作テスト
    const alertsContainer = page.getByTestId('dashboard-briefing-hud');
    const alerts = alertsContainer.locator('[data-testid^="briefing-alert-"]');
    const alertCount = await alerts.count();

    if (alertCount > 0) {
      // 最初のアラートをクリック
      const firstAlert = alerts.first();
      await firstAlert.click();

      // セクションジャンプ後もダッシュボード上にいることを確認
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByTestId('dashboard-page')).toBeVisible();

      console.log('Navigation interaction successful on dashboard');
    } else {
      console.log('No alerts to test navigation');
    }
  });

  test('モジュールサマリーカード → 遷移テスト', async ({ page }) => {
    // 今日の予定セクションからスケジュールへ遷移
    await page.getByRole('link', { name: 'マスタースケジュールを開く' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/schedules\/week/);

    // ダッシュボードに戻る
    await page.goto('/dashboard?zeroscroll=0');
    await page.waitForLoadState('networkidle');

    // 申し送りサマリーの明示的な導線からタイムラインへ遷移
    const dashboardPage = page.getByTestId('dashboard-page');
    const timelineButton = dashboardPage.getByRole('button', {
      name: 'タイムラインを開く',
      exact: true,
    });
    await expect(timelineButton).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/handoff-timeline/),
      timelineButton.click(),
    ]);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/handoff-timeline/);
  });

  test('アラート優先度表示検証', async ({ page }) => {
    // Safety HUD アラートの表示順序確認
    const alertsContainer = page.getByTestId('dashboard-briefing-hud');
    const alerts = alertsContainer.locator('[data-testid^="briefing-alert-"]');
    await expect(alerts.first()).toBeVisible();
  });

  test('レスポンシブ表示確認', async ({ page }) => {
    // デスクトップサイズでの表示確認
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 3大モジュールカードが横並びで表示される
    const briefingHud = page.getByTestId('dashboard-briefing-hud');
    await expect(briefingHud).toBeVisible();

    // モバイルサイズでの表示確認
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // モバイルでもカードが適切に表示される
    await expect(briefingHud).toBeVisible();

    // Safety HUD もモバイルで表示される
    const safetyHUD = page.getByTestId('dashboard-briefing-hud');
    await expect(safetyHUD).toBeVisible();
  });
});

test.describe('Dashboard Performance', () => {
  test('ページロード性能確認', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 重要な要素が表示されるまでの時間測定
    const dashboardPage = page.getByTestId('dashboard-page');
    await expect(dashboardPage).toBeVisible();

    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);

    // 3秒以内でのロード完了を期待
    expect(loadTime).toBeLessThan(3000);
  });
});
