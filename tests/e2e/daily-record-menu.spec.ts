/**
 * Daily Record Menu Page E2E Tests
 *
 * Tests the main daily record hub page navigation and user flows
 */

import { expect, test } from '@playwright/test';

test.describe('Daily Record Menu Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to daily record menu page
    await page.goto('/daily');
    await page.waitForSelector('[data-testid="daily-record-menu"]');
  });

  test('should display page header and description', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h1')).toHaveText('日次記録システム');

    // Check subtitle
    await expect(page.getByText('記録の種類を選択してください')).toBeVisible();
  });

  test('should display all three main cards', async ({ page }) => {
    // Activity card
    await expect(page.getByTestId('daily-card-table-activity').or(page.getByTestId('daily-card-activity')).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /一覧形式ケース記録|支援記録（ケース記録）/ })).toBeVisible();

    // Attendance card
    await expect(page.getByTestId('daily-card-attendance')).toBeVisible();
    await expect(page.getByRole('heading', { name: '通所管理' })).toBeVisible();

    // Support card
    await expect(page.getByTestId('daily-card-support')).toBeVisible();
    await expect(page.getByRole('heading', { name: '支援手順記録' })).toBeVisible();
  });

  test('should navigate to activity log page', async ({ page }) => {
    // Click activity button
    await page.getByTestId('btn-open-table-activity').or(page.getByTestId('btn-open-activity')).first().click();

    // Should navigate to activity page
    await expect(page).toHaveURL(/\/daily\/(table|activity)/);
  });

  test('should navigate to attendance management page', async ({ page }) => {
    // Click attendance button
    await page.getByTestId('btn-open-attendance').click();

    // Should navigate to attendance page
    await expect(page).toHaveURL(/\/daily\/attendance$/);
  });

  test('should navigate to support procedure page', async ({ page }) => {
    // Click support button
    await page.getByTestId('btn-open-support').click();

    // Should navigate to support page
    await expect(page).toHaveURL(/\/daily\/support$/);
  });

  test('should display statistics summary', async ({ page }) => {
    const statsSection = page.getByTestId('daily-stats-summary');
    await expect(statsSection).toBeVisible();

    // Check stats title
    await expect(statsSection.getByText('本日の記録状況')).toBeVisible();

    // Check activity stats
    const activityStats = page.getByTestId('daily-stats-activity');
    await expect(activityStats.getByText('支援記録（ケース記録） 記録済み')).toBeVisible();

    // Check attendance stats
    const attendanceStats = page.getByTestId('daily-stats-attendance');
    await expect(attendanceStats.getByText('通所管理 進捗')).toBeVisible();

    // Check support stats
    const supportStats = page.getByTestId('daily-stats-support');
    await expect(supportStats.getByText('支援手順記録 記録済み')).toBeVisible();
  });

  test('should display percentage completion safely', async ({ page }) => {
    // Wait for user data to load (mock data simulation)
    await page.waitForTimeout(1000);

    // Check that percentages are displayed
    const activityStats = page.getByTestId('daily-stats-activity');
    await expect(activityStats.locator(':text("% 完了")')).toBeVisible();

    const attendanceStats = page.getByTestId('daily-stats-attendance');
    await expect(attendanceStats.locator(':text("% 完了")')).toBeVisible();

    const supportStats = page.getByTestId('daily-stats-support');
    await expect(supportStats.locator(':text("% 完了")')).toBeVisible();
  });

  test('should show card hover effects', async ({ page }) => {
    const activityCard = page.getByTestId('daily-card-table-activity').or(page.getByTestId('daily-card-activity')).first();

    // Get initial position
    const initialBox = await activityCard.boundingBox();

    // Hover over card
    await activityCard.hover();

    // Card should move up slightly (transform: translateY(-4px))
    // Note: This is a visual test, checking CSS transform
    const hoverBox = await activityCard.boundingBox();
    expect(hoverBox?.y).toBeLessThan(initialBox?.y || 0);
  });

  test('should display user count information', async ({ page }) => {
    // Activity card should show total users
    const activityCard = page.getByTestId('daily-card-table-activity').or(page.getByTestId('daily-card-activity')).first();
    await expect(activityCard.getByText(/対象：(選択した複数利用者|利用者全員（\d+名）)/)).toBeVisible();

    // Attendance card should show total users
    const attendanceCard = page.getByTestId('daily-card-attendance');
    await expect(attendanceCard.getByText(/対象：日次通所者（\d+名）/)).toBeVisible();

    // Support card should show intensive support users with special badge
    const supportCard = page.getByTestId('daily-card-support');
    await expect(supportCard.getByText(/対象：強度行動障害者（\d+名）/)).toBeVisible();
    await expect(supportCard.getByText('⚑ 特別支援')).toBeVisible();
  });

  test('should handle zero users safely', async ({ page }) => {
    // Mock empty users response at the network level
    await page.route('**/api/users**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Navigate to page after setting up mock
    await page.goto('/daily');
    await page.waitForSelector('[data-testid="daily-record-menu"]');

    // Wait for any loading states to complete
    await page.waitForTimeout(500);

    // Should show users count without crashing (may show default mock values)
    const activityCard = page.getByTestId('daily-card-table-activity').or(page.getByTestId('daily-card-activity')).first();
    const attendanceCard = page.getByTestId('daily-card-attendance');
    const supportCard = page.getByTestId('daily-card-support');

    // Check that user count displays are present (content may vary based on mocks)
    await expect(activityCard.getByText(/対象：(選択した複数利用者|利用者全員（\d+名）)/)).toBeVisible();
    await expect(attendanceCard.getByText(/対象：日次通所者（\d+名）/)).toBeVisible();
    await expect(supportCard.getByText(/対象：強度行動障害者（\d+名）/)).toBeVisible();

    // Most importantly: percentages should be valid numbers not NaN%
    const statsSection = page.getByTestId('daily-stats-summary');
    await expect(statsSection).toBeVisible();

    // Check that percentage displays don't contain 'NaN%'
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('NaN%');
    expect(pageContent).not.toContain('Infinity%');
  });

  test('should display feature lists correctly', async ({ page }) => {
    // Activity card features
    const activityCard = page.getByTestId('daily-card-table-activity').or(page.getByTestId('daily-card-activity')).first();
    await expect(activityCard.getByText('📋 利用者＝行、項目＝列の表形式')).toBeVisible();
    await expect(activityCard.getByText('⚡ AM活動・PM活動・昼食・問題行動を横並び')).toBeVisible();
    await expect(activityCard.getByText('🎯 タブ移動でサクサク入力')).toBeVisible();
    await expect(activityCard.getByText('🔍 検索・フィルタで利用者選択')).toBeVisible();

    // Attendance card features
    const attendanceCard = page.getByTestId('daily-card-attendance');
    await expect(attendanceCard.getByText('• 通所・退所のワンタップ操作')).toBeVisible();
    await expect(attendanceCard.getByText('• 欠席連絡・夕方確認の記録')).toBeVisible();
    await expect(attendanceCard.getByText('• 送迎状況や欠席加算の管理')).toBeVisible();
    await expect(attendanceCard.getByText('• 実提供時間と算定時間の乖離チェック')).toBeVisible();

    // Support card features
    const supportCard = page.getByTestId('daily-card-support');
    await expect(supportCard.getByText('• 個別支援計画テンプレート')).toBeVisible();
    await expect(supportCard.getByText('• 1日19行の支援手順展開')).toBeVisible();
    await expect(supportCard.getByText('• 本人の様子・反応記録')).toBeVisible();
    await expect(supportCard.getByText('• 支援効果の観察・評価')).toBeVisible();
    await expect(supportCard.getByText('• 手順変更・改善点の記録')).toBeVisible();
  });
});