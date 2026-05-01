import { test, expect } from '@playwright/test';

test.describe('Kiosk Procedure Detail', () => {
  test.beforeEach(async ({ page }) => {
    // 確実にデータを読み込むために /kiosk/users から開始
    await page.goto('/kiosk/users');
    const userCard = page.locator('[data-testid^="kiosk-user-card-"]').first();
    await userCard.waitFor({ state: 'visible', timeout: 10000 });
    await userCard.click();
    
    // 一覧画面が表示されるのを待つ
    await expect(page.getByText('の支援手順')).toBeVisible({ timeout: 10000 });
    
    // 最初の手順カードをクリック
    const procCard = page.locator('[data-testid^="kiosk-procedure-card-"]').first();
    await procCard.click();
    
    // 詳細画面が表示されるのを待つ
    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });
  });

  test('should display procedure details and navigate back', async ({ page }) => {
    // 利用者名が表示されているか
    await expect(page.locator('h1')).toBeVisible();
    
    // 本人と支援者のセクションがあるか
    await expect(page.getByText('本人のすること')).toBeVisible();
    await expect(page.getByText('支援者がすること')).toBeVisible();
    
    // 「実施済みにする」ボタンが無効状態で存在するか
    const completeButton = page.getByText('実施済みにする (開発中)');
    await expect(completeButton).toBeVisible();
    await expect(completeButton).toBeDisabled();

    // 戻るボタンで一覧に戻れるか
    await page.getByTestId('kiosk-procedure-detail-back').click();
    await expect(page.getByText('の支援手順')).toBeVisible();
  });
});
