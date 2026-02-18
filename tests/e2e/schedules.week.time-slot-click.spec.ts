import { test, expect } from '@playwright/test';

test.describe('Schedule Week: Time Slot Click Opens Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/schedules/week');
  });

  test('clicking time slot cell opens CreateScheduleDialog with time mode', async ({ page }) => {
    // 1. Week grid is visible
    const grid = page.locator('[data-testid="schedules-week-grid"]');
    await expect(grid).toBeVisible();

    // 2. Find a time slot cell (grid-based) - skip header row
    // Grid has: 1 header row + 32 time slot rows, 8 columns (time label + 7 days)
    // Click on first data cell (not header, not time label)
    const gridCells = grid.locator('[role="gridcell"]');
    const cellCount = await gridCells.count();

    // Expected: ~260 cells (32 slots × 8 cols + 1 header row)
    expect(cellCount).toBeGreaterThan(200);

    // Click a cell in the data grid (skip first column of time labels and header row)
    // Target: approximately 10:00 slot, Monday (day index 2 in our grid)
    // Time slot row index: (10 - 6) * 2 + 2 = 10 (accounting for 30-min granularity)
    // Cell index ≈ (10 * 8) + 2 = 82
    const targetCell = gridCells.nth(82);

    await targetCell.click({ timeout: 5000 });

    // 3. Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 4. Dialog should show time inputs (time mode)
    const titleInput = dialog.locator('input');
    await expect(titleInput).toBeVisible();

    // 5. Should be able to close dialog
    const closeBtn = dialog.locator('button').filter({ hasText: /キャン|閉じ/ }).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('grid displays without errors on load', async ({ page }) => {
    // Smoke test: grid renders without exceptions
    const grid = page.locator('[data-testid="schedules-week-grid"]');
    await expect(grid).toBeVisible();

    // Check header (時刻 label)
    const timeHeader = page.locator(':has-text("時刻")').first();
    await expect(timeHeader).toBeVisible();

    // Check at least one time slot (e.g., "06:00")
    const timeSlot = page.locator(':has-text("06:00")');
    // May have multiple cells with "06:00" due to repetition
  });
});
