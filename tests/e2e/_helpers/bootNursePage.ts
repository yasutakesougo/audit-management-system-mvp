import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { setupNurseFlags } from './setupNurse.flags';
import { setupSharePointStubs } from './setupSharePointStubs';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

const nurseDashboardFixture = JSON.parse(
  readFileSync(resolve(__dirname, '../_fixtures/nurse.dashboard.dev.v1.json'), 'utf-8'),
);

const NURSE_FEATURE_ENV: Record<string, string> = {
  VITE_FEATURE_NURSE_UI: '1',
  VITE_FEATURE_NURSE_BETA: '1',
  VITE_NURSE_BULK_ENTRY: '1',
  VITE_NURSE_SYNC_SP: '0',
};

const NURSE_FEATURE_STORAGE: Record<string, string> = {
  'feature:nurseUI': '1',
  'feature:nurseBulkEntry': '1',
  'nurse:queue:offline': '0',
};

type SetupSharePointOptions = NonNullable<Parameters<typeof setupSharePointStubs>[1]>;
type ListConfigArray = NonNullable<SetupSharePointOptions['lists']>;

const DEFAULT_LISTS: ListConfigArray = [{ name: 'Nurse_Observation', items: [] }];

type MinuteBasis = 'utc' | 'local';

export type NurseSeedOptions = {
  nurseDashboard?: boolean;
};

export type BootNurseOptions = {
  envOverrides?: Record<string, string>;
  storageOverrides?: Record<string, string>;
  minuteBasis?: MinuteBasis;
  enableBulk?: boolean;
  date?: string;
  queueSeed?: unknown[];
  seed?: NurseSeedOptions;
  sharePoint?: Omit<SetupSharePointOptions, 'lists'> & {
    lists?: ListConfigArray;
    extraLists?: ListConfigArray;
  };
  stubSpApi?: boolean;
};

const NURSE_DASHBOARD_STORAGE_KEY = 'nurse.dashboard.dev.v1';

const normalizeIsoDate = (value?: string) => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
};

export async function bootNursePage(page: Page, options: BootNurseOptions = {}): Promise<void> {
  const envOverrides = { ...NURSE_FEATURE_ENV, ...(options.envOverrides ?? {}) };
  const storageOverrides = { ...NURSE_FEATURE_STORAGE, ...(options.storageOverrides ?? {}) };
  const queueSeed = Array.isArray(options.queueSeed) ? options.queueSeed : [];
  const minuteBasis: MinuteBasis = options.minuteBasis ?? 'utc';
  const isoDate = normalizeIsoDate(options.date);
  const enableBulk = options.enableBulk ?? false;

  await setupPlaywrightEnv(page, {
    envOverrides,
    storageOverrides,
  });

  if (options.seed?.nurseDashboard) {
    await page.addInitScript(
      ([key, payload]) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(payload));
        } catch {
          // ignore; deterministic assertions will fail loudly if seed missing
        }
      },
      [NURSE_DASHBOARD_STORAGE_KEY, nurseDashboardFixture] as const,
    );
  }

  await page.addInitScript(
    ({ queueJson, minuteBasisValue, fixedDate }) => {
      const scope = window as typeof window & {
        __NURSE_MINUTE_BASIS__?: MinuteBasis;
        __TEST_NOW__?: string;
      };
      scope.__NURSE_MINUTE_BASIS__ = minuteBasisValue;
      if (fixedDate) {
        scope.__TEST_NOW__ = fixedDate;
      }

      if (queueJson) {
        window.localStorage.setItem('nurse.queue.v2', queueJson);
      } else if (!window.localStorage.getItem('nurse.queue.v2')) {
        window.localStorage.setItem('nurse.queue.v2', '[]');
      }
    },
    {
      queueJson: JSON.stringify(queueSeed),
      minuteBasisValue: minuteBasis,
      fixedDate: isoDate,
    },
  );

  await setupNurseFlags(page, { bulk: enableBulk, minuteBasis });

  const sharePointOptions = options.sharePoint ?? {};
  const { lists: overrideLists, extraLists, ...rest } = sharePointOptions;
  const lists = overrideLists ?? [...DEFAULT_LISTS, ...(extraLists ?? [])];

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 301, Title: 'Nurse Operator' } },
    fallback: { status: 200, body: { value: [] } },
    ...rest,
    lists,
  });

  if (options.stubSpApi ?? true) {
    await page.route('**/api/sp/lists/**', async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ value: [] }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ id: Date.now() }),
          headers: { 'Content-Type': 'application/json' },
        });
        return;
      }

      if (method === 'PATCH') {
        await route.fulfill({ status: 204, body: '', headers: { 'Content-Type': 'application/json' } });
        return;
      }

      await route.fulfill({ status: 204, body: '', headers: { 'Content-Type': 'application/json' } });
    });
  }
}
