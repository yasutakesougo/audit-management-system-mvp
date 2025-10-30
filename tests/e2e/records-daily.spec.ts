/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { expectToastAnnounce } from './utils/toast';

const jsonHeaders = {
  'Content-Type': 'application/json;odata=nometadata; charset=utf-8',
  'Cache-Control': 'no-store',
};

type MockDailyRecord = {
  Id: number;
  Title: string;
  cr013_recorddate: string | null;
  cr013_specialnote: string | null;
  cr013_amactivity: string | null;
  cr013_pmactivity: string | null;
  cr013_lunchamount: string | null;
  cr013_behaviorcheck: string[];
};

const sortById = <T extends { Id: number }>(items: T[]) => [...items].sort((a, b) => a.Id - b.Id);

test.describe('Daily records end-to-end', () => {
  test('creates a record and persists extended activity fields', async ({ page }) => {
    const users = [
      { Id: 1, UserID: 'U-001', FullName: '山田 太郎' },
      { Id: 2, UserID: 'U-002', FullName: '鈴木 花子' },
    ];
    const records: MockDailyRecord[] = [];
    const nextRecordId = records.reduce((max, item) => Math.max(max, item.Id), 0) + 1;

    await page.addInitScript(() => {
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_DEMO_MODE: '0',
    VITE_WRITE_ENABLED: '1',
    MODE: 'production',
    DEV: '0',
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
        VITE_SP_SITE_RELATIVE: '/sites/Audit',
        VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
      };

      try {
        window.localStorage.setItem('skipLogin', '1');
        window.localStorage.setItem('demo', '0');
        window.localStorage.setItem('writeEnabled', '1');
      } catch {
        // ignore storage failures (e.g. safari private mode)
      }
    });

    await page.route('**/login.microsoftonline.com/**', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    await page.route('https://graph.microsoft.com/**', async (route) => {
      await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify({ value: [] }) });
    });

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 12345 } },
      fallback: { status: 404, body: 'not mocked' },
      lists: [
        {
          name: 'Users_Master',
          items: users,
          sort: (items) => sortById(items as Array<{ Id: number }>) as typeof items,
        },
        {
          name: 'SupportRecord_Daily',
          items: records,
          nextId: nextRecordId,
          insertPosition: 'start',
          pageSize: 50,
          sort: (items) => sortById(items as Array<{ Id: number }>) as typeof items,
          onCreate: (payload, ctx) => {
            const source = (payload ?? {}) as Partial<MockDailyRecord> & {
              cr013_behaviorcheck?: string[] | { results?: string[] };
            };
            const rawBehavior = source.cr013_behaviorcheck as any;
            const behaviorSelections: string[] = Array.isArray(rawBehavior)
              ? rawBehavior
              : Array.isArray(rawBehavior?.results)
                ? rawBehavior.results ?? []
                : [];
            const created: MockDailyRecord = {
              Id: ctx.takeNextId(),
              Title: source.Title ?? '',
              cr013_recorddate: source.cr013_recorddate ?? null,
              cr013_specialnote: source.cr013_specialnote ?? null,
              cr013_amactivity: source.cr013_amactivity ?? null,
              cr013_pmactivity: source.cr013_pmactivity ?? null,
              cr013_lunchamount: source.cr013_lunchamount ?? null,
              cr013_behaviorcheck: behaviorSelections,
            };
            return created;
          },
        },
      ],
    });

    await page.goto('/records', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: '日次記録' })).toBeVisible({ timeout: 15000 });

    const titleInput = page.getByPlaceholder('タイトル');
    await titleInput.fill('山田 太郎');

    await page.getByLabel('日付').fill('2025-10-01');
    await page.getByPlaceholder('特記事項').fill('午後に通院予定');

    const createResponse = page.waitForResponse((response) => {
      const request = response.request();
      return request.method().toUpperCase() === 'POST' && request.url().includes("getbytitle('SupportRecord_Daily')");
    });
    await page.getByRole('button', { name: '新規記録追加' }).click();
    await createResponse;

    await expectToastAnnounce(page, { message: '保存しました', timeout: 10_000 });

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.locator('td').nth(0)).toHaveText('山田 太郎');
    await expect(firstRow.locator('td').nth(1)).toHaveText('2025-10-01');
    await expect(firstRow.locator('td').nth(2)).toHaveText('午後に通院予定');

    await page.reload({ waitUntil: 'load' });
    const reloadedRow = page.locator('tbody tr').first();
    await expect(reloadedRow.locator('td').nth(0)).toHaveText('山田 太郎');
    await expect(reloadedRow.locator('td').nth(1)).toHaveText('2025-10-01');
    await expect(reloadedRow.locator('td').nth(2)).toHaveText('午後に通院予定');
  });
});
