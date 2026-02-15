import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testids';

/**
 * Schedules Persistence E2E Smoke Test
 *
 * Goal: Verify that created schedules persist after page reload
 *
 * Environment:
 * - VITE_FEATURE_SCHEDULES=1
 * - VITE_SKIP_LOGIN=1
 * - VITE_DEMO_MODE=1 (for E2E stability)
 * - VITE_WRITE_ENABLED (optional: if 0, verify read-only mode instead)
 */

test.describe('Schedules Persistence', () => {
  let testTitle: string;
  let isWriteEnabled: boolean;

  test.beforeEach(async ({ page }) => {
    // Generate unique test title for this run
    testTitle = `E2E-Persist-${Date.now()}`;

    // Navigate to schedules week page
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/schedules/week?tab=week&date=${today}`);

    // Wait for page to be ready
    await page.waitForSelector(`[data-testid="${TESTIDS.SCHEDULES_WEEK_VIEW}"]`, { 
      timeout: 10000,
      state: 'visible' 
    }).catch(() => {
      // Fallback: wait for any schedules page root
      return page.waitForSelector(`[data-testid="${TESTIDS.SCHEDULES_PAGE_ROOT}"]`, { timeout: 5000 });
    });

    // Check if write is enabled by looking for enabled FAB or disabled state
    const fab = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    const fabExists = await fab.isVisible().catch(() => false);
    
    if (fabExists) {
      const fabDisabled = await fab.isDisabled().catch(() => false);
      isWriteEnabled = !fabDisabled;
    } else {
      // No FAB means likely read-only or different UI state
      isWriteEnabled = false;
    }
  });

  test('should create schedule and verify it appears in the list', async ({ page }) => {
    if (!isWriteEnabled) {
      // Read-only mode: verify FAB is disabled or alert is shown
      const fab = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
      const fabExists = await fab.isVisible().catch(() => false);
      
      if (fabExists) {
        // Verify FAB is disabled
        await expect(fab).toBeDisabled();
      }
      
      // Check for read-only alert/banner
      const alerts = page.locator('[role="alert"]:has-text("閲覧"), [role="alert"]:has-text("read")');
      const hasAlert = await alerts.count().then(c => c > 0).catch(() => false);
      
      // Pass test - read-only mode is correctly implemented
      expect(fabExists ? true : hasAlert).toBe(true);
      test.skip();
      return;
    }

    // Write enabled: proceed with creation
    const fab = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    await fab.click({ timeout: 5000 });

    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Fill in the minimal required fields
    const titleInput = page.locator('input[name="title"], input[placeholder*="タイトル"]').first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill(testTitle);

    // Find and click save button
    const saveButton = page.locator('button:has-text("作成"), button:has-text("保存"), button[type="submit"]').first();
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();

    // Wait for dialog to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify the created schedule appears in the week view
    const scheduleItem = page.locator(`text="${testTitle}"`).first();
    await expect(scheduleItem).toBeVisible({ timeout: 5000 });
  });

  test('should persist schedule after page reload', async ({ page }) => {
    // Skip if write is disabled (no schedule to verify)
    if (!isWriteEnabled) {
      test.skip();
      return;
    }

    // First, create a schedule (same as previous test)
    const fab = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    await fab.click({ timeout: 5000 });
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const titleInput = page.locator('input[name="title"], input[placeholder*="タイトル"]').first();
    await titleInput.fill(testTitle);

    const saveButton = page.locator('button:has-text("作成"), button:has-text("保存"), button[type="submit"]').first();
    await saveButton.click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify it appears before reload
    const scheduleBeforeReload = page.locator(`text="${testTitle}"`).first();
    await expect(scheduleBeforeReload).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for page to be ready again
    await page.waitForSelector(`[data-testid="${TESTIDS.SCHEDULES_WEEK_VIEW}"]`, { 
      timeout: 10000,
      state: 'visible' 
    }).catch(() => {
      return page.waitForSelector(`[data-testid="${TESTIDS.SCHEDULES_PAGE_ROOT}"]`, { timeout: 5000 });
    });

    // Verify the schedule still exists after reload (persistence proof)
    const scheduleAfterReload = page.locator(`text="${testTitle}"`).first();
    await expect(scheduleAfterReload).toBeVisible({ timeout: 5000 });
  });
});
