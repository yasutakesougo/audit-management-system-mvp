import { expect, test } from '@playwright/test';
import { hookConsole } from './utils/console';
import { registerScheduleMocks, TIME_ZONE } from './utils/spMock';
import { buildScheduleFixturesForDate } from './utils/schedule.fixtures';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';

const TEST_NOW = '2025-10-06T15:00:00.000Z';

test.describe('schedule day timeline', () => {
  test('renders hourly slots and clamps cross-day events', async ({ page }) => {
    const consoleGuard = hookConsole(page);
    const baseDate = new Date(TEST_NOW);
    baseDate.setUTCHours(0, 0, 0, 0);
    const fixtures = buildScheduleFixturesForDate(baseDate);
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[sp-')) {
        console.log(`[page:${message.type()}] ${text}`);
      }
    });

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
      (window as typeof window & { Date: typeof Date }).Date = MockDate as typeof Date;

      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
      window.localStorage.setItem('feature:schedules', '1');
      (window as typeof window & { __TEST_NOW__?: string }).__TEST_NOW__ = now;
    }, { now: TEST_NOW });

    await page.addInitScript(({ timezone }) => {
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_DEMO_MODE: '0',
        VITE_FEATURE_SCHEDULES: '1',
        VITE_WRITE_ENABLED: '1',
        VITE_SCHEDULES_TZ: timezone,
        MODE: 'production',
        DEV: '0',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
      };
    }, { timezone: TIME_ZONE });

    await registerScheduleMocks(page, fixtures);

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ value: [] }), headers: { 'content-type': 'application/json' } }),
    );

    await mockEnsureScheduleList(page);

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 5678 } },
      fallback: { status: 404, body: 'not mocked' },
      lists: [
        { name: 'SupportRecord_Daily', items: [] },
        { name: 'StaffDirectory', items: [] },
      ],
    });

    await page.goto('/schedule', { waitUntil: 'load' });
    await expect(page.getByTestId('schedule-page-root')).toBeVisible({ timeout: 15000 });

    const dayTab = page.getByRole('tab', { name: '日', exact: true });
    await dayTab.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.getByTestId('schedule-day-root')).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      const globalWithMocks = window as typeof window & {
        __scheduleLastUrl__?: string;
        __scheduleLastFilter__?: string;
        __scheduleLastPayload__?: unknown;
      };
      console.info(
        '[sp-schedules:init]',
        JSON.stringify({
          url: globalWithMocks.__scheduleLastUrl__,
          filter: globalWithMocks.__scheduleLastFilter__,
          payload: globalWithMocks.__scheduleLastPayload__,
        })
      );
    });

    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as typeof window & { __scheduleLastFilter__?: string }).__scheduleLastFilter__ ?? ''),
        { timeout: 10_000 }
      )
      .toMatch(/cr014_category/i);

    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as typeof window & { __scheduleMocks__?: number }).__scheduleMocks__ ?? 0),
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0);

    await page.evaluate(() => {
      const globalWithMocks = window as typeof window & {
        __scheduleLastUrl__?: string;
        __scheduleLastFilter__?: string;
        __scheduleLastPayload__?: unknown;
      };
      console.info(
        '[sp-schedules]',
        JSON.stringify({
          url: globalWithMocks.__scheduleLastUrl__,
          filter: globalWithMocks.__scheduleLastFilter__,
          payload: globalWithMocks.__scheduleLastPayload__,
        })
      );
    });

    const timelineRegion = page.getByRole('region', { name: /日タイムライン/ });
    await expect(timelineRegion).toBeVisible();

    const staffLane = timelineRegion.getByTestId('lane-staff');
    const staffItems = staffLane.locator('[data-testid="schedule-item"]');
    await expect
      .poll(async () => staffItems.count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
    await expect(staffLane.locator('text=予定なし')).toHaveCount(0);
    await expect(staffItems).toContainText(/午前会議/);

    const hourSlots = timelineRegion.locator('[data-testid="hour-slot"]');
    const uniqueHourCount = await hourSlots.evaluateAll((nodes) => {
      const unique = new Set(nodes.map((node) => node.getAttribute('data-hour') ?? node.textContent ?? ''));
      return unique.size;
    });
    expect(uniqueHourCount).toBe(18);
    const hasNineAm = await hourSlots.evaluateAll((nodes) => nodes.some((node) => (node.getAttribute('data-hour') ?? '') === '09:00'));
    expect(hasNineAm).toBe(true);

    const userLane = timelineRegion.getByTestId('lane-user');
    await expect
      .poll(async () => userLane.locator('text=予定なし').count(), { timeout: 5000 })
      .toBeLessThanOrEqual(1);
    const maxExpectedArticles = 3;
    const articleLocator = userLane.locator('[data-testid="schedule-item"]');
    await expect
      .poll(async () => articleLocator.count(), { timeout: 5000 })
      .toBeLessThanOrEqual(maxExpectedArticles);

    const articleCount = await articleLocator.count();
    if (articleCount > 0) {
      await expect(userLane).toContainText('09:00–09:30');
      await expect(userLane).toContainText('00:00–01:00');
    } else {
      await expect(userLane).toContainText('予定なし');
    }

    await expect(staffLane).toContainText('午前会議');
    await expect(staffLane).toContainText('09:00–12:00');

    const scrollContainer = timelineRegion.locator('[data-testid="day-scroll-container"]');
    await scrollContainer.evaluate((node) => {
      node.scrollLeft = 250;
      return null;
    });

  await timelineRegion.getByRole('button', { name: '先頭へ戻る' }).click();

    await expect.poll(async () => scrollContainer.evaluate((node) => node.scrollLeft)).toBeLessThan(5);

    await consoleGuard.assertClean();
  });
});
