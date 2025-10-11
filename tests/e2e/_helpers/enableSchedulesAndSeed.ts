import type { Page } from '@playwright/test';
import { enableSchedulesFeature } from './featureFlags';
import { buildDomainSchedules, type DemoSchedule } from './schedulesSeed';

type SeedOptions = {
  fixtures?: DemoSchedule[];
  feature?: Parameters<typeof enableSchedulesFeature>[1];
  env?: Record<string, string>;
  sharePointStub?: boolean;
};

const DEFAULT_FIXTURES: DemoSchedule[] = [
  {
    id: 2001,
    title: '訪問ケア（午前）',
    startUtc: '2025-10-08T00:30:00.000Z',
    endUtc: '2025-10-08T01:30:00.000Z',
    status: 'draft',
    location: '居室A',
  },
  {
    id: 2002,
    title: '午後リハビリ',
    startUtc: '2025-10-08T05:00:00.000Z',
    endUtc: '2025-10-08T06:30:00.000Z',
    status: 'approved',
    location: 'リハビリ室',
  },
];

export async function enableSchedulesAndSeed(page: Page, options: SeedOptions = {}) {
  await enableSchedulesFeature(page, options.feature);

  const seeds = options.fixtures && options.fixtures.length > 0 ? options.fixtures : DEFAULT_FIXTURES;
  const fixtures = buildDomainSchedules(seeds);

  await page.addInitScript(({ schedules, env }) => {
    try {
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
      window.localStorage.setItem('feature:schedules', '1');
    } catch {
      /* ignore storage errors */
    }

    const scope = window as typeof window & { __ENV__?: Record<string, string>; __SCHEDULE_FIXTURES__?: unknown };
    scope.__ENV__ = {
      ...(scope.__ENV__ ?? {}),
      VITE_SCHEDULES_TZ: scope.__ENV__?.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo',
      ...env,
    };
    scope.__SCHEDULE_FIXTURES__ = schedules;
  }, { schedules: fixtures, env: options.env ?? {} });

  if (options.sharePointStub) {
    await page.route('**/_api/**/lists/getbytitle*', (route) => {
      const url = route.request().url().toLowerCase();
      if (url.includes('scheduleevents') || url.includes('schedules')) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({ value: [] }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return route.continue();
    });
  }
}
