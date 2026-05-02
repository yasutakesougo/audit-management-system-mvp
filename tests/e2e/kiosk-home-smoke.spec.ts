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
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('今日の操作を選んでください')).toBeVisible({ timeout: 15000 });

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
  
  test('should navigate to user selection and maintain search params', async ({ page }) => {
    await page.getByTestId('kiosk-action-execute-steps').click();
    await expect(page).toHaveURL(/\/kiosk\/users(\?.*provider=memory.*)?/);
  });

  test('should navigate to attendance (check-in) and maintain search params', async ({ page }) => {
    await page.getByTestId('kiosk-action-attendance').click();
    await expect(page).toHaveURL(/\/daily\/attendance(\?.*provider=memory.*)?/);
    await expect(page).toHaveURL(/.*mode=checkin.*/);
  });

  test('should navigate to attendance (check-out) and maintain search params', async ({ page }) => {
    await page.getByTestId('kiosk-action-leave').click();
    await expect(page).toHaveURL(/\/daily\/attendance(\?.*provider=memory.*)?/);
    await expect(page).toHaveURL(/.*mode=checkout.*/);
  });

  test('should navigate to today schedule and maintain search params', async ({ page }) => {
    await page.getByTestId('kiosk-action-schedule').click();
    // Redirects to /schedules/week?tab=day
    await expect(page).toHaveURL(/\/schedules\/week(\?.*provider=memory.*)?/);
    await expect(page).toHaveURL(/.*tab=day.*/);
  });

  test.describe('Kiosk Navigation Bar', () => {
    test('should display kiosk navigation bar with all actions', async ({ page }) => {
      await expect(page.getByTestId('kiosk-nav-home')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('kiosk-nav-schedule')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('kiosk-nav-attendance')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('kiosk-nav-activity')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('kiosk-nav-procedures')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('kiosk-nav-calllog')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('kiosk-nav-handoff')).toBeVisible({ timeout: 15000 });
    });

    test('should open call log drawer from navigation', async ({ page }) => {
      await page.getByTestId('kiosk-nav-calllog').click();
      await expect(page.getByRole('heading', { name: '新規受付' })).toBeVisible();
      // Close it
      await page.keyboard.press('Escape');
    });

    test('should open handoff dialog from navigation', async ({ page }) => {
      await page.getByTestId('kiosk-nav-handoff').click();
      await expect(page.getByTestId('handoff-quicknote-dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: '今すぐ申し送り' })).toBeVisible();
    });

    test('should navigate to records from navigation and maintain params', async ({ page }) => {
      await page.getByTestId('kiosk-nav-activity').click();
      await expect(page).toHaveURL(/\/daily\/table(\?.*provider=memory.*)?/);
    });

    test('should not display regular footer actions twice', async ({ page }) => {
      // 既存の FooterQuickActions のテスト ID が kiosk-nav-* 以外で存在しないことを確認
      const regularFooterAction = page.getByTestId('footer-action-call-log-quick');
      await expect(regularFooterAction).toHaveCount(0);
    });
  });
});
