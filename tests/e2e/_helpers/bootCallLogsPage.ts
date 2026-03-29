import { expect, type Page } from '@playwright/test';
import type { CallLog } from '@/domain/callLogs/schema';
import { bootstrapDashboard } from '../utils/bootstrapApp';

const E2E_CALL_LOGS_STORAGE_KEY = 'e2e:call-logs.v1';

export type CallLogsSeedMode = 'empty' | 'populated';

const seedCallLogs: CallLog[] = [
  {
    id: 'e2e-call-log-1',
    receivedAt: '2026-03-28T08:30:00.000Z',
    callerName: '山田 太郎',
    callerOrg: '地域包括支援センター',
    targetStaffName: '佐藤',
    receivedByName: '受付A',
    subject: '折返し依頼',
    message: '本日中に折返しをお願いします。',
    needCallback: true,
    urgency: 'today',
    status: 'new',
    relatedUserId: 'U-001',
    relatedUserName: '田中 太郎',
    callbackDueAt: '2026-03-28T10:00:00.000Z',
    completedAt: undefined,
    createdAt: '2026-03-28T08:30:00.000Z',
    updatedAt: '2026-03-28T08:30:00.000Z',
  },
  {
    id: 'e2e-call-log-2',
    receivedAt: '2026-03-28T07:45:00.000Z',
    callerName: '鈴木 花子',
    callerOrg: '家族',
    targetStaffName: '佐藤',
    receivedByName: '受付A',
    subject: '連絡メモ',
    message: '明日の送迎時間を確認したいとのこと。',
    needCallback: false,
    urgency: 'normal',
    status: 'callback_pending',
    relatedUserId: undefined,
    relatedUserName: undefined,
    callbackDueAt: '2026-03-28T11:30:00.000Z',
    completedAt: undefined,
    createdAt: '2026-03-28T07:45:00.000Z',
    updatedAt: '2026-03-28T07:45:00.000Z',
  },
];

export async function bootCallLogsPage(
  page: Page,
  options: { mode: 'light' | 'dark'; seedMode?: CallLogsSeedMode },
): Promise<void> {
  const seedMode = options.seedMode ?? 'empty';

  await page.addInitScript(
    ({ mode, seed, storageKey, seedData }) => {
      window.localStorage.setItem('app_color_mode', mode);
      window.localStorage.setItem('skipLogin', '1');
      if (seed === 'populated') {
        window.localStorage.setItem(storageKey, JSON.stringify(seedData));
      } else {
        window.localStorage.removeItem(storageKey);
      }

      const w = window as typeof window & { __ENV__?: Record<string, string> };
      w.__ENV__ = {
        ...(w.__ENV__ ?? {}),
        VITE_SKIP_SHAREPOINT: '1',
        VITE_FEATURE_USERS_SP: '0',
      };
    },
    {
      mode: options.mode,
      seed: seedMode,
      storageKey: E2E_CALL_LOGS_STORAGE_KEY,
      seedData: seedCallLogs,
    },
  );

  await bootstrapDashboard(page, {
    skipLogin: true,
    initialPath: '/call-logs',
  });

  await expect(page.getByTestId('call-log-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('call-log-tabpanel')).toBeVisible();

  if (seedMode === 'populated') {
    await expect(page.getByTestId('call-log-list')).toBeVisible();
  }
}
