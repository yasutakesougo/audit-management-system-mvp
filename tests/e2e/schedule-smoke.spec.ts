import { expect, test } from '@playwright/test';
import { mockEnsureScheduleList } from './_helpers/mockEnsureScheduleList';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';

const TEST_NOW = (() => {
  const now = new Date();
  now.setHours(3, 0, 0, 0);
  return now.toISOString();
})();

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

const buildScheduleFixtures = () => {
  const today = new Date(TEST_NOW);
  today.setHours(0, 0, 0, 0);

  const slot = (dayOffset: number, startHour: number, durationHours: number) => {
    const start = new Date(today);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const month = start.getMonth() + 1;
    const day = start.getDate();
    const dayKey = `${start.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const fiscalYear = month >= 4 ? start.getFullYear() : start.getFullYear() - 1;
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      dayKey,
      fiscalYear: String(fiscalYear),
    };
  };

  const morningVisit = slot(0, 9, 1);
  const staffMeeting = slot(1, 11, 1.5);
  const orgEvent = slot(2, 14, 1);

  return [
    {
      Id: 9101,
      Title: '訪問リハビリ',
      EventDate: morningVisit.startIso,
      EndDate: morningVisit.endIso,
      AllDay: false,
      Status: 'approved',
      Location: '利用者宅A',
      cr014_category: 'User',
      cr014_serviceType: '一時ケア',
      cr014_personType: 'Internal',
      cr014_personId: 'U-201',
      cr014_personName: '田中 実',
      cr014_staffIds: ['301'],
      cr014_staffNames: ['阿部 真央'],
      cr014_dayKey: morningVisit.dayKey,
      cr014_fiscalYear: morningVisit.fiscalYear,
      '@odata.etag': '"1"',
    },
    {
      Id: 9201,
      Title: '週次カンファレンス',
      EventDate: staffMeeting.startIso,
      EndDate: staffMeeting.endIso,
      AllDay: false,
      Status: 'submitted',
      Location: '会議室A',
      cr014_category: 'Staff',
      cr014_personType: 'Internal',
      cr014_personName: '吉田 千尋',
      cr014_staffIds: ['401'],
      cr014_staffNames: ['吉田 千尋'],
      cr014_dayKey: staffMeeting.dayKey,
      cr014_fiscalYear: staffMeeting.fiscalYear,
      '@odata.etag': '"2"',
    },
    {
      Id: 9301,
      Title: '地域連携ミーティング',
      EventDate: orgEvent.startIso,
      EndDate: orgEvent.endIso,
      AllDay: false,
      Status: 'approved',
      Location: '本部ホール',
      cr014_category: 'Org',
      cr014_personType: 'Internal',
      cr014_personName: '調整担当',
      cr014_dayKey: orgEvent.dayKey,
      cr014_fiscalYear: orgEvent.fiscalYear,
      '@odata.etag': '"3"',
    },
  ];
};

const scheduleFixtures = buildScheduleFixtures();

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

    await page.addInitScript(() => {
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_FEATURE_SCHEDULES: '1',
        VITE_FEATURE_SCHEDULES_GRAPH: '1',
        VITE_DEMO_MODE: '0',
        MODE: 'production',
        DEV: '0',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
      };
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('feature:schedules', '1');
    });

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

    await mockEnsureScheduleList(page);

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 5678 } },
      fallback: { status: 404, body: 'not mocked' },
      debug: true,
      lists: [
        { name: 'Schedules', aliases: ['ScheduleEvents'], items: scheduleFixtures },
        { name: 'SupportRecord_Daily', items: [] },
        { name: 'StaffDirectory', items: [] },
      ],
    });
  });

  test('shows tabs and demo appointments on week view', async ({ page }) => {
    page.on('request', (request) => {
      if (request.url().includes('/_api/web/')) {
        console.log('[sp-request]', request.method(), request.url());
      }
    });

  await page.goto('/schedule', { waitUntil: 'load' });
  await expect(page.getByTestId('schedule-page-root')).toBeVisible({ timeout: 15000 });

  const weekTab = page.getByRole('tab', { name: '週', exact: true });
  await expect(weekTab).toBeVisible();
  await expect(page.getByRole('tab', { name: '日', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /リスト|タイムライン/ })).toBeVisible();

  await weekTab.click();
  await expect(page.getByTestId('schedule-week-root')).toBeVisible({ timeout: 15000 });

    const items = page.getByTestId('schedule-item');
    await expect(items.first()).toBeVisible();
  });
});

