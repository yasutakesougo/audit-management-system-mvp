import type { Page } from '@playwright/test';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

export const DAILY_TABLE_E2E_DATE = '2026-07-13';
export const DAILY_TABLE_E2E_USER_ID = 'U-001';
export const DAILY_TABLE_DRAFT_STORAGE_KEY = 'daily-table-record:draft:v1';
export const DAILY_TABLE_UNSENT_FILTER_STORAGE_KEY = 'daily-table-record:unsent-filter:v1';
export const PDCA_DAILY_METRICS_STORAGE_KEY = 'pdca:daily-submission-events:v1';

type DailyTableDraftSeed = {
  reporterName?: string;
  selectedUserIds?: string[];
  userRows?: Array<Record<string, unknown>>;
  savedAt?: string;
};

type BootDailyTablePageOptions = {
  path?: string;
  featureIcebergPdca?: boolean;
  draft?: DailyTableDraftSeed;
  unsentFilter?: boolean;
};

export async function bootDailyTablePage(
  page: Page,
  options: BootDailyTablePageOptions = {},
): Promise<void> {
  const path = options.path ?? `/daily/table?date=${DAILY_TABLE_E2E_DATE}`;

  await setupPlaywrightEnv(page, {
    envOverrides: {
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_SKIP_SHAREPOINT: '1',
      VITE_DEMO_MODE: '1',
      VITE_FORCE_SHAREPOINT: '0',
      VITE_WRITE_ENABLED: '1',
      ...(options.featureIcebergPdca ? { VITE_FEATURE_ICEBERG_PDCA: '1' } : {}),
    },
    storageOverrides: {
      skipLogin: '1',
      demo: '1',
      writeEnabled: '1',
    },
  });

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ value: [] }),
    }),
  );
  await page.route('/_api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] }, value: [] }),
    }),
  );

  if (options.draft || options.unsentFilter) {
    await page.addInitScript(
      ({ draft, unsentFilter, storageKey, unsentStorageKey, date, defaultUserId }) => {
        window.localStorage.removeItem(storageKey);
        window.localStorage.removeItem(unsentStorageKey);
        window.localStorage.removeItem('pdca:daily-submission-events:v1');

        if (draft) {
          const userRows = draft.userRows ?? [
            {
              userId: defaultUserId,
              userName: '桂川 進太朗',
              amActivity: 'E2E 午前活動',
              pmActivity: 'E2E 午後活動',
              lunchAmount: '完食',
              problemBehavior: {
                selfHarm: false,
                otherInjury: false,
                loudVoice: false,
                pica: false,
                other: false,
              },
              specialNotes: 'E2E 下書き',
              behaviorTags: [],
            },
          ];
          window.localStorage.setItem(storageKey, JSON.stringify({
            formData: {
              date,
              reporter: { name: draft.reporterName ?? 'E2E 記録者', role: '生活支援員' },
              userRows,
              userCount: userRows.length,
            },
            selectedUserIds: draft.selectedUserIds ?? [defaultUserId],
            searchQuery: '',
            showTodayOnly: true,
            savedAt: draft.savedAt ?? new Date().toISOString(),
          }));
        }

        if (unsentFilter) {
          window.localStorage.setItem(unsentStorageKey, '1');
        }
      },
      {
        draft: options.draft,
        unsentFilter: options.unsentFilter,
        storageKey: DAILY_TABLE_DRAFT_STORAGE_KEY,
        unsentStorageKey: DAILY_TABLE_UNSENT_FILTER_STORAGE_KEY,
        date: DAILY_TABLE_E2E_DATE,
        defaultUserId: DAILY_TABLE_E2E_USER_ID,
      },
    );
  }

  await page.goto(path, { waitUntil: 'domcontentloaded' });
}
