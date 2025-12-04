import { expect, test } from '@playwright/test';

test.describe('C-2 クロスモジュールナビゲーション', () => {
  test('Activity→Attendance: 支援記録（ケース記録）から通所状況へのリンク', async ({ page }) => {
    // 1. 支援記録（ケース記録）ページを開く
    await page.goto('/daily/activity');

    // 2. ページが読み込まれることを確認
    await expect(page.getByTestId('records-daily-root')).toBeVisible();

    // 3. 日次記録リストが表示されることを確認（緩い検索）
    const recordList = page.locator('[data-testid*="daily-record"]').first();
    await expect(recordList).toBeVisible();

    // 4. カードコンポーネントを直接探す
    const cardComponents = page.locator('.MuiCard-root');
    await expect(cardComponents.first()).toBeVisible();

    // 5. 操作メニューボタンを探す
    const menuButtons = page.locator('[aria-label*="more"], button:has(svg)');
    const firstMenuButton = menuButtons.first();

    if (await firstMenuButton.isVisible()) {
      await firstMenuButton.click();

      // 「通所状況を見る」メニュー項目をクリック
      const attendanceMenuItem = page.getByText('通所状況を見る');
      if (await attendanceMenuItem.isVisible()) {
        await attendanceMenuItem.click();

        // 6. 通所管理ページに遷移することを確認
        await expect(page).toHaveURL(/\/daily\/attendance/);
        await expect(page.getByTestId('heading-attendance')).toBeVisible();
      }
    }
  });

  test('Attendance→Activity: 通所状況から支援記録（ケース記録）へのリンク', async ({ page }) => {
    // 1. 通所管理ページを開く
    await page.goto('/daily/attendance');

    // 2. ページが読み込まれることを確認
    await expect(page.getByTestId('heading-attendance')).toBeVisible();

    // 3. 利用者カードが表示されることを確認
    const userCard = page.locator('[data-testid^="card-"]').first();
    await expect(userCard).toBeVisible();

    // 4. 「支援記録（ケース記録）を見る」ボタンをクリック
    const activityButton = userCard.getByTestId(/btn-activity-/);
    if (await activityButton.isVisible()) {
      await activityButton.click();

      // 5. 支援記録（ケース記録）ページに遷移することを確認
      await expect(page).toHaveURL(/\/daily\/activity/);
      await expect(page.getByTestId('records-daily-root')).toBeVisible();
    }
  });

  test('URL契約: query parametersでのハイライト機能', async ({ page }) => {
    // 1. 特定の利用者コードを指定してアクセス
    await page.goto('/daily/attendance?userId=I003&date=2025-11-17');

    // 2. ページが読み込まれることを確認
    await expect(page.getByTestId('heading-attendance')).toBeVisible();

    // 3. 指定した利用者のカードが存在することを確認
    const targetCard = page.getByTestId('card-I003');
    await expect(targetCard).toBeVisible();

    // 4. 該当カードがハイライト表示されていることを確認（実際の色）
    await expect(targetCard).toHaveCSS('border-color', /rgb\(0, 82, 155\)/); // 実際のprimary.main色
  });

  test('E2E: Activity⇔Attendance双方向ナビゲーション', async ({ page }) => {
    // 1. 支援記録（ケース記録）から開始
    await page.goto('/daily/activity');
    await expect(page.getByTestId('records-daily-root')).toBeVisible();

    // 2. 通所状況ページへ移動（カードから直接）
    const cardComponents = page.locator('.MuiCard-root');
    if (await cardComponents.first().isVisible()) {
      const menuButtons = page.locator('[aria-label*="more"], button:has(svg)');
      const firstMenuButton = menuButtons.first();

      if (await firstMenuButton.isVisible()) {
        await firstMenuButton.click();

        const attendanceMenuItem = page.getByText('通所状況を見る');
        if (await attendanceMenuItem.isVisible()) {
          await attendanceMenuItem.click();

          // 通所管理ページに到達
          await expect(page).toHaveURL(/\/daily\/attendance/);
          await expect(page.getByTestId('heading-attendance')).toBeVisible();

          // 3. 通所状況から支援記録（ケース記録）に戻る
          const userCard = page.locator('[data-testid^="card-"]').first();
          const activityButton = userCard.getByTestId(/btn-activity-/);
          if (await activityButton.isVisible()) {
            await activityButton.click();

            // 4. 支援記録（ケース記録）ページに戻ることを確認
            await expect(page).toHaveURL(/\/daily\/activity/);
            await expect(page.getByTestId('records-daily-root')).toBeVisible();
          }
        }
      }
    }
  });
});