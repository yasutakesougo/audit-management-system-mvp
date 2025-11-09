import { expect, test } from '@playwright/test';
import { hookConsole } from './utils/console';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';
import { clickEnabledFilterAction } from './utils/waiters';
import { runA11ySmoke } from './utils/a11y';
import { registerScheduleMocks, TIME_ZONE, type ScheduleItem } from './utils/spMock';

const TEST_NOW = '2025-10-08T03:00:00.000Z';

const buildScheduleFixtures = (count = 36) => {
  const startBase = new Date(TEST_NOW);
  startBase.setHours(9, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const start = new Date(startBase);
    start.setMinutes(start.getMinutes() + index * 15);
    const end = new Date(start.getTime() + 45 * 60 * 1000);

    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const dayKey = startIso.slice(0, 10);
    const fiscalYear = String(start.getMonth() + 1 >= 4 ? start.getFullYear() : start.getFullYear() - 1);

    const id = 9000 + index;
    const title = index === 0 ? 'デモ予定 1' : index === 1 ? 'デモ予定 2' : `追加予定 ${index + 1}`;

    return {
      Id: id,
      Title: title,
      EventDate: startIso,
      EndDate: endIso,
      AllDay: false,
      Status: 'approved',
      Location: '会議室A',
      cr014_category: index % 3 === 0 ? 'User' : index % 3 === 1 ? 'Org' : 'Staff',
      cr014_serviceType: '一時ケア',
      cr014_personType: 'Internal',
      cr014_personId: `U-${index + 1}`,
      cr014_personName: `利用者 ${index + 1}`,
      cr014_staffIds: [`${index + 1}`],
      cr014_staffNames: [`スタッフ ${index + 1}`],
      cr014_dayKey: dayKey,
      cr014_fiscalYear: fiscalYear,
      '@odata.etag': `"${id}"`,
    } as const;
  });
};

const scheduleFixtures = buildScheduleFixtures();

const materializeScheduleItems = (items: ReturnType<typeof buildScheduleFixtures>): ScheduleItem[] =>
  items.map((item) => {
    const copy: ScheduleItem = {
      ...item,
      cr014_staffIds: item.cr014_staffIds ? [...item.cr014_staffIds] : undefined,
      cr014_staffNames: item.cr014_staffNames ? [...item.cr014_staffNames] : undefined,
    };
    return copy;
  });

