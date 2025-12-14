import { expect, test } from '@playwright/test';

test.describe('Dashboard Phase II - Mini E2E Tests', () => {
  // 各テスト前にダッシュボードページにアクセス
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard表示 - 基本コンポーネント検証', async ({ page }) => {
    // ページタイトル確認 - 実際のタイトルに合わせて修正
    await expect(page).toHaveTitle(/Audit Management/);

    // Dashboard ページの基本要素確認
    const dashboardPage = page.getByTestId('dashboard-page');
    await expect(dashboardPage).toBeVisible();

    console.log('Dashboard page loaded successfully');

    // ページ内に重要なテキストが含まれていることを確認
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('Safety HUD - アラート表示検証', async ({ page }) => {
    // Safety HUD セクション確認 - 実際のTestIDを使用
    const safetyHUD = page.getByTestId('dashboard-safety-hud');
    await expect(safetyHUD).toBeVisible();

    // Safety HUD タイトル確認
    await expect(safetyHUD).toContainText('Safety HUD');

    console.log('Safety HUD detected and visible');
  });

  test('Safety HUD → モジュール遷移', async ({ page }) => {
    // Safety HUD アラートのクリック動作テスト
    const alertsContainer = page.getByTestId('safety-hud-alerts');
    const alerts = alertsContainer.locator('[data-testid^="safety-alert-"]');
    const alertCount = await alerts.count();

    if (alertCount > 0) {
      // 最初のアラートをクリック
      const firstAlert = alerts.first();
      await firstAlert.click();

      // ページ遷移を待機
      await page.waitForLoadState('networkidle');

      // 適切なモジュールページに遷移していることを確認
      const currentUrl = page.url();
      const validModuleUrls = [
        '/daily/activity',
        '/daily/attendance',
        '/admin/integrated-resource-calendar'
      ];

      const isValidNavigation = validModuleUrls.some(url => currentUrl.includes(url));
      expect(isValidNavigation).toBeTruthy();

      console.log(`Navigation successful: ${currentUrl}`);
    } else {
      console.log('No alerts to test navigation');
    }
  });

  test('モジュールサマリーカード → 遷移テスト', async ({ page }) => {
    // 支援記録（ケース記録）カードクリックテスト
    const activityCard = page.getByTestId('module-summary-card-activity');
    await activityCard.click();
    await page.waitForLoadState('networkidle');

    let currentUrl = page.url();
    expect(currentUrl).toContain('/daily/activity');

    // ダッシュボードに戻る
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 通所管理カードクリックテスト
    const attendanceCard = page.getByTestId('module-summary-card-attendance');
    await attendanceCard.click();
    await page.waitForLoadState('networkidle');

    currentUrl = page.url();
    expect(currentUrl).toContain('/daily/attendance');

    // ダッシュボードに戻る
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // IRCカードクリックテスト
    const ircCard = page.getByTestId('module-summary-card-irc');
    await ircCard.click();
    await page.waitForLoadState('networkidle');

    currentUrl = page.url();
    expect(currentUrl).toContain('/admin/integrated-resource-calendar');
  });

  test('アラート優先度表示検証', async ({ page }) => {
    // Safety HUD アラートの表示順序確認
    const alertsContainer = page.getByTestId('safety-hud-alerts');
    const alerts = alertsContainer.locator('[data-testid^="safety-alert-"]');
    const alertCount = await alerts.count();

    if (alertCount > 1) {
      // 複数アラートがある場合、優先度順序を確認
      type AlertSeverity = 'error' | 'warning' | 'info';
      const alertSeverities: AlertSeverity[] = [];

      for (let i = 0; i < Math.min(alertCount, 3); i++) {
        const alert = alerts.nth(i);
        const alertClasses = await alert.getAttribute('class') || '';
        const alertTestId = await alert.getAttribute('data-testid') || '';

        // severity class または test-id から重要度を判定
        let severity: AlertSeverity = 'info';
        if (alertClasses.includes('error') || alertTestId.includes('error')) {
          severity = 'error';
        } else if (alertClasses.includes('warning') || alertTestId.includes('warning')) {
          severity = 'warning';
        }

        alertSeverities.push(severity);
      }

      // error が warning より前、warning が info より前にあることを確認
      const severityOrder: Record<AlertSeverity, number> = { error: 0, warning: 1, info: 2 };
      let isCorrectOrder = true;

      for (let i = 0; i < alertSeverities.length - 1; i++) {
        const current = severityOrder[alertSeverities[i]];
        const next = severityOrder[alertSeverities[i + 1]];
        if (current > next) {
          isCorrectOrder = false;
          break;
        }
      }

      expect(isCorrectOrder).toBeTruthy();
      console.log(`Alert priority order verified: [${alertSeverities.join(', ')}]`);

    } else {
      console.log('Insufficient alerts to test priority ordering');
    }
  });

  test('レスポンシブ表示確認', async ({ page }) => {
    // デスクトップサイズでの表示確認
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 3大モジュールカードが横並びで表示される
    const cardsContainer = page.getByTestId('module-summary-cards');
    await expect(cardsContainer).toBeVisible();

    // モバイルサイズでの表示確認
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // モバイルでもカードが適切に表示される
    await expect(cardsContainer).toBeVisible();

    // Safety HUD もモバイルで表示される
    const safetyHUD = page.getByTestId('safety-hud');
    await expect(safetyHUD).toBeVisible();
  });
});

test.describe('Dashboard Performance', () => {
  test('ページロード性能確認', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 重要な要素が表示されるまでの時間測定
    const activityCard = page.getByTestId('module-summary-card-activity');
    await expect(activityCard).toBeVisible();

    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);

    // 3秒以内でのロード完了を期待
    expect(loadTime).toBeLessThan(3000);
  });
});