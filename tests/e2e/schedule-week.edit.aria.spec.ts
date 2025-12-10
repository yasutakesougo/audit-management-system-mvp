import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { getSchedulesTodaySeedDate } from './_helpers/schedulesTodaySeed';
import { gotoWeek } from './utils/scheduleNav';
import { getWeekScheduleItems, openWeekEventCard, waitForWeekViewReady } from './utils/scheduleActions';
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

  test('clicking a timeline card opens an edit dialog with data prefilled', async ({ page }) => {
    await gotoWeek(page, TEST_DATE);
    await waitForWeekViewReady(page);

    const scheduleItems = await getWeekScheduleItems(page);
    await expect(scheduleItems.first()).toBeVisible({ timeout: 15_000 });

    await openWeekEventCard(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const quickHeading = page.getByTestId(TESTIDS['schedule-create-heading']);
    const quickHeadingVisible = await quickHeading.isVisible().catch(() => false);

    if (quickHeadingVisible) {
      await expect(quickHeading).toHaveText(/スケジュール/);
      const titleInput = page.getByTestId(TESTIDS['schedule-create-title']);
      await expect(titleInput).not.toHaveValue('');
    } else {
      await expect(dialog).toContainText('予定を編集');
      const titleInput = page.getByLabel('タイトル');
      await expect(titleInput).not.toHaveValue('');
    }
  });
});
