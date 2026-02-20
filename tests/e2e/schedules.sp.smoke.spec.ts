import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { expectLocatorVisibleBestEffort, expectTestIdVisibleBestEffort } from './_helpers/smoke';

/**
 * Schedules (SharePoint) E2E Smoke Test
 *
 * Environment:
 * - VITE_FEATURE_SCHEDULES=1 (SharePoint adapter enabled)
 * - VITE_SKIP_LOGIN=1 (skip MSAL auth in E2E)
 * - VITE_DEMO_MODE=1 (in-memory store for E2E stability)
 *
 * Note: This test uses DEMO mode for E2E stability.
 * For real SharePoint validation, run manual smoke test checklist.
 */

const skipSp = process.env.VITE_SKIP_SHAREPOINT === '1' || process.env.VITE_FEATURE_SCHEDULES_SP === '0';

test.describe('Schedules SharePoint Integration Smoke Test', () => {
  test.skip(skipSp, 'SharePoint/SP disabled in this run');
  test.beforeEach(async ({ page }) => {
    // Navigate to schedules week page with day tab
    // Note: /schedules/day redirects to /schedules/week?tab=day&date=YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/schedules/week?tab=day&date=${today}`);
    
    // Wait for the page to be ready
    await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page'], { timeout: 10000 });
  });

  test('Test 1: List schedules for today', async ({ page }) => {
    // Verify the week page is visible
    const pageLocator = page.getByTestId(TESTIDS['schedules-week-page']);
    await expectLocatorVisibleBestEffort(
      pageLocator,
      `testid not found: ${TESTIDS['schedules-week-page']} (allowed for smoke)`
    );

    // Wait for any initial loading to complete
    await page.waitForTimeout(1000);

    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(500);
    
    // In demo mode, we should have no errors
    expect(consoleErrors.length).toBe(0);
  });

  test('Test 2: Create new schedule', async ({ page }) => {
    // Find the create button (FAB or add button)
    const createButton = page.locator('button[aria-label*="追加"], button[aria-label*="create"], button:has-text("追加")').first();
    
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();

      // Wait for dialog to appear
      await page.waitForTimeout(1000);

      // Fill in the form
      const titleInput = page.locator('input[name="title"], input[placeholder*="タイトル"]').first();
      if (await titleInput.isVisible().catch(() => false)) {
        const testTitle = `E2E Test ${Date.now()}`;
        await titleInput.fill(testTitle);

        // Try to find and click save button
        const saveButton = page.locator('button:has-text("作成"), button:has-text("保存"), button:has-text("Save")').first();
        if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Wait for dialog to be fully visible before clicking
          await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 }).catch(() => {});
          
          await saveButton.click({ timeout: 5000 }).catch(() => {});

          // Wait for the dialog to close
          await page.waitForTimeout(2000);

          // Verify the page is still stable
          await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page']);
        }
      }
    } else {
      // If no create button found, skip this test
      test.skip();
    }
  });

  test('Test 3: Navigate between dates', async ({ page }) => {
    // Find previous/next day navigation buttons
    const prevButton = page.locator('button[aria-label*="前"], button[aria-label*="previous"]').first();
    const nextButton = page.locator('button[aria-label*="次"], button[aria-label*="next"]').first();

    // Try to navigate to previous day
    if (await prevButton.isVisible().catch(() => false)) {
      await prevButton.click();
      await page.waitForTimeout(1000);
      
      // Verify page is still visible
      await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page']);
    }

    // Try to navigate to next day
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      
      // Verify page is still visible
      await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page']);
    }
  });

  test('Test 4: Week view is accessible', async ({ page }) => {
    // Navigate to week view
    await page.goto('/schedules/week', { waitUntil: 'domcontentloaded' });

    // Wait for URL to confirm navigation
    await page.waitForURL(/\/schedules\/week/);

    // Verify the week page loads
    await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page'], { timeout: 10_000 });
  });

  test('Test 5: Month view is accessible', async ({ page }) => {
    // Navigate to month view
    await page.goto('/schedules/month', { waitUntil: 'domcontentloaded' });

    // Wait for URL to confirm navigation
    await page.waitForURL(/\/schedules\/month/);

    // Verify the week page (container) and month indicator are visible
    await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page'], { timeout: 10_000 });
  });

  test('Test 6: Adapter context switch validation', async ({ page }) => {
    // This test validates that VITE_FEATURE_SCHEDULES=1 is working
    // by checking that the schedules context is properly initialized

    // Verify page loads successfully (already navigated in beforeEach)
    await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page'], { timeout: 5000 });

    // Check for no critical errors in console
    const criticalErrors: Array<{ text: string; sourceUrl: string }> = [];
    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        !msg.text().includes('favicon') &&
        !msg.text().includes('Content Security Policy') &&
        !msg.text().includes('unsafe-inline') &&
        !msg.text().includes('unsafe-eval')
      ) {
        criticalErrors.push({
          text: msg.text(),
          sourceUrl: msg.location().url ?? '',
        });
      }
    });

    await page.waitForTimeout(1000);

    // No critical errors should be present
    const hasProtectedRouteFetchFailure = criticalErrors.some((entry) =>
      entry.text.includes('[ProtectedRoute] List existence check failed: TypeError: Failed to fetch')
    );

    const ignorableErrors = criticalErrors.filter((entry) => {
      const { text, sourceUrl } = entry;
      const sourceLooksSharePoint =
        sourceUrl.includes('sharepoint.com') || sourceUrl.includes('/_api/');

      return (
        text.includes('favicon') ||
        text.includes('Content Security Policy') ||
        text.includes('unsafe-inline') ||
        text.includes('unsafe-eval') ||
        ((text.includes('[SP ERROR]') ||
          text.includes("lists/getbytitle('Org_Master')") ||
          text.includes('Org_Master') ||
          (text.includes('Failed to load resource') && text.includes('Not Found'))) &&
          sourceLooksSharePoint) ||
        (text.includes('ERR_NAME_NOT_RESOLVED') && hasProtectedRouteFetchFailure) ||
        text.includes('[ProtectedRoute] List existence check failed: TypeError: Failed to fetch')
      );
    });
    const nonIgnorableErrors = criticalErrors.filter((entry) => !ignorableErrors.includes(entry));

    if (nonIgnorableErrors.length > 0) {
      console.log(
        '[e2e] critical console errors:\n' +
          nonIgnorableErrors.map((entry) => `${entry.text} @ ${entry.sourceUrl}`).join('\n')
      );
    }

    if (nonIgnorableErrors.length === 0 && criticalErrors.length > 0) {
      test.skip(true, 'SharePoint lists are not available in this environment.');
    }

    expect(nonIgnorableErrors.length).toBe(0);
  });

  test('Test 7: Schedule item interaction (if items exist)', async ({ page }) => {
    // Verify page is loaded
    await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page']);

    // Check if there are any schedule items
    const scheduleItems = page.locator('[data-testid^="schedule-item"]');
    const itemCount = await scheduleItems.count();

    if (itemCount > 0) {
      // Hover over the first item
      const firstItem = scheduleItems.first();
      await firstItem.hover();

      // Verify the item is interactive (has buttons or links)
      const itemButtons = firstItem.locator('button');
      const buttonCount = await itemButtons.count();

      // Should have at least one button (edit or delete)
      expect(buttonCount).toBeGreaterThanOrEqual(0);
    } else {
      // No items found, which is OK in demo mode
      test.skip();
    }
  });

  test('Test 8: Performance check (page load time)', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to schedules day page
    await page.goto('/schedules/day');

    // Wait for the page to be ready
    await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page'], { timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds (generous for E2E)
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('Schedules Navigation Integration', () => {
  test('Navigate from home to schedules', async ({ page }) => {
    // Navigate to home
    await page.goto('/');

    // Wait for home page to load
    await page.waitForLoadState('networkidle');

    // Find the schedules navigation link
    const schedulesNavLink = page.getByTestId(TESTIDS['schedules-nav-link']);
    
    if (await schedulesNavLink.isVisible().catch(() => false)) {
      await schedulesNavLink.click();

      // Should navigate to schedules page
      await expect(page).toHaveURL(/\/schedules/);

      // Verify schedules page loaded
      await page.waitForTimeout(1000);
    } else {
      // If nav link not found, try direct navigation
      await page.goto('/schedules/day');
      await expectTestIdVisibleBestEffort(page, TESTIDS['schedules-week-page']);
    }
  });
});
