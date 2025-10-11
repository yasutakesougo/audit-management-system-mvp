import { expect, test } from '@playwright/test';
import { hookConsole } from './utils/console';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';
import { clickEnabledFilterAction } from './utils/waiters';
import { runA11ySmoke } from './utils/a11y';
import { enableSchedulesFeature } from './_helpers/flags';

const TEST_NOW = '2025-10-08T03:00:00.000Z';

const baseSchedules = [
  {
    Id: 2001,
    Title: '訪問ケア（午前）',
    EventDate: '2025-10-08T00:30:00.000Z',
    EndDate: '2025-10-08T01:30:00.000Z',
    AllDay: false,
    Status: 'draft',
    Location: '居室A',
    UserIdId: 501,
    StaffIdId: 601,
    Notes: '今日のメモ',
    RecurrenceData: null,
    '@odata.etag': '"101"',
  },
  {
    Id: 2002,
    Title: '午後リハビリ',
    EventDate: '2025-10-08T05:00:00.000Z',
    EndDate: '2025-10-08T06:30:00.000Z',
    AllDay: false,
    Status: 'approved',
    Location: 'リハビリ室',
    UserIdId: 502,
    StaffIdId: 602,
    Notes: '午後ケア',
    RecurrenceData: 'FREQ=WEEKLY;BYDAY=WE',
    '@odata.etag': '"102"',
  },
  {
    Id: 2003,
    Title: '申請中チェック',
    EventDate: '2025-10-09T02:00:00.000Z',
    EndDate: '2025-10-09T03:00:00.000Z',
    AllDay: false,
    Status: 'submitted',
    Location: '会議室B',
    UserIdId: 503,
    StaffIdId: 603,
    Notes: '週内の確認',
    RecurrenceData: null,
    '@odata.etag': '"103"',
  },
  {
    Id: 2004,
    Title: '先週レビュー',
    EventDate: '2025-09-30T04:00:00.000Z',
    EndDate: '2025-09-30T05:00:00.000Z',
    AllDay: false,
    Status: 'draft',
    Location: '本部',
    UserIdId: 504,
    StaffIdId: 604,
    Notes: '先週の振り返り',
    RecurrenceData: null,
    '@odata.etag': '"104"',
  },
  {
    Id: 2005,
    Title: 'Alpha Task',
    EventDate: '2025-10-06T01:00:00.000Z',
    EndDate: '2025-10-06T02:00:00.000Z',
    AllDay: false,
    Status: 'draft',
    Location: 'Room 1',
    UserIdId: 505,
    StaffIdId: 605,
    Notes: 'Alphabetical check',
    RecurrenceData: null,
    '@odata.etag': '"105"',
  },
  {
    Id: 2006,
    Title: 'Zephyr Visit',
    EventDate: '2025-10-11T03:00:00.000Z',
    EndDate: '2025-10-11T04:00:00.000Z',
    AllDay: false,
    Status: 'approved',
    Location: 'Hall C',
    UserIdId: 506,
    StaffIdId: 606,
    Notes: 'Sort order validation',
    RecurrenceData: null,
    '@odata.etag': '"106"',
  },
] as const;

