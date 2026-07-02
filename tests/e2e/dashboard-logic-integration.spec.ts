/**
 * Dashboard Page E2E Tests
 *
 * Tests the main dashboard functionality including meeting modes,
 * Safety HUD, and tab navigation after logic separation.
 */

import { expect, test } from '@playwright/test';

test.describe('Dashboard Page - After Logic Separation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard page
    await page.goto('/dashboard?zeroscroll=0');
    await page.waitForSelector('[data-testid="dashboard-page"]');
  });

  test('should display dashboard with main components', async ({ page }) => {
    // Check dashboard page loads
    await expect(page.getByTestId('dashboard-page')).toBeVisible();

    // Check briefing HUD is visible
    await expect(page.getByTestId('dashboard-briefing-hud')).toBeVisible();

    // Core dashboard sections should be visible
    await expect(page.getByRole('heading', { name: '申し送りタイムライン' })).toBeVisible();
    await expect(page.getByTestId('dashboard-section-schedule').getByRole('heading', { name: '今日の予定' })).toBeVisible();
  });

  test('should show meeting guide actions', async ({ page }) => {
    await expect(page.getByRole('button', { name: '朝会・夕会情報' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'お部屋情報' })).toBeVisible();
    await expect(page.getByTestId('dashboard-handoff-summary').getByRole('button', { name: 'タイムライン' })).toBeVisible();
  });

  test('should display Safety HUD with indicators', async ({ page }) => {
    const safetyHUD = page.getByTestId('dashboard-briefing-hud');
    await expect(safetyHUD).toBeVisible();

    // Should show at least one alert chip
    await expect(safetyHUD.locator('[data-testid^="briefing-alert-"]').first()).toBeVisible();
  });

  test('should handle direct URL navigation with meeting mode', async ({ page }) => {
    // Navigate directly to morning mode
    await page.goto('/dashboard?mode=morning');
    await page.waitForSelector('[data-testid="dashboard-page"]');
    await expect(page.getByTestId('dashboard-briefing-hud')).toBeVisible();

    // Navigate directly to evening mode
    await page.goto('/dashboard?mode=evening');
    await page.waitForSelector('[data-testid="dashboard-page"]');
    await expect(page.getByTestId('dashboard-briefing-hud')).toBeVisible();
  });

  test('should show time-based meeting status correctly', async ({ page }) => {
    // Meeting status should be displayed in Safety HUD or header
    // The exact content depends on current time, so we check for presence
    const pageContent = await page.textContent('body');

    // Should show some form of time indicator
    expect(pageContent).toMatch(/\d{1,2}:\d{2}|朝会|夕会|進行中|開始まで/);
  });

  test('should display staff meeting content blocks', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '申し送りタイムライン' })).toBeVisible();
    await expect(page.getByText('今日の申し送り状況を把握して、必要に応じて詳細を確認してください。')).toBeVisible();
  });
});
