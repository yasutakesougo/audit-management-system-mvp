import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { formatInTimeZone } from 'date-fns-tz';

import { bootSchedule } from './_helpers/bootSchedule';
import { buildScheduleFixturesForDate, SCHEDULE_FIXTURE_BASE_DATE } from './utils/schedule.fixtures';
import { getWeekRowById, waitForWeekScheduleItems, waitForWeekViewReady } from './utils/scheduleActions';
import { gotoWeek } from './utils/scheduleNav';
import { registerScheduleMocks, TIME_ZONE } from './utils/spMock';

const skipSp = process.env.VITE_SKIP_SHAREPOINT === '1' || process.env.VITE_FEATURE_SCHEDULES_SP === '0';

const TEST_DATE = new Date(SCHEDULE_FIXTURE_BASE_DATE);
const TEST_DATE_KEY = formatInTimeZone(TEST_DATE, TIME_ZONE, 'yyyy-MM-dd');

const buildScheduleItems = () => {
  const fixtures = buildScheduleFixturesForDate(TEST_DATE);
  return [...fixtures.User, ...fixtures.Staff, ...fixtures.Org];
};

test.describe('Schedule org filter deep', () => {
  test.skip(skipSp, 'SharePoint/SP disabled in this run');
  test.beforeEach(async ({ page }) => {
    const fixtures = buildScheduleFixturesForDate(TEST_DATE);
    await registerScheduleMocks(page, fixtures);

    await bootSchedule(page, {
      date: TEST_DATE,
      enableWeekV2: false,
      scheduleItems: buildScheduleItems(),
      env: {
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/AuditSystem',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
        VITE_SP_LIST_SCHEDULES: 'Schedules',
        // Force SharePoint route so Playwright list stubs are exercised.
        VITE_FORCE_SHAREPOINT: '1',
      },
    });
  });

  test('filters week items for shortstay org', async ({ page }) => {
    await gotoWeek(page, TEST_DATE, { searchParams: { org: 'shortstay' } });
    // Wait for week grid + async list fetch to settle before row assertions.
    await waitForWeekViewReady(page);
    await waitForWeekScheduleItems(page);

    await expect(await getWeekRowById(page, 9102)).toBeVisible();
    await expect(await getWeekRowById(page, 9101)).toHaveCount(0);
    await expect(await getWeekRowById(page, 9201)).toHaveCount(0);
  });

  test('filters week items for respite org', async ({ page }) => {
    await gotoWeek(page, TEST_DATE, { searchParams: { org: 'respite' } });
    // Wait for week grid + async list fetch to settle before row assertions.
    await waitForWeekViewReady(page);
    await waitForWeekScheduleItems(page);

    await expect(await getWeekRowById(page, 9101)).toBeVisible();
    await expect(await getWeekRowById(page, 9102)).toHaveCount(0);
    await expect(await getWeekRowById(page, 9201)).toHaveCount(0);
  });

  test('invalid org falls back to all items', async ({ page }) => {
    await gotoWeek(page, TEST_DATE, { searchParams: { org: 'unknown', date: TEST_DATE_KEY } });
    // Wait for week grid + async list fetch to settle before row assertions.
    await waitForWeekViewReady(page);
    await waitForWeekScheduleItems(page);

    await expect(page).not.toHaveURL(/org=/);
    await expect(await getWeekRowById(page, 9101)).toBeVisible();
    await expect(await getWeekRowById(page, 9102)).toBeVisible();
  });
});
