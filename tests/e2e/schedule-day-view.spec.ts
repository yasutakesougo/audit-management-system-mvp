import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { getSchedulesTodaySeedDate } from './_helpers/schedulesTodaySeed';
import { gotoDay } from './utils/scheduleNav';
import { assertDayHasUserCareEvent, waitForDayViewReady, waitForWeekViewReady } from './utils/scheduleActions';
const TEST_DATE = new Date(getSchedulesTodaySeedDate());

test.describe('Schedule day view', () => {
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

    const heading = page.getByRole('heading', { level: 1, name: /スケジュール/ });
    await expect(heading).toBeVisible();

    const tablist = page.getByRole('tablist', { name: 'スケジュールビュー切り替え' });
    await expect(tablist).toBeVisible();

    const dayTab = page.getByRole('tab', { name: '日' });
    const weekTab = page.getByRole('tab', { name: '週' });

    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
    await expect(weekTab).toHaveAttribute('aria-selected', 'false');

    const dayRoot = page.getByTestId('schedule-day-root');
    await expect(dayRoot).toBeVisible();

    const hourHeaders = dayRoot.locator('[id^="timeline-day-header-"]');
    await expect(hourHeaders.first()).toBeVisible();

    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    await expect(rangeLabel).toBeVisible();
    await expect(rangeLabel).toHaveText(/20\d{2}/);
  });

  test('日⇄週タブを切り替えても表示日が維持される', async ({ page }) => {
    await gotoDay(page, TEST_DATE);
    await waitForDayViewReady(page);

    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    const initialRangeText = await rangeLabel.textContent();

    await page.getByRole('tab', { name: '週' }).click();
    await waitForWeekViewReady(page);
    await expect(rangeLabel).toBeVisible();

    await page.getByRole('tab', { name: '日' }).click();
    await waitForDayViewReady(page);

    const rangeTextAfterToggle = await rangeLabel.textContent();
    expect(rangeTextAfterToggle?.trim()).toBe(initialRangeText?.trim());
  });
});
