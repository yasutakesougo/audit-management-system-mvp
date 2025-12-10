import { expect, test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

// シナリオ概要:
// - /daily から支援手順記録 (タイムライン版) を開く
// - userId/date 付き deeplink で利用者が自動選択されることを検証
// - data attributes を通じて選択状態・対象日が反映されていることを確認

test.describe('Daily support deeplink (time-based) smoke', () => {
  test('auto-selects user from query params and stays stable from menu', async ({ page }) => {
    await primeOpsEnv(page);

    // 1) /daily menu から支援手順記録を開く
    await page.goto('/daily', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('daily-record-menu').waitFor();
    await page.getByTestId('btn-open-support').click();
    await expect(page).toHaveURL(/\/daily\/support/);
    await page.getByTestId('iceberg-time-based-support-record-page').waitFor();

    // 2) deeplink で userId/date 指定
    const targetUserId = 'UX-001';
    const targetDate = '2025-12-09';
    await page.goto(`/daily/support?userId=${encodeURIComponent(targetUserId)}&date=${targetDate}`, {
      waitUntil: 'domcontentloaded'
    });

    const root = page.getByTestId('iceberg-time-based-support-record-page');
    await expect(root).toHaveAttribute('data-user-id', 'UX001');
    await expect(root).toHaveAttribute('data-target-date', targetDate);

    // 選択済みユーザーのチップが表示され、data-user-id が正規化されている
    const selectedUserChip = page.getByTestId('support-selected-user');
    await expect(selectedUserChip).toBeVisible();
    await expect(selectedUserChip).toHaveAttribute('data-user-id', 'UX001');

    // 対象日のチップが表示されること
    await expect(page.getByTestId('support-target-date')).toContainText(targetDate);

    // Doパネルが描画されていること（ロック状態でもよい）
    await expect(page.getByTestId('record-panel')).toBeVisible();
  });
});
