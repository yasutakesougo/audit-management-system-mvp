import type { Page } from '@playwright/test';
import { toLocalDateISO } from '../../../src/utils/getNow';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

const FEATURE_ENV: Record<string, string> = {
  VITE_E2E: '1',
  VITE_E2E_MSAL_MOCK: '1',
  VITE_SKIP_LOGIN: '1',
  VITE_SKIP_SHAREPOINT: '1',
  VITE_FORCE_SHAREPOINT: '0',
  VITE_FORCE_DEMO: '1',
  VITE_DEMO_MODE: '1',
};

const FEATURE_STORAGE: Record<string, string> = {
  skipLogin: '1',
  demo: '1',
};

type KioskProcedure = {
  id: string;
  time: string;
  activity: string;
  instruction: string;
  isKey?: boolean;
};

type KioskRecordSeed = {
  scheduleItemId: string;
  status: 'completed' | 'triggered' | 'skipped' | 'unrecorded';
};

export type BootKioskOptions = {
  route?: string;
  autoNavigate?: boolean;
  provider?: 'memory' | 'local';
  userId?: string;
  procedures?: KioskProcedure[];
  records?: KioskRecordSeed[];
  envOverrides?: Record<string, string>;
  storageOverrides?: Record<string, string>;
};

const DEFAULT_PROCEDURES: KioskProcedure[] = [
  { id: 'base-0900', time: '09:00', activity: '朝の受け入れ', instruction: '視線を合わせて挨拶。体調チェックシート記入。', isKey: true },
  { id: 'base-0915', time: '09:15', activity: '持ち物整理', instruction: 'ロッカーへの収納を支援。手順書を提示。' },
  { id: 'base-1000', time: '10:00', activity: '作業活動', instruction: '作業手順の提示。失敗時は新しい部材を渡す。', isKey: true },
  { id: 'base-1130', time: '11:30', activity: '昼食準備', instruction: '手洗い場へ誘導。' },
  { id: 'base-1200', time: '12:00', activity: '昼食', instruction: '誤嚥に注意して見守り。', isKey: true },
  { id: 'base-1300', time: '13:00', activity: '休憩', instruction: 'リラックスできる環境を提供。' },
  { id: 'base-1500', time: '15:00', activity: '掃除', instruction: '担当箇所の清掃を一緒に行う。' },
  { id: 'base-1545', time: '15:45', activity: '帰りの会', instruction: '一日の振り返り。ポジティブなフィードバック。', isKey: true },
];

export async function bootKiosk(page: Page, options: BootKioskOptions = {}): Promise<void> {
  const provider = options.provider ?? 'memory';
  const route = options.route ?? '/kiosk';
  const autoNavigate = options.autoNavigate ?? true;
  const userId = options.userId ?? '1';
  const procedures = options.procedures ?? DEFAULT_PROCEDURES;
  const records = options.records ?? [];

  await setupPlaywrightEnv(page, {
    envOverrides: {
      ...FEATURE_ENV,
      ...(options.envOverrides ?? {}),
    },
    storageOverrides: {
      ...FEATURE_STORAGE,
      ...(options.storageOverrides ?? {}),
    },
  });

  const today = toLocalDateISO(new Date());
  const executionData =
    records.length > 0
      ? {
          [`${today}::${userId}`]: {
            date: today,
            userId,
            records: records.map((r) => ({
              id: `${today}-${userId}-${r.scheduleItemId}`,
              date: today,
              userId,
              scheduleItemId: r.scheduleItemId,
              status: r.status,
              triggeredBipIds: [],
              memo: '',
              recordedBy: '',
              recordedAt: new Date().toISOString(),
            })),
            updatedAt: new Date().toISOString(),
          },
        }
      : {};

  await page.addInitScript(
    ({ targetUserId, seededProcedures, seededExecutionData }) => {
      window.localStorage.setItem(
        'procedureStore.v1',
        JSON.stringify({
          version: 1,
          data: {
            [targetUserId]: seededProcedures,
          },
        }),
      );

      window.localStorage.setItem(
        'executionRecord.v1',
        JSON.stringify({
          version: 1,
          data: seededExecutionData,
        }),
      );
    },
    {
      targetUserId: userId,
      seededProcedures: procedures,
      seededExecutionData: executionData,
    },
  );

  if (autoNavigate) {
    const separator = route.includes('?') ? '&' : '?';
    const target = route.includes('provider=') ? route : `${route}${separator}provider=${provider}`;
    await page.goto(target, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  }
}

