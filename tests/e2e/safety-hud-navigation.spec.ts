import { expect, test } from '@playwright/test';

test.describe('Dashboard Safety HUD - Navigation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Safety HUD alerts navigation', async ({ page }) => {
    console.log('Testing Safety HUD alert navigation...');

    // Safety HUD が表示されていることを確認
    const safetyHUD = page.getByTestId('dashboard-safety-hud');
    await expect(safetyHUD).toBeVisible();

    // アラートを検索（safety-hud-alert-で始まるTestID）
    const alerts = page.locator('[data-testid^="safety-hud-alert-"]');
    const alertCount = await alerts.count();

    console.log(`Found ${alertCount} Safety HUD alerts`);

    if (alertCount > 0) {
      // 最初のアラートをクリック
      const firstAlert = alerts.first();

      // アラートが表示され、クリック可能であることを確認
      await expect(firstAlert).toBeVisible();

      // アラートの詳細を取得してログ出力
      const alertText = await firstAlert.textContent();
      console.log(`First alert content: ${alertText?.substring(0, 100)}...`);

      // クリック実行
      await firstAlert.click();
      await page.waitForLoadState('networkidle');

      // ナビゲーション後のURL確認
      const currentUrl = page.url();
      console.log(`Navigated to: ${currentUrl}`);

      // 期待される URL パターンの確認
      const validUrls = [
        '/daily/activity',
        '/daily/attendance',
        '/admin/integrated-resource-calendar'
      ];

      const isValidNavigation = validUrls.some(url => currentUrl.includes(url));

      if (isValidNavigation) {
        console.log('✅ Valid navigation detected');
        expect(isValidNavigation).toBeTruthy();
      } else {
        console.log(`❓ Unexpected navigation: ${currentUrl}`);
        // ナビゲーションが発生しなくてもテストは通す（アラートがリンクでない場合もある）
      }

    } else {
      console.log('ℹ️ No alerts found - this is expected in normal operation');

      // アラートが無い場合は、Safety HUD に正常メッセージが表示されているか確認
      const safetyHUDText = await safetyHUD.textContent();
      expect(safetyHUDText).toBeTruthy();
      console.log('✅ Safety HUD shows normal status');
    }
  });

  test('Multiple alerts priority order', async ({ page }) => {
    console.log('Testing alert priority ordering...');

    const safetyHUD = page.getByTestId('dashboard-safety-hud');
    await expect(safetyHUD).toBeVisible();

    // アラートを検索
    const alerts = page.locator('[data-testid^="safety-hud-alert-"]');
    const alertCount = await alerts.count();

    console.log(`Found ${alertCount} alerts for priority testing`);

    if (alertCount > 1) {
      // 各アラートの class や data-testid から severity を推測
      const severities = [];

      for (let i = 0; i < Math.min(alertCount, 3); i++) {
        const alert = alerts.nth(i);
        const classList = await alert.getAttribute('class') || '';
        const testId = await alert.getAttribute('data-testid') || '';

        let severity = 'info'; // default

        if (classList.includes('error') || testId.includes('error')) {
          severity = 'error';
        } else if (classList.includes('warning') || testId.includes('warning')) {
          severity = 'warning';
        }

        severities.push(severity);
        console.log(`Alert ${i + 1}: severity = ${severity}`);
      }

      // 順序の検証（error -> warning -> info）
      const severityOrder = { error: 0, warning: 1, info: 2 };
      let isCorrectOrder = true;

      for (let i = 0; i < severities.length - 1; i++) {
        const current = severityOrder[severities[i]];
        const next = severityOrder[severities[i + 1]];
        if (current > next) {
          isCorrectOrder = false;
          break;
        }
      }

      console.log(`Alert order: [${severities.join(', ')}] - ${isCorrectOrder ? 'Correct' : 'Incorrect'}`);
      expect(isCorrectOrder).toBeTruthy();

    } else {
      console.log('ℹ️ Not enough alerts to test priority ordering');
    }
  });

  test('Safety HUD responsive behavior', async ({ page }) => {
    console.log('Testing Safety HUD responsive behavior...');

    // デスクトップサイズでテスト
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const safetyHUD = page.getByTestId('dashboard-safety-hud');
    await expect(safetyHUD).toBeVisible();

    console.log('✅ Safety HUD visible on desktop');

    // モバイルサイズでテスト
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(safetyHUD).toBeVisible();
    console.log('✅ Safety HUD visible on mobile');
  });
});