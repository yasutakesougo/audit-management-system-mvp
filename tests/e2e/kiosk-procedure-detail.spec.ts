import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';

test.describe('Kiosk Procedure Detail', () => {
  test.beforeEach(async ({ page }) => {
    await bootKiosk(page, { route: '/kiosk' });
    await expect(page.getByTestId('kiosk-action-execute-steps')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('kiosk-action-execute-steps').click();
    await expect(page.getByText('利用者を選択してください')).toBeVisible({ timeout: 10000 });

    const noUsersMessage = page.getByText('対象の利用者がいません');
    if (await noUsersMessage.isVisible()) {
      throw new Error('E2E前提データ不足: IsActive && IsSupportProcedureTarget を満たす利用者が0件です');
    }

    const userCard = page.locator('[data-testid^="kiosk-user-card-"]').first();
    await userCard.waitFor({ state: 'visible', timeout: 10000 });
    await userCard.click();
    
    // 一覧画面が表示されるのを待つ
    await expect(page.getByText('の支援手順')).toBeVisible({ timeout: 10000 });
    
    // 最初の手順カードをクリック
    const procCard = page.locator('[data-testid^="kiosk-procedure-card-"]').first();
    await procCard.click({ force: true });
    
    // 詳細画面が表示されるのを待つ
    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });
  });

  test('should display procedure details and navigate back', async ({ page }) => {
    // 利用者名が表示されているか
    await expect(page.locator('h1')).toBeVisible();
    
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
    await expect(page).toHaveURL(/\/kiosk\/users\/[^/]+\/procedures(\?.*)?$/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('実施済み')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 8')).toBeVisible();
  });

  test('should save triggered status and reflect in procedure list', async ({ page }) => {
    await page.getByRole('button', { name: '注意ありで記録' }).click();

    await expect(page.getByText('記録を保存しました')).toBeVisible();
    await expect(page).toHaveURL(/\/kiosk\/users\/[^/]+\/procedures(\?.*)?$/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('注意あり')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 8')).toBeVisible();
  });
});
