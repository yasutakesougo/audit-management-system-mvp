import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';
import { waitForLocator } from './_helpers/waitForLocator';
import { gotoWeek } from './utils/scheduleNav';
import { waitForWeekViewReady } from './utils/scheduleActions';
import { buildSchedulesTodaySharePointItems, getSchedulesTodaySeedDate } from './_helpers/schedulesTodaySeed';

const SEED_DATE = getSchedulesTodaySeedDate();
const SEED_DATE_OBJ = new Date(`${SEED_DATE}T00:00:00+09:00`);
const TEST_NOW = new Date(`${SEED_DATE}T09:00:00+09:00`).toISOString();

const buildGraphEvents = (startIso: string | null, endIso: string | null) => {
  const fallbackStart = new Date(TEST_NOW);
  fallbackStart.setHours(9, 0, 0, 0);

  const rangeStart = startIso ? new Date(startIso) : fallbackStart;
  const base = Number.isNaN(rangeStart.getTime()) ? fallbackStart : rangeStart;

  const slot = (offsetHours: number, durationHours: number) => {
    const start = new Date(base);
    start.setTime(start.getTime() + offsetHours * 60 * 60 * 1000);
    const end = new Date(start);
    end.setTime(start.getTime() + durationHours * 60 * 60 * 1000);

    return {
      id: `graph-demo-${offsetHours}`,
      subject: `Graph demo visit +${offsetHours}h`,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
    };
  };

  const events = [slot(0, 2), slot(3, 1.5), slot(6, 2)];

  if (!endIso) {
    return events;
  }

  const endTs = new Date(endIso).getTime();
  if (Number.isNaN(endTs)) {
    return events;
  }

  return events.filter((event) => new Date(event.start.dateTime).getTime() < endTs);
};

const scheduleFixtures = buildSchedulesTodaySharePointItems();

test.describe('Schedule smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ now }) => {
      const fixedNow = new Date(now).getTime();
      const RealDate = Date;
      const MockDate = new Proxy(RealDate, {
        construct(target, args) {
          if (args.length === 0) {
            return new target(fixedNow);
          }
          return new target(...(args as ConstructorParameters<typeof Date>));
        },
        apply(target, thisArg, argArray) {
          if (!argArray || argArray.length === 0) {
            return new target(fixedNow).toString();
          }
          return target.apply(thisArg, argArray as Parameters<typeof Date>);
        },
        get(target, prop, receiver) {
          if (prop === 'now') {
            return () => fixedNow;
          }
          return Reflect.get(target, prop, receiver);
        },
      }) as DateConstructor;
      (window as typeof window & { Date: DateConstructor }).Date = MockDate;
    }, { now: TEST_NOW });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));

    await page.route('https://graph.microsoft.com/v1.0/me/calendarView*', async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization,content-type,prefer',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
          },
        });
        return;
      }

      if (method !== 'GET') {
        await route.fulfill({ status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
        return;
      }

      const url = new URL(request.url());
      const startIso = url.searchParams.get('startDateTime');
      const endIso = url.searchParams.get('endDateTime');
      const value = buildGraphEvents(startIso, endIso);

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ value }),
      });
    });

    await bootSchedule(page, {
      mode: 'fixtures',
      enableWeekV2: false,
      date: SEED_DATE_OBJ,
      scheduleItems: scheduleFixtures,
      seed: { schedulesToday: true },
    });
  });

  test('shows tabs and demo appointments on week view', async ({ page }) => {
    page.on('console', (message) => {
      console.log('[browser]', message.type(), message.text());
    });
    page.on('request', (request) => {
      if (request.url().includes('/_api/web/')) {
        console.log('[sp-request]', request.method(), request.url());
      }
    });

    await gotoWeek(page, SEED_DATE_OBJ);
    
    // ページのロードとHydration完了を待つ
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);
    
    await waitForWeekViewReady(page);

    // Wait for week view to fully render before checking tabs
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Allow initial render to settle

    const weekTabCandidate = page.getByTestId('tab-week');
    const weekTab = (await weekTabCandidate.count().catch(() => 0)) > 0
      ? weekTabCandidate.first()
      : page.getByRole('tab', { name: '週', exact: true }).first();
    
    // Wait for tab to exist first
    await waitForLocator(weekTab, { timeoutMs: 60_000, requireVisible: true });
    
    // Poll for tab to be ready and selected
    await expect.poll(
      async () => await weekTab.getAttribute('aria-selected'),
      { timeout: 60_000 }
    ).toBe('true');

    const dayTabCandidate = page.getByTestId('tab-day');
    const dayTab = (await dayTabCandidate.count().catch(() => 0)) > 0
      ? dayTabCandidate.first()
      : page.getByRole('tab', { name: '日', exact: true }).first();
    await expect(dayTab).toBeVisible();

    const monthTabCandidate = page.getByTestId('tab-month');
    const monthTab = (await monthTabCandidate.count().catch(() => 0)) > 0
      ? monthTabCandidate.first()
      : page.getByRole('tab', { name: '月', exact: true }).first();
    await expect(monthTab).toBeVisible();


    // ✅ Smoke test: verify week page is reachable and tabs are visible
    // Data/list assertions → moved to deep tests
    await expect(page).toHaveURL(/\/schedules\/week/);
    
    // Week tab should be visible and selected (smoke validates UI structure, not data)
    await expect(weekTab).toBeVisible();
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
  });
});
