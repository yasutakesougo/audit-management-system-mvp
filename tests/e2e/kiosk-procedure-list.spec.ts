import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';

test.describe('Kiosk Procedure List', () => {
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

    const count = await page.locator('[data-testid^="kiosk-user-card-"]').count();

    if (count > 0) {
      await userCard.click();
    } else {
      throw new Error('E2E前提データ不足: 利用者カードが描画されませんでした');
    }

    // 手順一覧画面が表示されるのを待つ
    await expect(page.getByText('の支援手順')).toBeVisible({ timeout: 10000 });
  });

  test('should display user name and procedure list', async ({ page }) => {
    console.log('Current URL:', page.url());
    
    // 読み込み完了を待つ
    const loading = page.getByText('読み込み中...');
    await loading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    const notFound = page.getByText('利用者が存在しません');
    if (await notFound.isVisible()) {
      console.log('User not found in UI');
      // この場合は失敗とする（DEMO_USERSに1はいるはずなので）
      throw new Error('User not found but expected Tanaka Taro (ID:1)');
    }

    const title = await page.locator('h1').innerText().catch(() => 'NOT FOUND');
    console.log('Page H1:', title);

    // 利用者名が表示されているか
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('の支援手順')).toBeVisible();

    // 手順カードが表示されていることを確認
    const cards = page.locator('[data-testid^="kiosk-procedure-card-"]');
    const count = await cards.count();
    
    // 手順が登録されている場合はカードが表示される
    if (count > 0) {
      await expect(cards.first()).toBeVisible();
      await expect(page.getByText('実施状況:')).toBeVisible();
    } else {
      await expect(page.getByText('本日の支援手順が設定されていません')).toBeVisible();
    }
  });

  test('should navigate back to user selection from procedure list', async ({ page }) => {
    await page.getByTestId('kiosk-procedure-list-back').click({ force: true });
    await expect(page).toHaveURL(/\/kiosk\/users(\?.*)?$/);
  });
});
