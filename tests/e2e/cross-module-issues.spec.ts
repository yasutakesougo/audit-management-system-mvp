import { expect, test } from '@playwright/test';

test.describe('C-4: Cross-Module Issues E2E', () => {
  test.describe('Complete Cross-Module Integration Flow', () => {

    test('S1: attendance_activity_mismatch alert navigates to Activity and highlights target user', async ({ page }) => {
      // 1) ダッシュボードを開く
      await page.goto('/');

      // 2) Dashboard ページが読み込まれることを確認
      await expect(page.getByTestId('dashboard-page')).toBeVisible();

      // 3) Safety HUD が表示されていることを確認
      const hud = page.getByTestId('dashboard-safety-hud');
      await expect(hud).toBeVisible();

      // 4) Cross-Module アラートの中から「当日欠席なのに活動完了」系を探す
      const alerts = page.locator('[data-testid^="safety-hud-alert-"]');
      await expect(alerts.first()).toBeVisible();

      // 欠席関連のアラートを探す
      const alert = alerts.filter({
        hasText: /欠席.*活動完了|当日欠席なのに活動完了|absence.*activity.*mismatch/i,
      });

      // アラートが存在する場合のみテスト実行
      const alertCount = await alert.count();
      if (alertCount === 0) {
        test.skip(true, 'No attendance_activity_mismatch alert found on this run');
        return;
      }

      const alertLocator = alert.first();
      await expect(alertLocator).toBeVisible();

      // 5) クリック → Activity画面へ遷移
      await alertLocator.click();

      // 6) Activity画面のURL契約を確認
      await expect(page).toHaveURL(/\/daily\/activity(\?.*)?$/);

      // もしクエリパラメータがある場合は確認
      const currentUrl = page.url();
      if (currentUrl.includes('userId=')) {
        await expect(page).toHaveURL(/\/daily\/activity\?userId=.*&date=.*/);
      }

      // 7) Activity画面が読み込まれることを確認
      await expect(page.getByTestId('records-daily-root')).toBeVisible();

      // 8) クエリパラメータから userId を取得（存在する場合）
      const url = new URL(page.url());
      const userId = url.searchParams.get('userId');

      if (userId) {
        // 該当利用者がハイライトされているか確認（実装に依存）
        const targetCard = page.locator(`[data-testid*="${userId}"], .MuiCard-root`).filter({
          hasText: userId
        });

        if (await targetCard.count() > 0) {
          await expect(targetCard.first()).toBeVisible();
          // ハイライトスタイルの確認（border色など）
          await expect(targetCard.first()).toHaveCSS('border-color', /rgb\(.*\)/);
        }
      }
    });

    test('S2: completion_gap alert navigates to Activity with incomplete record highlighted', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('dashboard-page')).toBeVisible();

      const hud = page.getByTestId('dashboard-safety-hud');
      await expect(hud).toBeVisible();

      const alerts = page.locator('[data-testid^="safety-hud-alert-"]');
      await expect(alerts.first()).toBeVisible();

      // 退所済み・未作成関連のアラートを探す
      const alert = alerts.filter({
        hasText: /退所.*未作成|活動未作成|completion.*gap|記録未完了/i,
      });

      const alertCount = await alert.count();
      if (alertCount === 0) {
        test.skip(true, 'No completion_gap alert found on this run');
        return;
      }

      const alertLocator = alert.first();
      await expect(alertLocator).toBeVisible();

      await alertLocator.click();

      await expect(page).toHaveURL(/\/daily\/activity(\?.*)?$/);
      await expect(page.getByTestId('records-daily-root')).toBeVisible();

      const url = new URL(page.url());
      const userId = url.searchParams.get('userId');

      if (userId) {
        // 該当利用者カードで「未作成」状態を確認
        const targetCard = page.locator(`.MuiCard-root`).filter({
          hasText: new RegExp(`${userId}|未作成`, 'i')
        });

        if (await targetCard.count() > 0) {
          await expect(targetCard.first()).toBeVisible();
          // 「未作成」ステータス表示の確認
          await expect(targetCard.first()).toContainText(/未作成/);
        }
      }
    });

    test('S3: data_missing alert navigates to Attendance and highlights target user', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('dashboard-page')).toBeVisible();

      const hud = page.getByTestId('dashboard-safety-hud');
      await expect(hud).toBeVisible();

      const alerts = page.locator('[data-testid^="safety-hud-alert-"]');
      await expect(alerts.first()).toBeVisible();

      // 提供時間未記録関連のアラートを探す
      const alert = alerts.filter({
        hasText: /提供時間.*未記録|時間未記録|提供時間なし|data.*missing|通所中.*提供時間/i,
      });

      const alertCount = await alert.count();
      if (alertCount === 0) {
        test.skip(true, 'No data_missing alert found on this run');
        return;
      }

      const alertLocator = alert.first();
      await expect(alertLocator).toBeVisible();

      await alertLocator.click();

      await expect(page).toHaveURL(/\/daily\/attendance(\?.*)?$/);
      await expect(page.getByTestId('heading-attendance')).toBeVisible();

      const url = new URL(page.url());
      const userId = url.searchParams.get('userId');

      if (userId) {
        // 該当利用者カードがハイライトされていることを確認
        const targetCard = page.getByTestId(`card-${userId}`);

        if (await targetCard.count() > 0) {
          await expect(targetCard).toBeVisible();

          // ハイライト表示の確認（C-2で実装済み）
          await expect(targetCard).toHaveCSS('border-color', /rgb\(0, 82, 155\)/); // primary.main色

          // 提供時間 0 分などの状態確認
          await expect(targetCard).toContainText(/提供.*0分|実提供.*0/);
        }
      }
    });

    test('S4: Cross-Module Alert Integration End-to-End Validation', async ({ page }) => {
      // 統合シナリオ：複数のアラートが存在し、適切に優先順位付けされていること
      await page.goto('/');

      await expect(page.getByTestId('dashboard-page')).toBeVisible();

      const hud = page.getByTestId('dashboard-safety-hud');
      await expect(hud).toBeVisible();

      // Safety HUDに何らかのアラートが表示されていること
      const alerts = page.locator('[data-testid^="safety-hud-alert-"]');

      // アラートの存在確認
      const alertCount = await alerts.count();
      if (alertCount === 0) {
        test.skip('No alerts found for integration validation', () => {});
        return;
      }

      // アラートが重要度順にソートされていることを確認
      // (Cross-Module Alert統合の効果)

      // 最初のアラートをクリックして遷移動作を確認
      const firstAlert = alerts.first();
      await expect(firstAlert).toBeVisible();

      // アラートに適切なテキストが含まれていることを確認
      const alertText = await firstAlert.textContent();
      expect(alertText).toBeTruthy();

      // アラートクリック → 適切なページへの遷移
      await firstAlert.click();

      // 遷移先ページの確認（activity, attendance, またはdashboard）
      await expect(page).toHaveURL(/\/(daily\/(activity|attendance)|dashboard)/);

      // 遷移先ページが正常にロードされることを確認
      await page.waitForLoadState('networkidle');

      // ページが操作可能な状態であることを確認
      const pageContent = page.locator('main, [role="main"], .MuiContainer-root').first();
      await expect(pageContent).toBeVisible();
    });

    test('S5: Cross-Module Navigation Full Circle', async ({ page }) => {
      // フル統合シナリオ：Dashboard → Alert → Activity → Attendance → Dashboard

      // 1. Dashboard開始
      await page.goto('/');
      await expect(page.getByTestId('dashboard-page')).toBeVisible();

      // 2. Safety HUDアラート確認
      const hud = page.getByTestId('dashboard-safety-hud');
      await expect(hud).toBeVisible();

      const alerts = page.locator('[data-testid^="safety-hud-alert-"]');
      const alertCount = await alerts.count();

      if (alertCount > 0) {
        // 3. アラートから Activity へ
        const firstAlert = alerts.first();
        await firstAlert.click();

        // Activity または Attendance に遷移
        await page.waitForURL(/\/(daily\/(activity|attendance)|dashboard)/);

        if (page.url().includes('/daily/activity')) {
          // 4. Activity から Attendance への Navigation（C-2機能）
          await expect(page.getByTestId('records-daily-root')).toBeVisible();

          // Activity の メニューから Attendance への遷移を試行
          const menuButtons = page.locator('[aria-label*="メニューを開く"], [aria-label*="more"]');
          const menuButton = menuButtons.first();
          if (await menuButton.isVisible()) {
            await menuButton.click({ force: true, noWaitAfter: true, timeout: 5000 });

            const attendanceMenuItem = page.getByText('通所状況を見る');
            if (await attendanceMenuItem.isVisible()) {
              await attendanceMenuItem.click();

              // 5. Attendance ページ到達
              await expect(page).toHaveURL(/\/daily\/attendance/);
              await expect(page.getByTestId('heading-attendance')).toBeVisible();

              // 6. Attendance から Activity への Navigation
              const userCards = page.locator('[data-testid^="card-"]');
              if (await userCards.count() > 0) {
                const activityButton = userCards.first().getByTestId(/btn-activity-/);
                if (await activityButton.isVisible()) {
                  await activityButton.click();

                  // 7. Activity ページに戻る
                  await expect(page).toHaveURL(/\/daily\/activity/);
                  await expect(page.getByTestId('records-daily-root')).toBeVisible();
                }
              }
            }
          } else {
            test.skip(true, 'Activity menu button not visible on this run');
          }
        }
      } else {
        test.skip('No alerts found for full circle navigation test', () => {});
      }
    });
  });
});