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
  { id: 'seed-U-001-1', time: '9:30頃', activity: '通所・朝の準備', instruction: '通所時の様子を確認し、見守りを行う', isKey: true },
  { id: 'seed-U-001-2', time: '10:00頃', activity: '体操', instruction: '本人の様子を見ながら参加を促す' },
  { id: 'seed-U-001-3', time: '10:10頃', activity: 'スケジュール確認', instruction: '予定を確認し、見通しが持てるよう支援する' },
  { id: 'seed-U-001-4', time: '10:15頃', activity: 'お茶休憩', instruction: 'お茶の準備、片付けを行う' },
  { id: 'seed-U-001-5', time: '10:20〜12:00', activity: 'AM日中活動', instruction: '必要に応じて声かけ、見守り、同行支援を行う', isKey: true },
  { id: 'seed-U-001-6', time: '12:00', activity: '昼食準備', instruction: '手洗い・消毒を見守る' },
  { id: 'seed-U-001-7', time: '12:10〜12:40', activity: '昼食', instruction: '食事の様子を見守り、必要に応じて介助を行う', isKey: true },
  { id: 'seed-U-001-8', time: '12:40〜13:45', activity: '昼休み', instruction: '休憩中の様子を見守る' },
  { id: 'seed-U-001-9', time: '13:45', activity: 'スケジュール確認', instruction: '本人と一緒に午後の予定を確認する' },
  { id: 'seed-U-001-10', time: '13:45〜14:30', activity: 'PM日中活動', instruction: '必要に応じて同行支援を行う', isKey: true },
  { id: 'seed-U-001-11', time: '14:30〜14:45', activity: 'お茶休憩', instruction: 'お茶の準備、片付けを行う' },
  { id: 'seed-U-001-12', time: '14:45〜15:20', activity: 'PM日中活動', instruction: '見守り、同行支援を行う', isKey: true },
  { id: 'seed-U-001-13', time: '15:20〜15:40', activity: 'のんびりタイム', instruction: '本人のペースを尊重しながら見守る' },
  { id: 'seed-U-001-14', time: '15:40〜16:00', activity: '帰りの準備', instruction: '持ち物確認や身支度を見守る', isKey: true },
  { id: 'seed-U-001-15', time: '16:00', activity: '退所', instruction: '退所時の様子を確認し、見送りを行う', isKey: true },
  { id: 'seed-U-001-16', time: '10:20頃', activity: '外活動準備', instruction: 'トイレ、帽子、持ち物など外活動に必要な準備を支援する' },
  { id: 'seed-U-001-17', time: '10:25頃', activity: '外活動', instruction: '外活動中の安全確認、同行支援、見守りを行う' },
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
    let target = route;
    // route が /kiosk/users/:userId/procedures のような形式で userId が指定されている場合、置換を試みる
    if (target.includes(':userId') && userId) {
      target = target.replace(':userId', userId);
    }

    const separator = target.includes('?') ? '&' : '?';
    const finalTarget = target.includes('provider=') ? target : `${target}${separator}provider=${provider}`;
    
    await page.goto(finalTarget, { waitUntil: 'load' });
    // networkidle は Vite の HMR 等で不安定になることがあるため、load までで止める
  }
}

