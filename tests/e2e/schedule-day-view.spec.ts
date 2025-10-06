import { expect, test } from '@playwright/test';
import { hookConsole } from './utils/console';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';

const TEST_NOW = '2025-10-08T03:00:00.000Z';

const scheduleFixtures = {
  User: [
    {
      Id: 9101,
      Title: '訪問リハビリ',
      EventDate: '2025-10-08T00:00:00.000Z',
      EndDate: '2025-10-08T00:30:00.000Z',
      AllDay: false,
      Status: 'approved',
      Location: 'リハビリ室A',
      cr014_category: 'User',
      cr014_serviceType: '一時ケア',
      cr014_personType: 'Internal',
      cr014_personId: 'U-101',
      cr014_personName: '川崎 朗',
      cr014_staffIds: ['301'],
      cr014_staffNames: ['阿部 真央'],
      cr014_dayKey: '2025-10-08',
      cr014_fiscalYear: '2025',
      '@odata.etag': '"9"',
    },
    {
      Id: 9102,
      Title: '訪問看護',
      EventDate: '2025-10-08T00:15:00.000Z',
      EndDate: '2025-10-08T01:00:00.000Z',
      AllDay: false,
      Status: 'submitted',
      Location: '利用者宅B',
      cr014_category: 'User',
      cr014_serviceType: 'ショートステイ',
      cr014_personType: 'Internal',
      cr014_personId: 'U-102',
      cr014_personName: '古山 美紀',
      cr014_staffIds: ['302'],
      cr014_staffNames: ['蒼井 純'],
      cr014_dayKey: '2025-10-08',
      cr014_fiscalYear: '2025',
      '@odata.etag': '"10"',
    },
    {
      Id: 9103,
      Title: '夜間対応',
      EventDate: '2025-10-07T14:30:00.000Z',
      EndDate: '2025-10-07T16:00:00.000Z',
      AllDay: false,
      Status: '草稿',
      Location: '利用者宅C',
      cr014_category: 'User',
      cr014_serviceType: '一時ケア',
      cr014_personType: 'Internal',
      cr014_personId: 'U-103',
      cr014_personName: '斎藤 遼',
      cr014_staffIds: ['303'],
      cr014_staffNames: ['佐伯 由真'],
      cr014_dayKey: '2025-10-07',
      cr014_fiscalYear: '2025',
      '@odata.etag': '"11"',
    },
  ],
  Staff: [
    {
      Id: 9201,
      Title: '午前会議',
      EventDate: '2025-10-08T00:00:00.000Z',
      EndDate: '2025-10-08T03:00:00.000Z',
      AllDay: false,
      Status: 'approved',
      DayPart: 'AM',
      cr014_category: 'Staff',
      cr014_personType: 'Internal',
      cr014_personName: '吉田 千尋',
      cr014_staffIds: ['401'],
      cr014_staffNames: ['吉田 千尋'],
      cr014_dayKey: '2025-10-08',
      cr014_fiscalYear: '2025',
      '@odata.etag': '"21"',
    },
  ],
  Org: [
    {
      Id: 9301,
      Title: '連絡会議',
      EventDate: '2025-10-08T04:30:00.000Z',
      EndDate: '2025-10-08T05:30:00.000Z',
      AllDay: false,
      Status: 'approved',
      SubType: '会議',
      Location: '会議室B',
      cr014_category: 'Org',
      cr014_personType: 'Internal',
      cr014_personName: '調整担当',
      cr014_dayKey: '2025-10-08',
      cr014_fiscalYear: '2025',
      '@odata.etag': '"31"',
    },
  ],
} as const;

const scheduleResponseHeaders = {
  'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
  'Cache-Control': 'no-store',
};