test.describe('schedule list view', () => {
  test('filters, sorts, paginates, and shows details', async ({ page }) => {
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
    const globalWithDate = window as typeof window & { Date: DateConstructor };
    globalWithDate.Date = MockDate as unknown as DateConstructor;

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

    await registerScheduleMocks(page, {
      User: materializeScheduleItems(scheduleFixtures.filter((item) => item.cr014_category === 'User')),
      Staff: materializeScheduleItems(scheduleFixtures.filter((item) => item.cr014_category === 'Staff')),
      Org: materializeScheduleItems(scheduleFixtures.filter((item) => item.cr014_category === 'Org')),
    });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ value: [] }), headers: { 'content-type': 'application/json' } }),
    );

    await mockEnsureScheduleList(page);

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 5678 } },
      fallback: { status: 404, body: 'not mocked' },
      lists: [
        { name: 'Schedules', aliases: ['ScheduleEvents'], items: scheduleFixtures },
        { name: 'SupportRecord_Daily', items: [] },
        { name: 'StaffDirectory', items: [] },
      ],
    });

  await page.goto('/schedule', { waitUntil: 'load' });
  await expect(page.getByTestId('schedule-page-root')).toBeVisible({ timeout: 15_000 });
    const listTab = page.getByRole('tab', { name: 'リスト', exact: true });
    await listTab.click();

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

    const listRoot = page.getByTestId('schedule-list-root');
    await expect(listRoot).toBeVisible();

  const titleColumn = listRoot.locator('th[data-sort-field="title"]');
  const datetimeColumn = listRoot.locator('th[data-sort-field="datetime"]');
  await expect(titleColumn).toHaveAttribute('aria-sort', 'none');
  await expect(datetimeColumn).toHaveAttribute('aria-sort', 'ascending');

    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as typeof window & { __scheduleLastFilter__?: string }).__scheduleLastFilter__ ?? ''),
        { timeout: 10_000 }
      )
      .toMatch(/cr014_category/i);

    await expect
      .poll(
        async () => page.evaluate(() => (window as typeof window & { __scheduleMocks__?: number }).__scheduleMocks__ ?? 0),
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const globalWithMocks = window as typeof window & {
              __scheduleLastPayload__?: { count?: number | string | null } | null;
            };
            const payload = globalWithMocks.__scheduleLastPayload__;
            if (payload && typeof payload === 'object' && 'count' in payload) {
              const value = (payload as { count?: number | string | null }).count;
              if (typeof value === 'number') return value;
              if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
            }
            return 0;
          }),
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

    const toolbar = listRoot.locator('[data-filter-toolbar="true"][data-scope="schedule"][data-debounced]');
    const periodFilters = toolbar.getByRole('group', { name: '期間' });

    const clickPeriodFilter = async (label: string) => {
      const button = periodFilters.getByRole('button', { name: label });
      await button.waitFor({ state: 'attached' });
      const pressed = await button.getAttribute('aria-pressed');
      if (pressed !== 'true') {
        await button.click();
      }
    };

    const rows = listRoot.locator('[data-schedule-row]');

    await clickPeriodFilter('今日');
    const todayCount = await rows.count();
    expect(todayCount).toBeGreaterThan(0);
    await expect(rows.first()).toContainText('デモ予定');
    await expect(listRoot.locator('[data-schedule-row][data-status]')).toHaveCount(todayCount);

    await runA11ySmoke(page, 'ScheduleListView', { includeBestPractices: true });

    await toolbar.getByRole('button', { name: '申請中' }).click();
    const emptyState = page.getByTestId('schedule-list-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveAttribute('role', 'status');
    await expect(emptyState).toHaveAttribute('aria-live', 'polite');
  await runA11ySmoke(page, 'ScheduleListViewEmptyState', { includeBestPractices: true });

    await clickEnabledFilterAction(page, 'reset', { scope: 'schedule' });
    await expect(rows).toHaveCount(todayCount);

    const searchInput = toolbar.getByPlaceholder('予定名 / メモ / 担当');
    await searchInput.click();
    await searchInput.type('デモ予定 2', { delay: 30 });
    await expect.poll(() => searchInput.inputValue(), { timeout: 3_000 }).toBe('デモ予定 2');

    await expect(rows).toHaveCount(1, { timeout: 10_000 });
    await expect(rows.first()).toContainText('デモ予定 2');

    const clearSearchButton = toolbar.getByRole('button', { name: '検索条件をクリア' });
    await expect(clearSearchButton).toBeVisible();
    await expect(clearSearchButton).not.toHaveAttribute('aria-disabled', 'true');
    await expect(clearSearchButton).toBeEnabled({ timeout: 3_000 });
    await clearSearchButton.click();

    await expect.poll(() => searchInput.inputValue(), { timeout: 3_000 }).toBe('');
    await expect(rows).toHaveCount(todayCount);

    await clickPeriodFilter('今週');
    await expect(rows).toHaveCount(todayCount);

    await clickPeriodFilter('すべて');
    await expect(rows).toHaveCount(todayCount);

  const sentinel = listRoot.getByTestId('list-sentinel');
  await expect(sentinel).toBeAttached();

  const titleSort = listRoot.getByRole('button', { name: 'タイトルで並べ替え' });
    const beforeSort = await rows.first().innerText();
  await titleSort.click();
  await expect(titleColumn).toHaveAttribute('aria-sort', 'ascending');
    const afterSortAsc = await rows.first().innerText();
    await titleSort.click();
  await expect(titleColumn).toHaveAttribute('aria-sort', 'descending');
    const afterSortDesc = await rows.first().innerText();
    expect(afterSortAsc).not.toEqual(afterSortDesc);
    expect([afterSortAsc, afterSortDesc]).toContain(beforeSort);
    await runA11ySmoke(page, 'ScheduleListViewSorted', { includeBestPractices: true });

    await rows.first().click();
    const detailDialog = page.getByTestId('schedule-detail-dialog');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog).toContainText('デモ予定');
    await detailDialog.getByRole('button', { name: '閉じる' }).click();
    await expect(detailDialog).toBeHidden();

    await consoleGuard.assertClean();
  });
});
