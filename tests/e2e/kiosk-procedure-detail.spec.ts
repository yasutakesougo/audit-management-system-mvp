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
    await expect(page.locator('h1')).toContainText('田中 太郎');
    
    // 本人と支援者のセクションがあるか
    await expect(page.getByText('本人のすること')).toBeVisible();
    await expect(page.getByText('支援者がすること')).toBeVisible();
    
    // 「実施済みにする」ボタンが存在するか
    const completeButton = page.getByRole('button', { name: '実施済みにする' });
    await expect(completeButton).toBeVisible();

    // 戻るボタンで一覧に戻れるか
    await page.getByTestId('kiosk-procedure-detail-back').click();
    await expect(page.getByText('の支援手順')).toBeVisible();
  });

  test('should save completed status and reflect in procedure list', async ({ page }) => {
    await page.getByRole('button', { name: '実施済みにする' }).click();

    await expect(page.getByText('記録を保存しました')).toBeVisible();
    // URL遷移を待機（クエリパラメータが含まれる可能性があるため RegExp を使用）
    await expect(page).toHaveURL(/.*\/kiosk\/users\/1\/procedures\/?(\?.*)?/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('実施済み')).toBeVisible();
    // 実施状況の更新を確認 (1 / 8)
    await expect(page.getByText('実施状況: 1 / 8')).toBeVisible();
  });

  test('should save triggered status and reflect in procedure list', async ({ page }) => {
    await page.getByRole('button', { name: '注意ありで記録' }).click();

    await expect(page.getByText('記録を保存しました')).toBeVisible();
    await expect(page).toHaveURL(/.*\/kiosk\/users\/1\/procedures\/?(\?.*)?/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('注意あり')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 8')).toBeVisible();
  });
});
