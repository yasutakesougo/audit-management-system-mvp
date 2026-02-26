import { expect, test } from '@playwright/test';

test.describe('Dashboard Phase II - Minimal E2E', () => {
  test('Dashboard page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-page')).toBeVisible();

    // 基本的なページロード確認
    await expect(page).toHaveTitle(/Audit Management/);

    // Dashboard ページ要素の確認
    const dashboardPage = page.getByTestId('dashboard-page');
    await expect(dashboardPage).toBeVisible();

    console.log('✅ Dashboard page loads successfully');
  });

  test('Safety HUD is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-page')).toBeVisible();

    // Safety HUD セクション確認
    const safetyHUD = page.getByTestId('dashboard-safety-hud');
    await expect(safetyHUD).toBeVisible();

    console.log('✅ Safety HUD is visible');
  });

  test('Page contains expected content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-page')).toBeVisible();

    // 重要なキーワードが含まれていることを確認 - 実際のコンテンツに基づく
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Safety HUD'); // Safety HUDは確実に存在

    console.log('✅ Dashboard contains expected content');
  });
});