const bulkStart = Date.parse('2025-11-01T00:00:00.000Z');
const bulkSchedules = Array.from({ length: 24 }, (_, index) => {
  const start = new Date(bulkStart + index * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  const padded = String(index + 1).padStart(2, '0');
  return {
    Id: 3000 + index,
    Title: `イベント ${padded}`,
    EventDate: start.toISOString(),
    EndDate: end.toISOString(),
    AllDay: index % 7 === 0,
    Status: index % 3 === 0 ? 'draft' : index % 3 === 1 ? 'submitted' : 'approved',
    Location: `第${(index % 5) + 1}会議室`,
    UserIdId: 700 + index,
    StaffIdId: 800 + index,
    Notes: `イベントメモ${padded}`,
    RecurrenceData: null,
    '@odata.etag': `"4${index}"`,
  } as const;
});

const scheduleFixtures = [...baseSchedules, ...bulkSchedules];

const scheduleResponseHeaders = {
  'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
  'Cache-Control': 'no-store',
};

test.describe('schedule list view', () => {
  test('filters, sorts, paginates, and shows details', async ({ page }) => {
    const consoleGuard = hookConsole(page);

    await enableSchedulesFeature(page);

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
  (window as typeof window & { Date: DateConstructor }).Date = MockDate as unknown as DateConstructor;

      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
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

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
        if (typeof rawUrl === 'string' && /\/_api\/web\/lists\/getbytitle\((%27|')schedules(%27|')\)\/items/i.test(rawUrl)) {
          (window as typeof window & { __scheduleMocks__?: number }).__scheduleMocks__! += 1;
          const target = new URL(rawUrl, window.location.origin);
          const idMatch = /items\((\d+)\)/i.exec(target.pathname);
          if (idMatch) {
            const id = Number(idMatch[1]);
            const found = fixtures.find((item) => item.Id === id) ?? null;
            if (!found) {
              return new Response(JSON.stringify({}), { status: 404, headers });
            }
            return new Response(JSON.stringify(found), { status: 200, headers });
          }

          const items = sortByEventDateInline(fixtures);
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
    await viewToggle.getByRole('button', { name: 'リスト' }).click();

  const listRoot = page.getByTestId('schedule-list-root');
  await expect(listRoot).toBeVisible();

  const toolbar = page.locator('[data-filter-toolbar][data-scope="schedule"]');

  const rows = listRoot.locator('[data-schedule-row]');

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('訪問ケア（午前）');
    await expect(rows.nth(1)).toContainText('午後リハビリ');
  await expect(listRoot.locator('[data-schedule-row][data-status="下書き"]')).toHaveCount(1);
  await expect(listRoot.locator('[data-schedule-row][data-status="承認済み"]')).toHaveCount(1);

    await runA11ySmoke(page, 'ScheduleListView', { includeBestPractices: true });

  await toolbar.getByRole('button', { name: '申請中' }).click();
    await expect(page.getByText('No schedules found for the selected filters.')).toBeVisible();

  await clickEnabledFilterAction(page, 'reset', { scope: 'schedule' });
    await expect(rows).toHaveCount(2);

  await toolbar.getByPlaceholder('予定名 / メモ / 担当').fill('午後');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('午後リハビリ');
  await clickEnabledFilterAction(page, 'clear-search', { scope: 'schedule' });
    await expect(rows).toHaveCount(2);

  await toolbar.getByRole('button', { name: '今週' }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.filter({ hasText: '申請中チェック' })).toHaveCount(1);

  await toolbar.getByRole('group', { name: '期間' }).getByRole('button', { name: 'すべて' }).click();
    await expect(rows).toHaveCount(20);

  const sentinel = listRoot.getByTestId('list-sentinel');
    await sentinel.scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(scheduleFixtures.length);
    await expect(listRoot.locator('[data-schedule-row][data-all-day="1"]')).toHaveCount(4);
    await expect(listRoot.locator('[data-schedule-row][data-recurrence="1"]')).toHaveCount(1);

  const titleSort = listRoot.getByRole('button', { name: 'タイトルで並べ替え' });
    await titleSort.click();
    await expect(rows.first()).toContainText('Alpha Task');
    await sentinel.scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(scheduleFixtures.length);
    await titleSort.click();
    await sentinel.scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(scheduleFixtures.length);
  await expect(rows.last()).toContainText('Alpha Task');

    await rows.filter({ hasText: '訪問ケア（午前）' }).first().click();
    const detailDialog = page.getByTestId('schedule-detail-dialog');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog).toContainText('居室A');
    await expect(detailDialog).toContainText('今日のメモ');
    await detailDialog.getByRole('button', { name: '閉じる' }).click();
    await expect(detailDialog).toBeHidden();

    await consoleGuard.assertClean();
  });
});
