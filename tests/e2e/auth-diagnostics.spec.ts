import { test, expect } from '@playwright/test';

test.describe('Auth Diagnostics', () => {
  test('collects and retrieves diagnostic events via DevTools API', async ({ page }) => {
    // Navigate to home page (public route)
    await page.goto('/');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Check if DevTools API is available (only in dev mode)
    const hasDevTools = await page.evaluate(() => {
      return typeof (window as any).__authDiagnostics !== 'undefined';
    });
    
    if (!hasDevTools) {
      test.skip(true, 'DevTools API not available (production mode)');
      return;
    }
    
    // Inject test event via DevTools API
    await page.evaluate(() => {
      const diagnostics = (window as any).__authDiagnostics;
      diagnostics.collect({
        route: '/test/e2e',
        reason: 'network-error',
        outcome: 'blocked',
        userId: 'e2e-test-user',
        detail: { test: true, source: 'playwright' },
      });
    });
    
    // Verify event was collected
    const events = await page.evaluate(() => {
      const diagnostics = (window as any).__authDiagnostics;
      return diagnostics.getRecent(10);
    });
    
    expect(events.length).toBeGreaterThan(0);
    
    // Verify the test event is present
    const testEvent = events.find((evt: any) => evt.route === '/test/e2e');
    expect(testEvent).toBeDefined();
    expect(testEvent).toMatchObject({
      reason: 'network-error',
      outcome: 'blocked',
      route: '/test/e2e',
    });
    
    // Verify event has required fields
    expect(testEvent).toHaveProperty('timestamp');
    expect(testEvent).toHaveProperty('correlationId');
  });

  test('provides stats API', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const hasDevTools = await page.evaluate(() => {
      return typeof (window as any).__authDiagnostics !== 'undefined';
    });
    
    if (!hasDevTools) {
      test.skip(true, 'DevTools API not available (production mode)');
      return;
    }
    
    // Collect multiple events
    await page.evaluate(() => {
      const diagnostics = (window as any).__authDiagnostics;
      
      diagnostics.collect({
        route: '/test/stats-1',
        reason: 'login-failure',
        outcome: 'blocked',
      });
      
      diagnostics.collect({
        route: '/test/stats-2',
        reason: 'login-failure',
        outcome: 'recovered',
      });
    });
    
    // Get stats
    const stats = await page.evaluate(() => {
      const diagnostics = (window as any).__authDiagnostics;
      return diagnostics.getStats();
    });
    
    // Verify stats structure
    expect(stats).toHaveProperty('totalEvents');
    expect(stats).toHaveProperty('byReason');
    expect(stats).toHaveProperty('byOutcome');
    expect(stats).toHaveProperty('recoveryRate');
    expect(stats.totalEvents).toBeGreaterThan(0);
  });

  test('does not expose API in production mode', async ({ page }) => {
    // This test checks that DevTools API is properly gated by dev mode
    // In CI/production, __authDiagnostics should NOT be available
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const isDev = await page.evaluate(() => {
      // Check if we're in dev mode
      return import.meta.env?.DEV === true;
    });
    
    const hasDevTools = await page.evaluate(() => {
      return typeof (window as any).__authDiagnostics !== 'undefined';
    });
    
    // In dev mode, API should exist; in production, it should not
    if (isDev) {
      expect(hasDevTools).toBe(true);
    } else {
      expect(hasDevTools).toBe(false);
    }
  });
});
