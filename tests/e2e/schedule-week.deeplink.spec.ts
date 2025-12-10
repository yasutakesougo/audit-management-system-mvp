import '@/test/captureSp400';
import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { gotoWeek } from './utils/scheduleNav';
import { waitForWeekTimeline } from './utils/wait';

test.describe('Schedule week deep link', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      initialPath: '/schedule/week',
    });
  });

  const readLiveMessage = async (page: Page): Promise<string> =>
    page.evaluate(() => {
      const polite = document.querySelector('[data-testid="live-polite"]')?.textContent ?? '';
      const assertive = document.querySelector('[data-testid="live-assertive"]')?.textContent ?? '';
      return (polite || assertive).trim();
    });

  const waitForSchedulePage = async (page: Page, iso?: string): Promise<void> => {
    await waitForWeekTimeline(page);

    const heading = page.getByTestId(TESTIDS['schedules-week-heading']).or(
      page.getByRole('heading', { level: 1, name: /スケジュール/ }),
    );
    await expect(heading).toBeVisible();

    const weekTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');

    if (iso) {
      await expect(page.getByTestId(`${TESTIDS.SCHEDULES_WEEK_DAY_PREFIX}-${iso}`)).toBeVisible();
    } else {
      await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible();
    }
  };

  test('loads the requested week and preserves announcements after reload', async ({ page }) => {
    const targetIso = '2025-11-24';
    await gotoWeek(page, new Date(targetIso));
    await waitForSchedulePage(page, targetIso);

    const mondayButton = page.getByTestId(`${TESTIDS.SCHEDULES_WEEK_DAY_PREFIX}-${targetIso}`);
    await expect(mondayButton).toBeVisible();
    const liveText = await readLiveMessage(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForSchedulePage(page, targetIso);
    const reloadedLiveText = await readLiveMessage(page);
    expect(reloadedLiveText).toBe(liveText);
  });
});
