import { expect, test } from '@playwright/test';
import { enableSchedulesFeature } from './_helpers/featureFlags';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';
import { openSchedules } from './_helpers/nav.schedule';
import { seedSchedules } from './_helpers/schedulesSeed';
import { fixtures } from './_helpers/schedulesSeed.fixtures';

const TZ = 'Asia/Tokyo';
const AT = '2025-10-08';
const TEST_NOW = '2025-10-15T03:00:00.000Z';

test.describe('schedule month view', () => {
  test.beforeEach(async ({ page }) => {
    await enableSchedulesFeature(page, { create: true, msalMock: true });
    await seedSchedules(page, fixtures.forDate(AT, TZ));
    await page.addInitScript(({ now }) => {
      const fixedNow = new Date(now).getTime();
      const RealDate = Date;
      class MockDate extends RealDate {
        constructor(...args: Array<number | string | Date>) {
          if (args.length === 0) {
            super(fixedNow);
            return;
          }
          super(...(args as ConstructorParameters<typeof Date>));
        }
        static now() {
          return fixedNow;
        }
        static parse = RealDate.parse;
        static UTC = RealDate.UTC;
      }
      Object.setPrototypeOf(MockDate, RealDate);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Date = MockDate;
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
      (window as typeof window & { __TEST_NOW__?: string }).__TEST_NOW__ = now;
    }, { now: TEST_NOW });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ value: [] }), headers: { 'content-type': 'application/json' } }),
    );
    await mockEnsureScheduleList(page);
  });

  test('renders seeded items', async ({ page }) => {
    page.on('request', (request) => {
      if (request.url().includes('/_api/web/')) {
        console.log('[schedule-month] request', request.url());
      }
    });

    await openSchedules(page, {
      view: 'month',
      at: AT,
      env: { VITE_E2E_MSAL_MOCK: '1', VITE_SKIP_LOGIN: '1' },
      feature: { create: true, msalMock: true },
    });
    console.log('[schedule-month] location:', page.url());
    const fixtureCount = await page.evaluate(() => {
      const scope = window as typeof window & { __SCHEDULE_FIXTURES__?: unknown };
      return Array.isArray(scope.__SCHEDULE_FIXTURES__) ? scope.__SCHEDULE_FIXTURES__.length : 0;
    });
    console.log('[schedule-month] fixtures:', fixtureCount);
    const monthState = await page.evaluate(() => {
      const scope = window as typeof window & { __MONTH_VIEW_STATE__?: unknown };
      return scope.__MONTH_VIEW_STATE__ ?? null;
    });
    console.log('[schedule-month] month-state:', JSON.stringify(monthState, null, 2));
    await test.info().attach('month-view-state.json', {
      body: JSON.stringify(monthState, null, 2),
      contentType: 'application/json',
    });

    const monthGrid = page.getByTestId('schedule-month-grid');
    await expect(monthGrid).toBeVisible({ timeout: 10_000 });
    const items = monthGrid.getByTestId('schedule-item');
    await expect
      .poll(async () => items.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(items.first()).toBeVisible();
    await expect(monthGrid).toContainText('ホーム訪問ケア');
  });
});
