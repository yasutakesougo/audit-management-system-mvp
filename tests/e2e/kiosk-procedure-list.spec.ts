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
    await expect(page.getByText('桂川 進太朗')).toBeVisible();
    await expect(page.getByText('実施状況:')).toBeVisible();
  });

  test('should parse and display selected date from URL parameter', async ({ page }) => {
    await bootKiosk(page, { route: '/kiosk/users/1/procedures?date=2026-05-07', userId: '1' });

    await expect(page).toHaveURL(/\/kiosk\/users\/1\/procedures\?date=2026-05-07/);
    await expect(page.getByText('2026年5月7日 の支援手順')).toBeVisible({ timeout: 10000 });
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

  test('should prioritize query userId over route param and avoid setup CTA when support start date is resolved', async ({ page }) => {
    await bootKiosk(page, {
      route: '/kiosk/users/6/procedures?wizard=plan&user=I005&userId=I005',
      userId: 'I005',
    });

    await expect(page).toHaveURL(/\/kiosk\/users\/6\/procedures\?wizard=plan&user=I005&userId=I005&provider=memory/);
    await expect(page.getByText('石渡')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/支援開始日: .*（90日参考・(支援計画|利用者マスタ)）/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/支援開始日: 未設定（90日参考）/)).toHaveCount(0);
    await expect(page.getByText(/\[暫定\] 支援開始日:/)).toHaveCount(0);
    await expect(page.getByTestId('kiosk-support-start-setup-cta')).toHaveCount(0);
    await expect(page.getByText('支援計画シートを作成して支援開始日を設定')).toHaveCount(0);
  });

  test('should display procedure as recorded when its status is skipped', async ({ page }) => {
    await bootKiosk(page, {
      route: '/kiosk/users/1/procedures',
      userId: 'U-001',
      records: [
        { scheduleItemId: 'seed-U-001-1', status: 'skipped' }
      ]
    });

    await expect(page.getByText('の支援手順')).toBeVisible({ timeout: 10000 });

    const firstCard = page.getByTestId('kiosk-procedure-card-0');
    await expect(firstCard.getByText('記録済み')).toBeVisible();
    await expect(firstCard.getByText('未実施')).toHaveCount(0);
  });
});
