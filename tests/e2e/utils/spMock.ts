import type { Page } from '@playwright/test';

export type ScheduleItem = {
  Id: number;
  Title: string;
  EventDate: string;
  EndDate: string;
  AllDay: boolean;
  Status: string;
  Location?: string;
  DayPart?: string;
  cr014_category: 'User' | 'Staff' | 'Org';
  cr014_serviceType?: string;
  cr014_personType: string;
  cr014_personId?: string;
  cr014_personName: string;
  cr014_staffIds?: string[];
  cr014_staffNames?: string[];
  cr014_dayKey: string;
  cr014_fiscalYear: string;
  SubType?: string;
  '@odata.etag': string;
};

export type ScheduleFixtures = {
  User?: readonly ScheduleItem[];
  Staff?: readonly ScheduleItem[];
  Org?: readonly ScheduleItem[];
};

const TIME_ZONE = 'Asia/Tokyo' as const;

const scheduleResponseHeaders: Record<string, string> = {
  'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
  'Cache-Control': 'no-store',
};

export async function registerScheduleMocks(page: Page, fixtures: ScheduleFixtures): Promise<void> {
  const normalizedFixtures: Required<ScheduleFixtures> = {
    User: fixtures.User ? [...fixtures.User] : [],
    Staff: fixtures.Staff ? [...fixtures.Staff] : [],
    Org: fixtures.Org ? [...fixtures.Org] : [],
  };

  await page.addInitScript(() => {
    const globalWithMocks = window as typeof window & {
      __scheduleMocks__?: number;
      __scheduleLastFilter__?: string;
      __scheduleLastUrl__?: string;
      __scheduleLastPayload__?: unknown;
    };
    globalWithMocks.__scheduleMocks__ = 0;
    globalWithMocks.__scheduleLastFilter__ = '';
    globalWithMocks.__scheduleLastUrl__ = '';
    globalWithMocks.__scheduleLastPayload__ = null;
  });

  await page.addInitScript(
    ({ fixtures: initFixtures, headers }) => {
      const originalFetch = window.fetch.bind(window);
      const globalWithMocks = window as typeof window & {
        __scheduleMocks__?: number;
        __scheduleLastFilter__?: string;
        __scheduleLastUrl__?: string;
        __scheduleLastPayload__?: unknown;
      };

      const totalCount = Object.values(initFixtures).reduce((sum, bucket) => sum + bucket.length, 0);
      globalWithMocks.__scheduleMocks__ = totalCount;

      const sortByEventDate = (items: readonly { Id?: number; EventDate?: string | null }[]) =>
        [...items].sort((a, b) => {
          const aDate = new Date(a?.EventDate ?? '').getTime();
          const bDate = new Date(b?.EventDate ?? '').getTime();
          if (aDate === bDate) {
            return (a?.Id ?? 0) - (b?.Id ?? 0);
          }
          return aDate - bDate;
        });

      const selectBucket = (filterValue: string | null): keyof typeof initFixtures => {
        if (!filterValue) {
          return 'User';
        }
        const normalizedFilter = filterValue.toLowerCase();
        if (normalizedFilter.includes("cr014_category eq 'staff'")) {
          return 'Staff';
        }
        if (normalizedFilter.includes('cr014_category eq "staff"')) {
          return 'Staff';
        }
        if (normalizedFilter.includes("cr014_category eq 'org'")) {
          return 'Org';
        }
        if (normalizedFilter.includes('cr014_category eq "org"')) {
          return 'Org';
        }
        return 'User';
      };

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (typeof rawUrl === 'string' && /\/_api\/web\/lists\/getbytitle\(/i.test(rawUrl) && /\/items/i.test(rawUrl)) {
          globalWithMocks.__scheduleMocks__ = totalCount;
          const target = new URL(rawUrl, window.location.origin);
          const listNameMatch = /getbytitle\(([^)]+)\)/i.exec(target.pathname);
          const listName = listNameMatch ? decodeURIComponent(listNameMatch[1]).replace(/["']/g, '').toLowerCase() : '';
          const filterValue = target.searchParams.get('$filter') ?? '';
          globalWithMocks.__scheduleLastUrl__ = rawUrl;
          globalWithMocks.__scheduleLastFilter__ = filterValue;
          if (listName !== 'schedules' && listName !== 'supportschedule' && listName !== 'scheduleevents') {
            globalWithMocks.__scheduleLastPayload__ = { count: 0, sample: null, listName };
            return originalFetch(input, init);
          }
          const idMatch = /items\((\d+)\)/i.exec(target.pathname);
          if (idMatch) {
            const id = Number(idMatch[1]);
            const allItems = [...initFixtures.User, ...initFixtures.Staff, ...initFixtures.Org];
            const found = allItems.find((item) => item.Id === id);
            if (!found) {
              globalWithMocks.__scheduleLastPayload__ = { count: 0, sample: null };
              return new Response(JSON.stringify({}), { status: 404, headers });
            }
            globalWithMocks.__scheduleMocks__ = 1;
            globalWithMocks.__scheduleLastPayload__ = { count: 1, sample: found };
            return new Response(JSON.stringify(found), { status: 200, headers });
          }

          const bucket = selectBucket(target.searchParams.get('$filter'));
          const items = sortByEventDate(initFixtures[bucket]);
          globalWithMocks.__scheduleMocks__ = items.length;
          globalWithMocks.__scheduleLastPayload__ = { count: items.length, sample: items[0] ?? null };
          return new Response(JSON.stringify({ value: items }), { status: 200, headers });
        }
        return originalFetch(input, init);
      };
    },
    { fixtures: normalizedFixtures, headers: scheduleResponseHeaders }
  );
}

export { TIME_ZONE };