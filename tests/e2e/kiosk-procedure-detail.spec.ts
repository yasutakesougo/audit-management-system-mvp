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

    // 1. 自由記述メモを入力（バリデーション回避のため1つ以上入力が必要）
    await page.getByTestId('kiosk-observation-memo').fill('E2E保存確認');

    // 2. 「記録を保存する」ボタンをクリック（data-testidを使用）
    await page.getByTestId('kiosk-observation-submit').click();

    // 成功メッセージが表示されるのを待つ（タイムアウトに注意）
    await expect(page.getByText('記録を保存しました')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/kiosk\/users\/1\/procedures\/?(\?.*)?/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('記録済み')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 17')).toBeVisible();
  });

  test('should propagate date URL parameter to detail and back on save', async ({ page }) => {
    await bootKiosk(page, { route: '/kiosk/users/1/procedures/0?date=2026-05-07', userId: '1' });
    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/kiosk\/users\/1\/procedures\/0\?date=2026-05-07/);

    await page.getByTestId('kiosk-observation-memo').fill('E2E過去日保存確認');
    await page.getByTestId('kiosk-observation-submit').click();

    await expect(page.getByText('記録を保存しました')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/kiosk\/users\/1\/procedures\?date=2026-05-07/);
    await expect(page.getByText('2026年5月7日 の支援手順')).toBeVisible({ timeout: 10000 });
  });

  test('should save second procedure without colliding with first procedure record', async ({ page }) => {
    // 1. 1番目の手順(scheduleItemId: '1')が完了した状態で2番目の手順(/procedures/1)の詳細画面に直接遷移する
    await bootKiosk(page, {
      route: '/kiosk/users/1/procedures/1',
      userId: '1',
      records: [
        { scheduleItemId: '1', status: 'completed' }
      ]
    });

    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });

    // 2. メモを入力して保存
    await page.getByTestId('kiosk-observation-memo').fill('2番目の手順のメモ');
    await page.getByTestId('kiosk-observation-submit').click();

    // 3. 一覧画面に戻り、1番目と2番目の手順の両方が記録済みになっていることを確認する
    await expect(page.getByText('記録を保存しました')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/kiosk\/users\/1\/procedures\/?(\?.*)?/);

    // 1番目と2番目のカードがともに記録済み
    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    const secondCard = page.locator('[data-testid="kiosk-procedure-card-1"]');
    await expect(firstCard.getByText('記録済み')).toBeVisible();
    await expect(secondCard.getByText('記録済み')).toBeVisible();

    // 進捗が 2 / 17 になっていることを確認
    await expect(page.getByText('実施状況: 2 / 17')).toBeVisible();
  });
});
