import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoWeek } from './utils/scheduleNav';
import { getVisibleListbox, waitForWeekViewReady } from './utils/scheduleActions';

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
  url.searchParams.set('dialogCategory', 'User');
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
  let isForceWrite: boolean;

  const hasStoredTitle = async (
    page: Parameters<typeof test.beforeEach>[0]['page'],
    title: string,
  ): Promise<boolean> =>
    page.evaluate((expectedTitle) => {
      const raw = window.localStorage.getItem('e2e:schedules.v1');
      const rows = raw ? (JSON.parse(raw) as Array<{ title?: string }>) : [];
      return Array.isArray(rows) && rows.some((row) => row.title === expectedTitle);
    }, title);

  const saveFromCreateDialog = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
    const dialog = page
      .getByTestId(TESTIDS['schedule-create-dialog'])
      .filter({ has: page.getByTestId(TESTIDS['schedule-create-start']) })
      .last();
    const saveButton = dialog.getByTestId(TESTIDS['schedule-create-save']).first();
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
  };

  const closeFollowUpDialog = async (
    page: Parameters<typeof test.beforeEach>[0]['page'],
  ) => {
    const dialog = page
      .getByTestId(TESTIDS['schedule-create-dialog'])
      .filter({ has: page.getByTestId(TESTIDS['schedule-create-start']) })
      .last();
    await page.waitForTimeout(500);
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });
    }
  };

  const selectOtherServiceType = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
    const serviceTypeSelect = page.getByTestId(TESTIDS['schedule-create-service-type']).first();
    await serviceTypeSelect.click();
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
    await getVisibleListbox(page).getByRole('option', { name: 'その他' }).first().click();
    await expect(serviceTypeSelect).toContainText('その他');
  };

  const selectFirstUser = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
    const userInput = page.getByTestId(TESTIDS['schedule-create-user-input']).first();
    await userInput.click();
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
    await getVisibleListbox(page).getByRole('option').first().click();
  };

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

    isForceWrite = await page.evaluate(() => {
      const env = (window as typeof window & { __ENV__?: Record<string, string> }).__ENV__ ?? {};
      return String(env.VITE_E2E_FORCE_SCHEDULES_WRITE) === '1';
    });

    if (isForceWrite) {
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

    await selectFirstUser(page);
    await selectOtherServiceType(page);

    await saveFromCreateDialog(page);

    if (isForceWrite) {
      await expect
        .poll(async () => {
          return hasStoredTitle(page, testTitle);
        }, { timeout: 10_000 })
        .toBe(true);
    }

    await closeFollowUpDialog(page);
    await page.reload({ waitUntil: 'networkidle' });
    await waitForWeekViewReady(page);

    // Verify the created schedule appears in the week view
    const scheduleItem = page.locator(`[data-testid="schedule-item"][title="${testTitle}"]`).first();
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

    await selectFirstUser(page);
    await selectOtherServiceType(page);

    await saveFromCreateDialog(page);

    if (isForceWrite) {
      await expect
        .poll(async () => {
          return hasStoredTitle(page, testTitle);
        }, { timeout: 10_000 })
        .toBe(true);
    }

    await closeFollowUpDialog(page);

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for page to be ready again
    await waitForWeekViewReady(page);


    // Verify the schedule still exists after reload (persistence proof)
    const scheduleAfterReload = page.locator(`[data-testid="schedule-item"][title="${testTitle}"]`).first();
    await expect(scheduleAfterReload).toBeVisible({ timeout: 5000 });
  });
});
