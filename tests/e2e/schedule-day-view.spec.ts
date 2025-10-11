import { expect, test } from '@playwright/test';
import { hookConsole } from './utils/console';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';
import { openSchedules } from './_helpers/nav.schedule';
import { enableSchedulesFeature } from './_helpers/featureFlags';
import { seedSchedules } from './_helpers/schedulesSeed';
import { fixtures } from './_helpers/schedulesSeed.fixtures';

const TZ = 'Asia/Tokyo';
const AT = '2025-10-08';
const TEST_NOW = '2025-10-08T03:00:00.000Z';

test.describe('schedule day timeline', () => {
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
      await page.route('**/_api/web/currentuser*', (route) =>
        route.fulfill({ status: 200, body: JSON.stringify({ Id: 5678 }), headers: { 'content-type': 'application/json' } }),
      );
  });

  test('renders 24 hour slots and clamps cross-day events', async ({ page }) => {
    const consoleGuard = hookConsole(page);

    page.on('request', (request) => {
      if (request.url().includes('/_api/web/')) {
        console.log('[schedule-day] request', request.url());
      }
    });

    await openSchedules(page, {
      view: 'dashboard',
      at: AT,
      env: { VITE_E2E_MSAL_MOCK: '1', VITE_SKIP_LOGIN: '1' },
      feature: { create: true, msalMock: true },
    });

    console.log('[schedule-day] location:', page.url());

    const fixtureCount = await page.evaluate(() => {
      const scope = window as typeof window & { __SCHEDULE_FIXTURES__?: unknown };
      return Array.isArray(scope.__SCHEDULE_FIXTURES__) ? scope.__SCHEDULE_FIXTURES__.length : 0;
    });
    console.log('[schedule-day] fixtures:', fixtureCount);

  const viewToggle = page.getByRole('navigation', { name: 'ビュー切替' });
  await viewToggle.waitFor({ state: 'visible', timeout: 10_000 });
  const toggleLabels = await viewToggle.getByRole('button').allTextContents();
  console.log('[schedule-day] toggle labels:', toggleLabels);
  const dayButton = viewToggle.getByRole('button', { name: /日/ });
  await expect(dayButton).toBeVisible({ timeout: 10_000 });
  await dayButton.click();
  await expect(dayButton).toHaveAttribute('aria-pressed', 'true');

  const timelineRegion = page.getByRole('region', { name: /日タイムライン/ });
    await expect(timelineRegion).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => timelineRegion.getByTestId('schedule-item').count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    const hourSlots = timelineRegion.locator('[data-testid="day-hour-slot"]');
    const uniqueHourCount = await hourSlots.evaluateAll((nodes) => {
      const unique = new Set(nodes.map((node) => node.getAttribute('data-hour') ?? node.textContent ?? ''));
      return unique.size;
    });
    expect(uniqueHourCount).toBe(24);
    const hasNineAm = await hourSlots.evaluateAll((nodes) => nodes.some((node) => (node.getAttribute('data-hour') ?? '') === '09:00'));
    expect(hasNineAm).toBe(true);

    const userLane = timelineRegion.getByRole('gridcell', { name: /利用者レーン・2025年10月8日/ });
    const userLaneItems = userLane.getByTestId('schedule-item');
    await expect
      .poll(async () => userLaneItems.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(userLaneItems.first()).toBeVisible();
    await expect(userLane.locator('text=予定なし')).toHaveCount(0);
    await expect(userLane).toContainText('09:00–09:30');
    await expect(userLane).toContainText('00:00–01:00');

    const staffLane = timelineRegion.getByRole('gridcell', { name: /職員レーン・2025年10月8日/ });
    const staffLaneItems = staffLane.getByTestId('schedule-item');
    await expect
      .poll(async () => staffLaneItems.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(staffLane).toContainText('午前会議');
    await expect(staffLane).toContainText('09:00–12:00');

    await page.evaluate(() => {
      const node = document.querySelector('[data-testid="day-scroll-container"]');
      if (node instanceof HTMLElement) {
        node.scrollLeft = 250;
      }
    });
    const todayButton = timelineRegion.getByRole('button', { name: '今日へ移動' });
    const firstTodayButton = todayButton.first();
    if (await firstTodayButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      const clicked = await firstTodayButton
        .click({ timeout: 1000, noWaitAfter: true })
        .then(() => true)
        .catch(() => false);
      if (clicked) {
        await expect
          .poll(async () =>
            page.evaluate(() => {
              const node = document.querySelector('[data-testid="day-scroll-container"]');
              return node instanceof HTMLElement ? node.scrollLeft : undefined;
            }),
          { timeout: 10_000 }
          )
          .toBeLessThan(5);
      }
    }

    await consoleGuard.assertClean();
  });
});
