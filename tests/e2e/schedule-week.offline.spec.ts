import { TESTIDS } from '@/testids';
import { expect, test, type Route } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoScheduleWeek } from './utils/scheduleWeek';

const REF_DATE = new Date('2025-11-24');
const isSharePointLane = process.env.VITE_SKIP_SHAREPOINT === '0';
const schedulesItemsMatcher = /\/lists\/getbytitle\('(Schedules|ScheduleEvents)'\)\/items/i;
const abortAsOffline = (route: Route) => route.abort('internetdisconnected');
const abortWritesAsOffline = (route: Route) =>
  route.request().method() === 'POST' ? abortAsOffline(route) : route.fallback();

test.describe('Schedule week offline handling', () => {
  test.skip(!isSharePointLane, 'SharePoint network contract is excluded from the memory-backed Deep lane.');

  test.beforeEach(async ({ page }) => {
    await bootSchedule(page, {
      mode: 'sharepoint',
      envOverrides: {
        VITE_TEST_ROLE: 'admin',
        VITE_E2E_FORCE_SCHEDULES_WRITE: '1',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_FORCE_SHAREPOINT: '1',
        VITE_FEATURE_SCHEDULES_SP: '1',
        VITE_SCHEDULES_SAVE_MODE: 'real',
      },
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
      const type = msg.type();
      if (type === 'log' || type === 'info' || type === 'warning' || type === 'error') {
         if (msg.text().includes('[schedules]')) console.log(`[BROWSER ${type.toUpperCase()}] ${msg.text()}`);
      }
    });
  });

  test.fixme(
    'shows network error message when creating schedule while offline',
    'Mutation failures currently return the dialog to idle without exposing an error message.',
    async ({ page }) => {
      // 1. Navigate to schedule week while online
      await gotoScheduleWeek(page, REF_DATE);
      await page.waitForTimeout(500);

      const createButton = page.getByTestId(TESTIDS.SCHEDULES_HEADER_CREATE);
      await expect(createButton).toBeVisible();
      await createButton.click();

      const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
      await expect(dialog).toBeVisible();

      // Fill minimal data
      await dialog.getByTestId(TESTIDS['schedule-create-title']).fill('Offline Test');

      const categorySelect = dialog.getByTestId(TESTIDS['schedule-create-category-select']);
      await categorySelect.click();
      await page.getByRole('option', { name: '職員' }).click();
      await dialog.getByTestId(TESTIDS['schedule-create-staff-id']).fill('1');

      // 2. Fail only the save request. Keeping the browser online lets failure telemetry complete.
      await page.route(schedulesItemsMatcher, abortWritesAsOffline);
      await dialog.getByTestId(TESTIDS['schedule-create-save']).click({ force: true });

      // 3. The schedule orchestrator reports the failed mutation and keeps the dialog open for retry.
      await expect(page.getByTestId('schedules-general-snackbar')).toContainText('作成に失敗しました', {
        timeout: 10000,
      });
      await expect(dialog).toBeVisible();

      await page.unroute(schedulesItemsMatcher, abortWritesAsOffline);
    },
  );

  test('detects offline state and shows network error banner after refetch', async ({ page }) => {
    // 1. Navigate to schedule week while online
    await gotoScheduleWeek(page, REF_DATE);
    await page.waitForTimeout(500);

    // 2. Set offline
    await page.context().setOffline(true);
    await page.route(schedulesItemsMatcher, abortAsOffline);

    // 3. Trigger refetch - click "今日" to trigger a range fetch
    const todayButton = page.getByRole('button', { name: '今日へ移動' });
    await todayButton.click();

    // 4. Verify network error feedback (Scenario B)
    const feedback = page
      .getByTestId('schedules-network-snackbar')
      .or(page.getByRole('alert').filter({ hasText: /予定.*失敗/ }))
      .first();
    await expect(feedback).toBeVisible({ timeout: 10000 });

    // 5. Recover online
    await page.context().setOffline(false);
    await page.unroute(schedulesItemsMatcher, abortAsOffline);
  });
});
