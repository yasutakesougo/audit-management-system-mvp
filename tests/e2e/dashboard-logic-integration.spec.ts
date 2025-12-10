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

    // Check tab navigation is present
    await expect(page.getByTestId('dashboard-tabs')).toBeVisible();

    // Check Safety HUD is visible
    await expect(page.getByTestId('safety-hud')).toBeVisible();
  });

  test('should have all main tabs available', async ({ page }) => {
    // Overview tab
    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-overview')).toContainText('今日の全体状況');

    // Morning meeting tab
    await expect(page.getByTestId('tab-morning')).toBeVisible();
    await expect(page.getByTestId('tab-morning')).toContainText('朝のミーティング');

    // Evening meeting tab
    await expect(page.getByTestId('tab-evening')).toBeVisible();
    await expect(page.getByTestId('tab-evening')).toContainText('夕方のミーティング');
  });

  test('should switch between tabs correctly', async ({ page }) => {
    // Start on overview tab (default)
    await expect(page.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');

    // Click morning tab
    await page.getByTestId('tab-morning').click();
    await expect(page.getByTestId('tab-morning')).toHaveAttribute('aria-selected', 'true');

    // Click evening tab
    await page.getByTestId('tab-evening').click();
    await expect(page.getByTestId('tab-evening')).toHaveAttribute('aria-selected', 'true');

    // Return to overview
    await page.getByTestId('tab-overview').click();
    await expect(page.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
  });

  test('should handle meeting mode buttons', async ({ page }) => {
    // Morning mode button should be visible
    await expect(page.getByTestId('btn-morning-mode')).toBeVisible();
    await expect(page.getByTestId('btn-morning-mode')).toContainText('朝会モード');

    // Evening mode button should be visible
    await expect(page.getByTestId('btn-evening-mode')).toBeVisible();
    await expect(page.getByTestId('btn-evening-mode')).toContainText('夕会モード');
  });

  test('should activate morning meeting mode', async ({ page }) => {
    // Click morning mode button
    await page.getByTestId('btn-morning-mode').click();

    // URL should include morning mode parameter
    await expect(page).toHaveURL(/mode=morning/);

    // Morning mode button should appear active (contained variant)
    const morningBtn = page.getByTestId('btn-morning-mode');
    await expect(morningBtn).toBeVisible();

    // Tab should auto-switch to morning tab
    await expect(page.getByTestId('tab-morning')).toHaveAttribute('aria-selected', 'true');
  });

  test('should activate evening meeting mode', async ({ page }) => {
    // Click evening mode button
    await page.getByTestId('btn-evening-mode').click();

    // URL should include evening mode parameter
    await expect(page).toHaveURL(/mode=evening/);

    // Evening mode button should appear active
    const eveningBtn = page.getByTestId('btn-evening-mode');
    await expect(eveningBtn).toBeVisible();

    // Tab should auto-switch to evening tab
    await expect(page.getByTestId('tab-evening')).toHaveAttribute('aria-selected', 'true');
  });

  test('should synchronize tab changes with meeting modes', async ({ page }) => {
    // Click morning tab - should activate morning mode
    await page.getByTestId('tab-morning').click();

    // Should navigate to morning mode
    await page.waitForURL(/mode=morning/);
    await expect(page.getByTestId('tab-morning')).toHaveAttribute('aria-selected', 'true');

    // Click evening tab - should activate evening mode
    await page.getByTestId('tab-evening').click();

    // Should navigate to evening mode
    await page.waitForURL(/mode=evening/);
    await expect(page.getByTestId('tab-evening')).toHaveAttribute('aria-selected', 'true');

    // Click overview tab - should clear mode
    await page.getByTestId('tab-overview').click();

    // Should return to normal mode (no mode parameter)
    await expect(page).toHaveURL(/^[^?]*(\?(?!.*mode=).*)?$/);
    await expect(page.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
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

    // Should start with morning tab selected
    await expect(page.getByTestId('tab-morning')).toHaveAttribute('aria-selected', 'true');

    // Navigate directly to evening mode
    await page.goto('/dashboard?mode=evening');
    await page.waitForSelector('[data-testid="dashboard-page"]');

    // Should start with evening tab selected
    await expect(page.getByTestId('tab-evening')).toHaveAttribute('aria-selected', 'true');
  });

  test('should show time-based meeting status correctly', async ({ page }) => {
    // Meeting status should be displayed in Safety HUD or header
    // The exact content depends on current time, so we check for presence
    const pageContent = await page.textContent('body');

    // Should show some form of time indicator
    expect(pageContent).toMatch(/\d{1,2}:\d{2}|朝会|夕会|進行中|開始まで/);
  });

  test('should maintain state when navigating between modes', async ({ page }) => {
    // Start in morning mode
    await page.getByTestId('btn-morning-mode').click();
    await expect(page).toHaveURL(/mode=morning/);

    // Switch to evening mode
    await page.getByTestId('btn-evening-mode').click();
    await expect(page).toHaveURL(/mode=evening/);

    // Return to overview
    await page.getByTestId('tab-overview').click();

    // Should be back to normal mode
    await expect(page).toHaveURL(/^[^?]*(\?(?!.*mode=).*)?$/);
    await expect(page.getByTestId('tab-overview')).toHaveAttribute('aria-selected', 'true');
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Focus on tabs
    await page.getByTestId('dashboard-tabs').focus();

    // Use arrow keys to navigate tabs
    await page.keyboard.press('ArrowRight');

    // Should move focus to next tab
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should display appropriate content for each tab', async ({ page }) => {
    // Overview tab content
    await page.getByTestId('tab-overview').click();
    await expect(page.getByText(/今日の全体状況|Safety HUD/)).toBeVisible();

    // Morning tab content
    await page.getByTestId('tab-morning').click();
    await expect(page.getByText(/朝のミーティング|朝会/)).toBeVisible();

    // Evening tab content
    await page.getByTestId('tab-evening').click();
    await expect(page.getByText(/夕方のミーティング|夕会/)).toBeVisible();
  });
});