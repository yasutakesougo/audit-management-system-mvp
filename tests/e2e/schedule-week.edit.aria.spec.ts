import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { getSchedulesTodaySeedDate } from './_helpers/schedulesTodaySeed';
import { gotoWeek } from './utils/scheduleNav';
import {
  getWeekRowById,
  getWeekScheduleItems,
  openWeekEventEditor,
  waitForWeekViewReady,
} from './utils/scheduleActions';
const TEST_DATE = new Date(getSchedulesTodaySeedDate());

test.describe('Schedules week edit entry', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // surface fixture-mode logs for easier debugging
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page, {
      enableWeekV2: false,
      seed: { schedulesToday: true },
    });
  });

  // NOTE(e2e-skip): Target page closes during bootSchedule with enableWeekV2:false (legacy UI).
  // Category: Boot/Crash or Feature/LegacyUI
  // TODO: Investigate if enableWeekV2:false is incompatible with E2E_VITE_FEATURE_SCHEDULES=0 override,
  //       or if test should migrate to new UI (/schedules with enableWeekV2:true).
  // Repro: npx playwright test tests/e2e/schedule-week.edit.aria.spec.ts --project=chromium --workers=1 --reporter=line
  // Error: "Target page, context or browser has been closed" at utils/scheduleActions.ts:631
  test.skip('clicking a timeline card opens an edit dialog with data prefilled', async ({ page }, testInfo) => {
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);

    const scheduleItems = await getWeekScheduleItems(page);
    await expect(scheduleItems.first()).toBeVisible({ timeout: 15_000 });

    const targetRow = await getWeekRowById(page, 70_000);
    await expect(targetRow).toBeVisible({ timeout: 15_000 });

    const editor = await openWeekEventEditor(page, targetRow, {
      testInfo,
      label: 'week-edit-70000',
    });

    const quickHeading = editor.getByTestId(TESTIDS['schedule-create-heading']);
    const quickHeadingVisible = await quickHeading.isVisible().catch(() => false);

    if (quickHeadingVisible) {
      await expect(quickHeading).toHaveText(/スケジュール/);
      const titleInput = editor.getByTestId(TESTIDS['schedule-create-title']);
      await expect(titleInput).not.toHaveValue('');
    } else {
      await expect(editor).toContainText('予定を編集');
      const titleInput = editor.getByLabel('タイトル');
      await expect(titleInput).not.toHaveValue('');
    }
  });
});
