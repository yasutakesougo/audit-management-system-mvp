import { expect, type Page } from '@playwright/test';
import { setupSharePointStubs } from '../_helpers/setupSharePointStubs';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

type MockUser = {
  Id: number;
  UserID: string;
  FullName: string;
};

type MockDailyRecord = {
  Id: number;
  Title: string;
  cr013_recorddate: string;
  cr013_specialnote: string | null;
  cr013_amactivity: string | null;
  cr013_pmactivity: string | null;
  cr013_lunchamount: string | null;
  cr013_behaviorcheck: { results: string[] };
  cr013_userid: string;
  cr013_fullname: string;
};

const mockUsers: MockUser[] = Array.from({ length: 12 }).map((_, index) => ({
  Id: index + 1,
  UserID: `U-${String(index + 1).padStart(3, '0')}`,
  FullName: ['田中太郎', '佐藤花子', '鈴木次郎', '高橋美咲', '山田健一', '渡辺由美', '伊藤雄介', '中村恵子', '小林智子', '加藤秀樹', '吉田京子', '清水達也'][index % 12],
}));

const mockDailyRecords: MockDailyRecord[] = mockUsers.slice(0, 6).map((user, index) => ({
  Id: index + 101,
  Title: `${user.FullName} ${new Date().toISOString().split('T')[0]}`,
  cr013_recorddate: new Date().toISOString(),
  cr013_specialnote: index % 2 === 0 ? '特記事項あり' : null,
  cr013_amactivity: '午前活動',
  cr013_pmactivity: '午後活動',
  cr013_lunchamount: '完食',
  cr013_behaviorcheck: { results: [] as string[] },
  cr013_userid: user.UserID,
  cr013_fullname: user.FullName,
}));

const readHudSpans = async (page: Page) =>
  page.evaluate(() => {
    const win = window as typeof window & {
      __PREFETCH_HUD__?: { spans?: Array<{ key?: string; source?: string; meta?: Record<string, unknown> }> };
    };
    return (win.__PREFETCH_HUD__?.spans ?? []).map((span) => ({
      key: span?.key ?? '',
      source: span?.source ?? '',
      meta: span?.meta ?? {},
    }));
  });

export async function primeOpsEnv(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as typeof window & { __ENV__?: Record<string, string> };
    win.__ENV__ = {
      ...(win.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_DEMO_MODE: '0',
      VITE_WRITE_ENABLED: '1',
      VITE_PREFETCH_HUD: '1',
      VITE_FEATURE_SCHEDULES: '1',
      MODE: 'production',
      DEV: '0',
      VITE_SP_RESOURCE: win.__ENV__?.VITE_SP_RESOURCE ?? 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: win.__ENV__?.VITE_SP_SITE_RELATIVE ?? '/sites/Operations',
      VITE_SP_SCOPE_DEFAULT: win.__ENV__?.VITE_SP_SCOPE_DEFAULT ?? 'https://contoso.sharepoint.com/AllSites.Read',
    };

    try {
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('writeEnabled', '1');
      window.localStorage.setItem('feature:schedules', '1');
      window.localStorage.setItem('VITE_PREFETCH_HUD', '1');
    } catch {
      /* noop */
    }

    try {
      window.sessionStorage.setItem('spToken', 'mock-live-token');
    } catch {
      /* noop */
    }
  });

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify({ value: [] }) }),
  );

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 12345, Title: 'Mock User' } },
    lists: [
      {
        name: 'Users_Master',
        items: mockUsers,
        // Cast items to the concrete type to satisfy ListStubConfig
        sort: (items) => [...(items as MockUser[])].sort((a, b) => a.UserID.localeCompare(b.UserID)),
      },
      {
        name: 'SupportRecord_Daily',
        items: mockDailyRecords,
        insertPosition: 'start',
        sort: (items) => [...(items as MockDailyRecord[])].sort((a, b) => b.Id - a.Id),
      },
    ],
    fallback: { status: 200, body: { value: [] } },
  });
}

export async function waitForHudAny(page: Page, matchers: string[], options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 10_000;
  const needles = matchers.map((item) => item.toLowerCase());

  await expect
    .poll(async () => {
      const spans = await readHudSpans(page);
      for (const span of spans) {
        const haystack = [span.key, span.source, ...Object.values(span.meta ?? {})
          .filter((value): value is string => typeof value === 'string')]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        const matched = needles.every((needle) => haystack.some((value) => value.includes(needle)));
        if (matched) {
          return true as const;
        }
      }
      return false as const;
    }, { timeout })
    .toBe(true);
}

export async function gotoAndAssertH1(
  page: Page,
  path: string,
  heading: string | RegExp,
  hudMatchers?: string[],
): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible({ timeout: 15_000 });

  if (hudMatchers && hudMatchers.length > 0) {
    await waitForHudAny(page, hudMatchers);
  }
}
