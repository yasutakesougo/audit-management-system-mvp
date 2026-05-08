import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';

test.describe('Kiosk Procedure Detail', () => {
  test.beforeEach(async ({ page }) => {
    // 直接 ID: 1 の利用者の最初の手順詳細に遷移する
    await bootKiosk(page, { route: '/kiosk/users/1/procedures/0', userId: '1' });
    
    // 詳細画面が表示されるのを待つ
    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });
  });

  test('should display procedure details and navigate back', async ({ page }) => {
    // 利用者名が表示されているか
    await expect(page.locator('h1')).toContainText('桂川 進太朗');
    
    // 本人と支援者のセクションがあるか
    await expect(page.getByText('本人のすること')).toBeVisible();
    await expect(page.getByText('支援者がすること')).toBeVisible();
    
    // 主操作ボタンが存在するか
    await expect(page.getByRole('button', { name: '記録を保存する' })).toBeVisible();

    // 戻るボタンで一覧に戻れるか
    await page.getByTestId('kiosk-procedure-detail-back').click();
    await expect(page.getByText('の支援手順')).toBeVisible();
  });

  test('should save procedure record and reflect in list', async ({ page }) => {
    // 観察パネルが表示されることを確認
    await expect(page.getByTestId('kiosk-observation-panel')).toBeVisible();

    // 1. 本人の様子を選択（バリデーション回避のため1つ以上選択が必要）
    await page.getByTestId('mood-chip-落ち着いていた').click();

    // 2. パネル内の「記録を保存する」をクリック
    await page.getByRole('button', { name: '記録を保存する' }).click();

    await expect(page.getByText('記録を保存しました')).toBeVisible();
    await expect(page).toHaveURL(/.*\/kiosk\/users\/1\/procedures\/?(\?.*)?/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('記録済み')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 17')).toBeVisible();
  });
});
