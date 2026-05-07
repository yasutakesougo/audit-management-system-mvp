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
    
    // 「手順記録」ボタンが存在するか
    const procedureButton = page.getByRole('button', { name: '手順記録' });
    await expect(procedureButton).toBeVisible();

    // 戻るボタンで一覧に戻れるか
    await page.getByTestId('kiosk-procedure-detail-back').click();
    await expect(page.getByText('の支援手順')).toBeVisible();
  });

  test('should save procedure record and reflect in list', async ({ page }) => {
    // 1. 「手順記録」をクリックしてパネルを開く
    await page.getByRole('button', { name: '手順記録' }).click();
    
    // 観察パネルが表示されることを確認
    await expect(page.getByTestId('kiosk-observation-panel')).toBeVisible();

    // 2. パネル内の「記録を保存する」をクリック
    await page.getByRole('button', { name: '記録を保存する' }).click();

    await expect(page.getByText('記録を保存しました')).toBeVisible();
    await expect(page).toHaveURL(/.*\/kiosk\/users\/1\/procedures\/?(\?.*)?/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    // ステータスは triggered なので「注意あり」が表示される（これは既存仕様どおり）
    await expect(firstCard.getByText('注意あり')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 17')).toBeVisible();
  });
});
