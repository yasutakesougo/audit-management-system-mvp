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
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-page"]');
  });

  test('should display dashboard with main components', async ({ page }) => {
    // Check dashboard page loads
    await expect(page.getByTestId('dashboard-page')).toBeVisible();

    // Check Safety HUD is visible
    await expect(page.getByTestId('dashboard-safety-hud')).toBeVisible();

    // Staff cards should be visible
    await expect(page.getByRole('heading', { name: /朝会情報（9:00）/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /夕会情報（17:15）/ })).toBeVisible();
  });

  test('should show meeting guide actions', async ({ page }) => {
    await expect(page.getByRole('button', { name: '朝会ガイド' })).toBeVisible();
    await expect(page.getByRole('button', { name: '夕会ガイド' })).toBeVisible();
    await expect(page.getByRole('button', { name: '申し送りタイムライン' })).toBeVisible();
  });

  test('should display Safety HUD with indicators', async ({ page }) => {
    const safetyHUD = page.getByTestId('safety-hud');
    await expect(safetyHUD).toBeVisible();

    // Should show safety status
    await expect(safetyHUD.getByText(/今日の安全インジケーター/)).toBeVisible();

    // Should show conflict information
    await expect(safetyHUD.getByText(/予定の重なり/)).toBeVisible();
  });

  test('should handle direct URL navigation with meeting mode', async ({ page }) => {
    // Navigate directly to morning mode
    await page.goto('/dashboard?mode=morning');
    await page.waitForSelector('[data-testid="dashboard-page"]');
    await expect(page.getByRole('heading', { name: /朝会情報（9:00）/ })).toBeVisible();

    // Navigate directly to evening mode
    await page.goto('/dashboard?mode=evening');
    await page.waitForSelector('[data-testid="dashboard-page"]');
    await expect(page.getByRole('heading', { name: /夕会情報（17:15）/ })).toBeVisible();
  });

  test('should show time-based meeting status correctly', async ({ page }) => {
    // Meeting status should be displayed in Safety HUD or header
    // The exact content depends on current time, so we check for presence
    const pageContent = await page.textContent('body');

    // Should show some form of time indicator
    expect(pageContent).toMatch(/\d{1,2}:\d{2}|朝会|夕会|進行中|開始まで/);
  });

  test('should display staff meeting content blocks', async ({ page }) => {
    await expect(page.getByText('本日の優先予定（スタッフレーン）')).toBeVisible();
    await expect(page.getByText('本日の振り返り')).toBeVisible();
  });
});