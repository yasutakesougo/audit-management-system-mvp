import '@/test/captureSp400';
import { expect, test, type Locator } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoWeek } from './utils/scheduleNav';
import { waitForDayTimeline, waitForWeekViewReady } from './utils/wait';

const skipSp = process.env.VITE_SKIP_SHAREPOINT === '1' || process.env.VITE_FEATURE_SCHEDULES_SP === '0';

const focusLocator = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
};

test.describe('Schedule week keyboard navigation', () => {
  test.skip(skipSp, 'SharePoint/SP disabled in this run');
  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('SharePoint')) {
        // eslint-disable-next-line no-console
        console.log(`browser-console:error ${message.text()}`);
      }
    });

    page.on('requestfailed', (request) => {
      const failure = request.failure();
      // eslint-disable-next-line no-console
      console.log(`request-failed: ${request.url()} ${failure?.errorText ?? ''}`.trim());
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/_api/')) {
        // eslint-disable-next-line no-console
        console.log(`request: ${url}`);
      }
    });

    await bootstrapScheduleEnv(page);
  });

  test('keyboard focus moves across tabs and restores the week view', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekViewReady(page);

    const weekTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    const dayTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY);

    await weekTab.click();
    await focusLocator(weekTab);
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await waitForDayTimeline(page);
    await expect(dayTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(TESTIDS['schedules-day-page'])).toBeVisible();

    await focusLocator(dayTab);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await waitForWeekViewReady(page);

    await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible();
  });

  test('period navigation buttons respond to keyboard activation', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekViewReady(page);

    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    const readRange = async () => (await rangeLabel.textContent())?.trim() ?? '';
    const initialRange = await readRange();

    const prevButton = page.getByRole('button', { name: '前の期間' });
    await focusLocator(prevButton);
    await page.keyboard.press('Enter');
    await expect.poll(readRange, { timeout: 10_000 }).not.toBe(initialRange);

    const nextButton = page.getByRole('button', { name: '次の期間' });
    await focusLocator(nextButton);
    await page.keyboard.press('Enter');
    await expect.poll(readRange, { timeout: 10_000 }).toBe(initialRange);
  });

  test('search interactions do not change the active week view', async ({ page }) => {
    await gotoWeek(page, new Date('2025-11-24'));
    await waitForWeekViewReady(page);

    const weekTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    const activeDay = page.getByTestId(`${TESTIDS.SCHEDULES_WEEK_DAY_PREFIX}-2025-11-24`);
    await expect(activeDay).toHaveAttribute('aria-current', 'date');

    const searchInput = page.getByTestId(TESTIDS['schedules-filter-query']);
    await focusLocator(searchInput);
    await searchInput.type('ABC', { delay: 10 });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(activeDay).toHaveAttribute('aria-current', 'date');
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible();
  });
});
