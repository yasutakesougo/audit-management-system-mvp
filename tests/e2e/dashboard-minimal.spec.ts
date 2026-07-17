import { expect, test } from '@playwright/test';

test.describe('Dashboard Phase II - Minimal E2E', () => {
  test('Dashboard page loads successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dashboardPage = page.getByTestId('dashboard-page');
    await expect(dashboardPage).toBeVisible();
    await expect(dashboardPage.getByRole('heading', { name: '運営状況' })).toBeVisible();

    console.log('✅ Dashboard page loads successfully');
  });

  test('Safety HUD is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Safety HUD セクション確認
    const safetyHUD = page.getByTestId('dashboard-briefing-hud');
    await expect(safetyHUD).toBeVisible();

    console.log('✅ Safety HUD is visible');
  });

  test('Page contains expected content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dashboardPage = page.getByTestId('dashboard-page');
    await expect(dashboardPage).toContainText('運営状況');

    console.log('✅ Dashboard contains expected content');
  });
});
