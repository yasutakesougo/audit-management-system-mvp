import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoWeek } from './utils/scheduleNav';
import { getQuickDialogSaveButton, waitForWeekViewReady } from './utils/scheduleActions';

const openCreateDialog = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
  const headerCreate = page.getByTestId(TESTIDS.SCHEDULES_HEADER_CREATE);
  if (await headerCreate.isVisible().catch(() => false)) {
    await headerCreate.click();
    return;
  }

  const fab = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
  if (await fab.isVisible().catch(() => false)) {
    await fab.click({ timeout: 5000 });
    return;
  }

  const url = new URL(page.url());
  const dateParam = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  url.searchParams.set('dialog', 'create');
  url.searchParams.set('dialogDate', dateParam);
  url.searchParams.set('dialogStart', '10:00');
  url.searchParams.set('dialogEnd', '11:00');
  url.searchParams.set('dialogCategory', 'Staff');
  await page.goto(`${url.pathname}?${url.searchParams.toString()}`, { waitUntil: 'networkidle' });
};

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

    const today = new Date();
    await bootSchedule(page, {
      seed: { schedulesToday: true },
      route: '/schedules/week?tab=week',
      resetLocalStorage: false,
    });
    await gotoWeek(page, today);
    await waitForWeekViewReady(page);

    const isE2eForceWrite = await page.evaluate(() => {
      const env = (window as typeof window & { __ENV__?: Record<string, string> }).__ENV__ ?? {};
      return String(env.VITE_E2E_FORCE_SCHEDULES_WRITE) === '1';
    });

    if (isE2eForceWrite) {
      isWriteEnabled = true;
      return;
    }

    // Check if write is enabled by looking for create actions (header on desktop, FAB on mobile)
    const headerCreate = page.getByTestId(TESTIDS.SCHEDULES_HEADER_CREATE);
    const headerExists = await headerCreate.isVisible().catch(() => false);
    if (headerExists) {
      const headerDisabled = await headerCreate.isDisabled().catch(() => false);
      isWriteEnabled = !headerDisabled;
      return;
    }

    const fab = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    const fabExists = await fab.isVisible().catch(() => false);
    if (fabExists) {
      const fabDisabled = await fab.isDisabled().catch(() => false);
      isWriteEnabled = !fabDisabled;
      return;
    }

    // No create controls means likely read-only or unsupported layout
    isWriteEnabled = false;
  });

  test('should create schedule and verify it appears in the list', async ({ page }) => {
    if (!isWriteEnabled) {
      test.skip(true, 'Write disabled in this environment');
      return;
    }

    // Write enabled: proceed with creation
    await openCreateDialog(page);

    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const titleInput = page
      .getByTestId(TESTIDS['schedule-create-title'])
      .or(page.getByLabel('予定タイトル', { exact: false }))
      .first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill(testTitle);

    const categorySelect = page.getByTestId(TESTIDS['schedule-create-category-select']).first();
    await categorySelect.click();
    await page.getByRole('option', { name: /職員/ }).first().click();
    await expect(categorySelect).toContainText(/職員/);

    const staffIdInput = page.getByTestId(TESTIDS['schedule-create-staff-id']).first();
    await staffIdInput.fill('1');

    const { dialog, inDialog, global } = getQuickDialogSaveButton(page);
    const saveButton = (await inDialog.count()) > 0 ? inDialog : global;
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

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
      test.skip(true, 'Write disabled in this environment');
      return;
    }

    // First, create a schedule (same as previous test)
    await openCreateDialog(page);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const titleInput = page
      .getByTestId(TESTIDS['schedule-create-title'])
      .or(page.getByLabel('予定タイトル', { exact: false }))
      .first();
    await titleInput.fill(testTitle);

    const categorySelect = page.getByTestId(TESTIDS['schedule-create-category-select']).first();
    await categorySelect.click();
    await page.getByRole('option', { name: /職員/ }).first().click();
    await expect(categorySelect).toContainText(/職員/);

    const staffIdInput = page.getByTestId(TESTIDS['schedule-create-staff-id']).first();
    await staffIdInput.fill('1');

    const { dialog, inDialog, global } = getQuickDialogSaveButton(page);
    const saveButton = (await inDialog.count()) > 0 ? inDialog : global;
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify it appears before reload
    const scheduleBeforeReload = page.locator(`text="${testTitle}"`).first();
    await expect(scheduleBeforeReload).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for page to be ready again
    await waitForWeekViewReady(page);


    // Verify the schedule still exists after reload (persistence proof)
    const scheduleAfterReload = page.locator(`text="${testTitle}"`).first();
    await expect(scheduleAfterReload).toBeVisible({ timeout: 5000 });
  });
});
