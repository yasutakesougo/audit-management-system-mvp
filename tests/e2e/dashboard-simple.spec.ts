/**
 * Dashboard Page Integration Test - Simple Version
 *
 * Tests core Dashboard functionality after logic separation
 */

import { expect, test } from '@playwright/test';

test.describe('Dashboard Page Integration (Simple)', () => {
  test('should load dashboard page basic functionality', async ({ page }) => {
    // Navigate with longer timeout
    await page.goto('/dashboard', { timeout: 30000 });

    // Wait for page to be ready with a generous timeout
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check if page has loaded by looking for React root
    const hasReactRoot = await page.locator('#root').isVisible();
    expect(hasReactRoot).toBe(true);

    // Check for basic dashboard elements with fallbacks
    const hasDashboard = await page.locator('text=Dashboard').or(page.locator('text=ダッシュボード')).first().isVisible();
    const hasTabs = await page.locator('[role="tablist"]').or(page.locator('text=朝')).first().isVisible();

    // At least one should be present
    expect(hasDashboard || hasTabs).toBe(true);
  });

  test('should have meeting mode functionality accessible', async ({ page }) => {
    await page.goto('/dashboard', { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Look for meeting-related content
    const hasMorningContent = await page.locator('text=朝').or(page.locator('text=morning')).first().isVisible();
    const hasEveningContent = await page.locator('text=夕').or(page.locator('text=evening')).first().isVisible();

    // Meeting functionality should be present
    expect(hasMorningContent || hasEveningContent).toBe(true);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/dashboard', { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Give React time to initialize
    await page.waitForTimeout(2000);

    // Filter out common non-critical errors
    const criticalErrors = errors.filter(error =>
      !error.includes('favicon') &&
      !error.includes('sourcemap') &&
      !error.includes('404')
    );

    expect(criticalErrors.length).toBe(0);
  });
});