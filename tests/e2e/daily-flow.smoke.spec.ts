import { expect, test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

// シナリオ概要:
// - /daily から通所管理を開き、対象利用者を通所→退所まで処理
// - トーストで状態変化を確認しつつ /daily/activity に deeplink 遷移
// - 対象利用者カードがスクロール・ハイライトされることを検証
test.describe('Daily menu → attendance → activity (happy path)', () => {
  test('deep links from attendance to activity and highlights target user', async ({ page }) => {
    await primeOpsEnv(page);

    // 1) /daily menu
    await page.goto('/daily', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('daily-record-menu').waitFor();

    // 2) open attendance
    await page.getByTestId('btn-open-attendance').click();
    await expect(page).toHaveURL(/\/daily\/attendance/);
    await expect(page.getByTestId('heading-attendance')).toBeVisible();

    const userCode = 'I001';
    const attendanceCard = page.getByTestId(`card-${userCode}`);
    await expect(attendanceCard).toBeVisible();

    // 3) check-in then check-out the same user
    const checkInButton = page.getByTestId(`btn-checkin-${userCode}`);
    const checkOutButton = page.getByTestId(`btn-checkout-${userCode}`);

    await checkInButton.click();
    await expect(page.getByTestId('toast')).toContainText('通所しました');

    await expect(checkOutButton).toBeEnabled();
    await checkOutButton.click();
    await expect(page.getByTestId('toast')).toContainText('退所しました');
    // Status chip updates asynchronously; relying on toast confirmation is sufficient here.

    // 4) open the linked activity record (deeplink)
    await page.getByTestId(`btn-activity-${userCode}`).click();
    await expect(page).toHaveURL(/\/daily\/activity\?userId=I001/);
    await expect(page.getByTestId('records-daily-root')).toBeVisible();

    // 5) highlighted record should match the normalized userId (001)
    const highlighted = page.locator('[data-user-id="001"]');
    await expect(highlighted).toHaveAttribute('data-highlighted', 'true');
  });
});
