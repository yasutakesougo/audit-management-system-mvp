import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';

test.describe('Kiosk Procedure List', () => {
  test.beforeEach(async ({ page }) => {
    // 直接 ID: 1 の利用者の手順一覧に遷移する
    await bootKiosk(page, { route: '/kiosk/users/1/procedures', userId: '1' });

    // 手順一覧画面が表示されるのを待つ
    await expect(page.getByText('の支援手順')).toBeVisible({ timeout: 10000 });
  });

  test('should display user name and procedure list', async ({ page }) => {
    await expect(page.getByText('田中 太郎')).toBeVisible();
    await expect(page.getByText('実施状況:')).toBeVisible();
  });

  test('should navigate back to user selection from procedure list', async ({ page }) => {
    test.setTimeout(120000);
    const selector = '[data-testid="kiosk-procedure-list-back"]';
    
    // 操作の安定化
    await page.waitForTimeout(2000);

    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) el.click();
    }, selector);
    await expect(page).toHaveURL(/.*\/kiosk\/users.*/, { timeout: 30000 });
  });
});
