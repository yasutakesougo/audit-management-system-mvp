import type { Page } from '@playwright/test';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';
import { setupSharePointStubs } from './setupSharePointStubs';

const FEATURE_ENV = {
  VITE_E2E: '1',
  VITE_E2E_MSAL_MOCK: '1',
  VITE_SKIP_LOGIN: '1',
  VITE_SKIP_SHAREPOINT: '1',
  VITE_MSAL_CLIENT_ID: 'e2e-mock-client-id-12345678',
  VITE_MSAL_TENANT_ID: 'common',
  VITE_DEMO_MODE: '0',
  VITE_WRITE_ENABLED: '1',
} as const;

const FEATURE_STORAGE = {
  skipLogin: '1',
  demo: '0',
  writeEnabled: '1',
} as const;

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
  FullName: [
    '田中太郎',
    '佐藤花子',
    '鈴木次郎',
    '高橋美咲',
    '山田健一',
    '渡辺由美',
    '伊藤雄介',
    '中村恵子',
    '小林智子',
    '加藤秀樹',
    '吉田京子',
    '清水達也',
  ][index % 12],
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

export async function bootDaily(page: Page): Promise<void> {
  setupPlaywrightEnv(page, FEATURE_ENV, FEATURE_STORAGE);

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ value: [] }),
    }),
  );

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 12345, Title: 'Mock User' } },
    lists: [
      {
        name: 'Users_Master',
        items: mockUsers,
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
