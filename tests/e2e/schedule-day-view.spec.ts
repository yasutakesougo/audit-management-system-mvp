import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { getSchedulesTodaySeedDate } from './_helpers/schedulesTodaySeed';
import { gotoDay } from './utils/scheduleNav';
import { assertDayHasUserCareEvent, waitForDayViewReady, waitForWeekViewReady } from './utils/scheduleActions';

const skipSp = process.env.VITE_SKIP_SHAREPOINT === '1' || process.env.VITE_FEATURE_SCHEDULES_SP === '0';

const TEST_DATE = new Date(getSchedulesTodaySeedDate());

test.describe('Schedule day view', () => {
  test.skip(skipSp, 'SharePoint/SP disabled in this run');
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'info' && message.text().startsWith('[schedulesClient] fixtures=')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console: ${message.text()}`);
      }
    });

    await bootSchedule(page, {
      seed: { schedulesToday: true },
    });
  });

  test('指定日の Day ビューが開き、タブとタイムラインが揃う', async ({ page }) => {
    await gotoDay(page, TEST_DATE);
    await waitForDayViewReady(page);
    await assertDayHasUserCareEvent(page);

    const heading = page.getByRole('heading', { name: /スケジュール|予定表/ }).first();
    await expect(heading).toBeVisible();

    const tablist = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST).first();
    await expect(tablist).toBeVisible();

    const dayTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY).first();
    const weekTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK).first();

    await expect(dayTab).toBeVisible();
    await expect(weekTab).toBeVisible();

    const dayRoot = page.getByTestId(TESTIDS['schedules-day-page']).first();
    await expect(dayRoot).toBeVisible();

    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    await expect(rangeLabel).toBeVisible();
  });

  test('日⇄週タブを切り替えても表示日が維持される', async ({ page }) => {
    await gotoDay(page, TEST_DATE);
    await waitForDayViewReady(page);

    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    const initialRangeText = await rangeLabel.textContent();

    await page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK).first().click();
    await waitForWeekViewReady(page);
    await expect(rangeLabel).toBeVisible();

    await page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY).first().click();
    await waitForDayViewReady(page);

    const rangeTextAfterToggle = await rangeLabel.textContent();
    expect(rangeTextAfterToggle?.trim()).toBe(initialRangeText?.trim());
  });
});
