import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';

test.describe('Kiosk Home Smoke (memory provider for local kiosk flow checks)', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
  });

  test.beforeEach(async ({ page }) => {
    // bootKiosk defaults to provider=memory for local/demo E2E stability.
    // This does not represent production kiosk storage mode (SharePoint-fixed).
    await bootKiosk(page, { route: '/kiosk' });
  });

  test('should preserve provider/kiosk/date query params across main kiosk procedure flow', async ({ page }) => {
    const expectedDate = '2026-05-08';
    await bootKiosk(page, { route: `/kiosk?kiosk=1&date=${expectedDate}` });

    const expectCoreQueryParams = async () => {
      const current = new URL(page.url());
      expect(current.searchParams.get('provider')).toBe('memory');
      expect(current.searchParams.get('kiosk')).toBe('1');
      expect(current.searchParams.get('date')).toBe(expectedDate);
    };

    await expectCoreQueryParams();

    await page.getByTestId('kiosk-action-execute-steps').click();
    await expect(page).toHaveURL(/\/kiosk\/users/);
    await expectCoreQueryParams();

    const firstUserCard = page.locator('[data-testid^="kiosk-user-card-"]').first();
    await expect(firstUserCard).toBeVisible();
    await firstUserCard.click();
    await expect(page).toHaveURL(/\/kiosk\/users\/.+\/procedures/);
    await expectCoreQueryParams();

    await page.getByTestId('kiosk-procedure-card-0').click();
    await expect(page).toHaveURL(/\/kiosk\/users\/.+\/procedures\/\d+/);
    await expectCoreQueryParams();

    await page.getByTestId('kiosk-procedure-detail-back').click();
    await expect(page).toHaveURL(/\/kiosk\/users\/.+\/procedures\/?(\?.*)?$/);
    await expectCoreQueryParams();

    await page.getByTestId('kiosk-procedure-list-back').click();
    await expect(page).toHaveURL(/\/kiosk\/users(\?.*)?$/);
    await expectCoreQueryParams();

    await page.getByTestId('kiosk-user-select-back').click();
    await expect(page).toHaveURL(/\/kiosk(\?.*)?$/);
    await expectCoreQueryParams();
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
      await expect(page.getByTestId('kiosk-nav-toilet')).toBeVisible({ timeout: 15000 });
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

    test('should navigate to toilet board and mark a target user recorded', async ({ page }) => {
      await page.getByTestId('kiosk-nav-toilet').click();

      await expect(page).toHaveURL(/\/kiosk\/toilet(\?.*provider=memory.*)?/);
      await expect(page.getByTestId('toilet-daily-board')).toBeVisible();
      await expect(page.getByTestId('toilet-board-summary')).toContainText('未記録 1名 / 記録済み 0名');

      await page.getByTestId('toilet-record-button-I005').click();
      await expect(page.getByRole('heading', { name: /石渡 由喜子さんのトイレ記録/ })).toBeVisible();
      await page.getByTestId('toilet-record-save').click();

      await expect(page.getByTestId('toilet-board-summary')).toContainText('未記録 0名 / 記録済み 1名');
      await expect(page.getByTestId('toilet-user-latest-I005')).toContainText('排尿 普通');
      await expect(page.getByTestId('toilet-record-history')).toContainText('本日の全記録（個人別）');
      await expect(page.getByTestId('toilet-history-user-I005')).toContainText('石渡 由喜子');
      await expect(page.getByTestId('toilet-history-user-I005')).toContainText('1件');
    });

    test('should keep schedule navigation active after schedule route redirects', async ({ page }) => {
      await bootKiosk(page, { route: '/kiosk?kiosk=1' });

      const scheduleNav = page.getByTestId('kiosk-nav-schedule');
      await scheduleNav.click();

      await expect(page).toHaveURL(/\/schedules/);
      await expect(scheduleNav).toHaveAttribute('aria-current', 'page');
    });

    test('should keep exit FAB above the bottom navigation', async ({ page }) => {
      const fabBox = await page.getByTestId('kiosk-exit-fab').boundingBox();
      const navBox = await page.getByTestId('kiosk-navigation').boundingBox();

      expect(fabBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(fabBox!.y + fabBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
    });

    test('should not display regular footer actions twice', async ({ page }) => {
      // 既存の FooterQuickActions のテスト ID が kiosk-nav-* 以外で存在しないことを確認
      const regularFooterAction = page.getByTestId('footer-action-call-log-quick');
      await expect(regularFooterAction).toHaveCount(0);
    });
  });
});
