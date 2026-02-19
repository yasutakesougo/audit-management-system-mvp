import { test, expect } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoWeek } from './utils/scheduleNav';
import { getScheduleWriteState, waitForWeekViewReady } from './utils/scheduleActions';

test.describe('Schedule Week: Time Slot Click Opens Dialog', () => {
  let canWrite = false;
  let writeReason = 'unknown';

  test.beforeEach(async ({ page }) => {
    const today = new Date();
    await bootSchedule(page, {
      seed: { schedulesToday: true },
      route: '/schedules/week?tab=week',
    });
    await gotoWeek(page, today);
    await waitForWeekViewReady(page);

    const state = await getScheduleWriteState(page);
    canWrite = state.canWrite;
    writeReason = state.reason;
  });

  test('clicking time slot cell opens CreateScheduleDialog with time mode', async ({ page }) => {
    test.skip(!canWrite, `read-only mode: ${writeReason}`);

    // 1. Week grid is visible
    const grid = page.getByTestId('schedules-week-grid');
    await expect(grid).toBeVisible();

    // 2. Click a specific time slot (e.g., 10:30 on the first available day)
    // Use data attributes for stable selection
    const timeSlotCell = page.locator('[data-testid="schedules-week-slot"][data-time="10:30"]').first();
    
    const cellCount = await page.locator('[data-testid="schedules-week-slot"]').count();
    expect(cellCount).toBeGreaterThan(100); // 32 time slots × 7 days

    await timeSlotCell.click({ timeout: 5000 });

    // 3. Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 4. Should be able to close dialog
    const closeBtn = dialog.locator('button').filter({ hasText: /キャン|閉じ|×/ }).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('time slot cells display correctly across all hours (06:00-21:30)', async ({ page }) => {
    // Smoke test: verify grid renders all time slots
    const slots = page.locator('[data-testid="schedules-week-slot"]');
    const slotCount = await slots.count();

    // 32 time slots × 7 days = 224 cells minimum
    expect(slotCount).toBeGreaterThanOrEqual(220);

    // Verify time attributes are present
    const firstSlot = slots.first();
    const dayAttr = await firstSlot.getAttribute('data-day');
    const timeAttr = await firstSlot.getAttribute('data-time');

    expect(dayAttr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(timeAttr).toMatch(/^\d{2}:\d{2}$/);
  });

  test('multiple clicks on different slots work independently', async ({ page }) => {
    test.skip(!canWrite, `read-only mode: ${writeReason}`);

    const slots = page.locator('[data-testid="schedules-week-slot"]');
    
    // Click first slot
    await slots.nth(0).click();
    let dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 2000 });

    // Click different slot
    await slots.nth(50).click();
    dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });
});