test.describe('schedule day timeline', () => {
  test('renders 24 hour slots and clamps cross-day events', async ({ page }) => {
    const consoleGuard = hookConsole(page);

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
      (window as any).Date = MockDate;

      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
      window.localStorage.setItem('feature:schedules', '1');
      (window as typeof window & { __TEST_NOW__?: string }).__TEST_NOW__ = now;
    }, { now: TEST_NOW });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ value: [] }), headers: { 'content-type': 'application/json' } }),
    );

    await page.addInitScript(({ fixtures, headers }) => {
      const originalFetch = window.fetch.bind(window);
      (window as typeof window & { __scheduleMocks__?: number }).__scheduleMocks__ = 0;

      const sortByEventDateInline = (items: readonly { Id?: number; EventDate?: string | null }[]) =>
        [...items].sort((a, b) => {
          const aDate = new Date(a?.EventDate ?? '').getTime();
          const bDate = new Date(b?.EventDate ?? '').getTime();
          if (aDate === bDate) {
            return (a?.Id ?? 0) - (b?.Id ?? 0);
          }
          return aDate - bDate;
        });

      const selectBucketInline = (filterValue: string | null): keyof typeof fixtures => {
        if (!filterValue) {
          return 'User';
        }
        const normalized = filterValue.toLowerCase();
        if (normalized.includes("cr014_category eq 'staff'")) {
          return 'Staff';
        }
        if (normalized.includes("cr014_category eq 'org'")) {
          return 'Org';
        }
        return 'User';
      };

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
  if (typeof rawUrl === 'string' && /\/_api\/web\/lists\/getbytitle\((%27|')schedules(%27|')\)\/items/i.test(rawUrl)) {
          (window as typeof window & { __scheduleMocks__?: number }).__scheduleMocks__! += 1;
          const target = new URL(rawUrl, window.location.origin);
          const idMatch = /items\((\d+)\)/i.exec(target.pathname);
          if (idMatch) {
            const id = Number(idMatch[1]);
            const allItems = [...fixtures.User, ...fixtures.Staff, ...fixtures.Org];
            const found = allItems.find((item) => item.Id === id);
            if (!found) {
              return new Response(JSON.stringify({}), { status: 404, headers });
            }
            return new Response(JSON.stringify(found), { status: 200, headers });
          }

          const bucket = selectBucketInline(target.searchParams.get('$filter'));
          const items = sortByEventDateInline(fixtures[bucket]);
          return new Response(JSON.stringify({ value: items }), { status: 200, headers });
        }
        return originalFetch(input, init);
      };
    }, { fixtures: scheduleFixtures, headers: scheduleResponseHeaders });

    await mockEnsureScheduleList(page);

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 5678 } },
      fallback: { status: 404, body: 'not mocked' },
      lists: [
        { name: 'SupportRecord_Daily', items: [] },
        { name: 'StaffDirectory', items: [] },
      ],
    });

    await page.goto('/schedule');

    await expect(page.getByRole('heading', { name: 'スケジュール' })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (window as typeof window & { __scheduleMocks__?: number }).__scheduleMocks__ ?? 0)).toBeGreaterThan(0);

    const viewToggle = page.getByRole('navigation', { name: 'ビュー切替' });
    await viewToggle.getByRole('button', { name: '日' }).click();

    const timelineRegion = page.getByRole('region', { name: /日タイムライン/ });
    await expect(timelineRegion).toBeVisible();

    const hourSlots = timelineRegion.locator('[data-testid="day-hour-slot"]');
    const uniqueHourCount = await hourSlots.evaluateAll((nodes) => {
      const unique = new Set(nodes.map((node) => node.getAttribute('data-hour') ?? node.textContent ?? ''));
      return unique.size;
    });
    expect(uniqueHourCount).toBe(24);
    const hasNineAm = await hourSlots.evaluateAll((nodes) => nodes.some((node) => (node.getAttribute('data-hour') ?? '') === '09:00'));
    expect(hasNineAm).toBe(true);

    const userLane = timelineRegion.getByRole('gridcell', { name: /利用者レーン・2025年10月8日/ });
  await expect(userLane.locator('text=予定なし')).toHaveCount(0);
  await expect(userLane.getByRole('article')).toHaveCount(3);
    await expect(userLane).toContainText('09:00–09:30');
    await expect(userLane).toContainText('00:00–01:00');

    const staffLane = timelineRegion.getByRole('gridcell', { name: /職員レーン・2025年10月8日/ });
    await expect(staffLane).toContainText('午前会議');
    await expect(staffLane).toContainText('09:00–12:00');

    const scrollContainer = timelineRegion.locator('[data-testid="day-scroll-container"]');
    await scrollContainer.evaluate((node) => {
      node.scrollLeft = 250;
      return null;
    });

    await timelineRegion.getByRole('button', { name: '今日へ移動' }).click();

    await expect.poll(async () => scrollContainer.evaluate((node) => node.scrollLeft)).toBeLessThan(5);

    await consoleGuard.assertClean();
  });
});
