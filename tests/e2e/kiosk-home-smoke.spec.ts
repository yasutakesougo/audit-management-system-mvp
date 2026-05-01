import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';

test.describe('Kiosk Home Smoke', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test.beforeEach(async ({ page }) => {
    await bootKiosk(page, { route: '/kiosk' });
  });

  test('should display kiosk home page with action buttons and no sidebar', async ({ page }) => {
    // 1. タイトルと説明の確認
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible();
    await expect(page.getByText('今日の操作を選んでください')).toBeVisible();

    // 2. 4つの大ボタンが表示されていることを確認
    await expect(page.getByTestId('kiosk-action-execute-steps')).toBeVisible();
    await expect(page.getByTestId('kiosk-action-attendance')).toBeVisible();
    await expect(page.getByTestId('kiosk-action-leave')).toBeVisible();
    await expect(page.getByTestId('kiosk-action-schedule')).toBeVisible();

    // 3. 最上位導線が「支援手順を実施する」であることを確認（テキストが含まれているか）
    await expect(page.getByTestId('kiosk-action-execute-steps')).toHaveText(/支援手順を実施する/);

    // 4. 通常のナビゲーション（サイドバーやヘッダー）が非表示であることを確認
    // AppShellState の isFullscreenMode によりサイドバーとヘッダーは消えるはず
    const sidebar = page.getByTestId('app-shell-sidebar'); // navigationConfig 等で定義されている可能性がある
    await expect(sidebar).toHaveCount(0);

    const header = page.getByTestId('app-shell-header');
    await expect(header).toHaveCount(0);

    // 5. AppShell に data-kiosk="true" が付与されていることを確認
    const appShell = page.getByTestId('app-shell');
    await expect(appShell).toHaveAttribute('data-kiosk', 'true');
  });
});
