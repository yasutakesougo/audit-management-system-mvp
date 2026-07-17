import '@/test/captureSp400';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoDay, gotoMonth, gotoWeek } from './utils/scheduleNav';
import {
  waitForDayViewReady,
  waitForMonthViewReady,
  waitForWeekViewReady,
} from './utils/scheduleActions';

const TARGET_DATE = new Date('2025-11-10');
const E2E_FEATURE_SCHEDULE_NAV = process.env.E2E_FEATURE_SCHEDULE_NAV === '1';

const openWeekView = async (page: Page) => {
  await gotoWeek(page, TARGET_DATE);
  await waitForWeekViewReady(page);
};

const openDayView = async (page: Page) => {
  await gotoDay(page, TARGET_DATE);
  await waitForDayViewReady(page);
};

const openMonthView = async (page: Page) => {
  await gotoMonth(page, TARGET_DATE);
  await waitForMonthViewReady(page);
};

const resolveTab = async (page: Page, label: string, testId?: string): Promise<Locator> => {
  if (testId) {
    const byTestId = page.getByTestId(testId);
    if ((await byTestId.count()) > 0) return byTestId;
  }
  return page.getByRole('tab', { name: label });
};

test.describe('Schedules global navigation', () => {
  test.skip(
    !E2E_FEATURE_SCHEDULE_NAV,
    'Schedule nav (tabs/indicators) suite behind E2E_FEATURE_SCHEDULE_NAV=1',
  );

  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('week view exposes only the week tab and month remains directly reachable', async ({ page }) => {
    await openWeekView(page);

    const weekTab = await resolveTab(page, '週', TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    await expect(weekTab).toHaveCount(1);
    await expect(weekTab).toBeVisible({ timeout: 10_000 });
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_MONTH)).toHaveCount(0);

    await gotoMonth(page, TARGET_DATE);
    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);
    await expect(page.getByTestId(TESTIDS.SCHEDULES_MONTH_PAGE)).toBeVisible();

    await page.getByTestId('schedules-return-week').click();
    await waitForWeekViewReady(page);
    await expect(page).toHaveURL(/tab=week/);
    await expect(page.getByTestId('schedule-week-view')).toBeVisible();
  });

  test('day view exposes shared nav buttons', async ({ page }) => {
    await openDayView(page);

    await expect(page).toHaveURL(/tab=day/);
    await expect(page.getByTestId(TESTIDS['schedules-day-heading'])).toBeVisible({ timeout: 10_000 });

    // On mobile, tabs may be in a menu; validate week navigation by direct action
    const weekTab = await resolveTab(page, '週', TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    await expect(weekTab).toHaveCount(1);
    await weekTab.click({ timeout: 10_000 });
    await waitForWeekViewReady(page);
  });

  test('list view remains directly reachable and can return to week', async ({ page }) => {
    await page.goto('/schedules/week?tab=list', { waitUntil: 'domcontentloaded' });

    const listRoot = page.getByRole('table');
    const listEmpty = page.getByText('一覧に表示するデータがありません', { exact: true });
    await Promise.race([
      listRoot.waitFor({ state: 'visible', timeout: 10_000 }),
      listEmpty.waitFor({ state: 'visible', timeout: 10_000 }),
    ]);

    await page.getByTestId('schedules-return-week').click();
    await waitForWeekViewReady(page);
  });

  test('ops view remains directly reachable and can return to week', async ({ page }) => {
    await page.goto('/schedules/week?tab=ops', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('group', { name: 'サービス種別フィルター' })).toBeVisible();
    await expect(page.getByRole('button', { name: '全て', exact: true })).toBeVisible();
    await expect(page.getByTestId('schedules-return-week')).toBeVisible();
    await page.getByTestId('schedules-return-week').click();
    await waitForWeekViewReady(page);
    await expect(page).toHaveURL(/tab=week/);
  });

  test('month view opened directly still links back to week', async ({ page }) => {
    await openMonthView(page);
    // Direct month access may normalize to week; accept current behavior
    await expect(page).toHaveURL(/\/schedules\/(week|month)/);

    await waitForMonthViewReady(page);
    await expect(page).toHaveURL(/tab=month/);

    // Validate week navigation
    await page.getByTestId('schedules-return-week').click();
    await waitForWeekViewReady(page);
  });
});
