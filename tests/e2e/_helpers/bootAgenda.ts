import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { HandoffRecord } from '../../../src/features/handoff/handoffTypes';
import type { ScheduleItem } from '../utils/spMock';
import { buildSchedulesTodayListConfigs, seedSchedulesToday } from './schedulesTodaySeed';
import { setupSharePointStubs } from './setupSharePointStubs';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

const HANDOFF_STORAGE_KEY = 'handoff.timeline.dev.v1';

type AgendaSeedPayload = {
  date: string;
  handoffTimeline: HandoffSeed[];
};

const agendaSeedPath = resolve(process.cwd(), 'tests/e2e/_fixtures/agenda.dashboard.dev.v1.json');
const agendaSeed = JSON.parse(readFileSync(agendaSeedPath, 'utf-8')) as AgendaSeedPayload;
const agendaTimelineSeed = Array.isArray(agendaSeed.handoffTimeline) ? agendaSeed.handoffTimeline : [];

const AGENDA_FEATURE_ENV: Record<string, string> = {
  VITE_HANDOFF_STORAGE: 'local',
  VITE_HANDOFF_DEBUG: '0',
  VITE_FEATURE_USERS_CRUD: '1',
  VITE_FEATURE_SCHEDULES: '1',
  VITE_FEATURE_SCHEDULES_WEEK_V2: '1',
};

const AGENDA_FEATURE_STORAGE: Record<string, string> = {
  'feature:schedules': '1',
  'feature:schedulesWeekV2': '1',
  'feature:usersCrud': '1',
  'hydration:disable': '1',
};

type HandoffSeed = Omit<HandoffRecord, 'createdAt'> & { createdAt?: string };

type SetupSharePointOptions = Parameters<typeof setupSharePointStubs>[1];
type ListConfigArray = NonNullable<SetupSharePointOptions['lists']>;

export type BootAgendaSeedOptions = {
  agenda?: boolean;
  schedulesToday?: boolean;
};

export type BootAgendaOptions = {
  route?: string;
  autoNavigate?: boolean;
  seed?: BootAgendaSeedOptions;
  envOverrides?: Record<string, string>;
  storageOverrides?: Record<string, string>;
  handoffSeed?: HandoffSeed[];
  handoffDayOffset?: number;
  sharePoint?: Omit<SetupSharePointOptions, 'lists'> & {
    lists?: ListConfigArray;
    extraLists?: ListConfigArray;
  };
  stubSharePoint?: boolean;
};

const buildIsoDate = (base: Date, offsetMinutes: number): string => {
  const copy = new Date(base);
  copy.setMinutes(copy.getMinutes() + offsetMinutes);
  return copy.toISOString();
};

const getIsoDateKey = (base: Date): string => {
  const y = base.getFullYear();
  const m = `${base.getMonth() + 1}`.padStart(2, '0');
  const d = `${base.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export async function bootAgenda(page: Page, options: BootAgendaOptions = {}): Promise<void> {
  const route = options.route ?? '/dashboard';
  const autoNavigate = options.autoNavigate ?? false;
  const seedOptions = options.seed ?? {};
  const shouldSeedAgenda = seedOptions.agenda ?? true;
  const shouldSeedSchedulesToday = seedOptions.schedulesToday ?? false;
  const envOverrides = { ...AGENDA_FEATURE_ENV, ...(options.envOverrides ?? {}) };
  const storageOverrides = { ...AGENDA_FEATURE_STORAGE, ...(options.storageOverrides ?? {}) };
  const stubSharePoint = options.stubSharePoint ?? true;
  const handoffSeed = options.handoffSeed ?? (shouldSeedAgenda ? agendaTimelineSeed : []);
  const handoffDayOffset = options.handoffDayOffset ?? 0;

  await setupPlaywrightEnv(page, {
    envOverrides,
    storageOverrides,
  });

  let seededScheduleItems: ScheduleItem[] = [];

  if (shouldSeedAgenda && handoffSeed.length > 0) {
    const baseDate = new Date();
    if (handoffDayOffset !== 0) {
      baseDate.setDate(baseDate.getDate() + handoffDayOffset);
    }

    const dateKey = getIsoDateKey(baseDate);
    const normalizedSeed = handoffSeed.map((entry, index) => ({
      ...entry,
      id: typeof entry.id === 'number' ? entry.id : 20_000 + index,
      createdAt: entry.createdAt ?? buildIsoDate(baseDate, index * 45),
    } satisfies HandoffRecord));
    const handoffStoreSerialized = JSON.stringify({ [dateKey]: normalizedSeed });

    await page.addInitScript(
      ({ handoffStorePayload, handoffStorageKey }) => {
        let existing: Record<string, unknown> = {};
        try {
          const raw = window.localStorage.getItem(handoffStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              existing = parsed as Record<string, unknown>;
            }
          }
        } catch {
          existing = {};
        }

        let payload: Record<string, unknown> = {};
        try {
          const parsedPayload = JSON.parse(handoffStorePayload);
          if (parsedPayload && typeof parsedPayload === 'object') {
            payload = parsedPayload as Record<string, unknown>;
          }
        } catch {
          payload = {};
        }

        const nextStore = {
          ...existing,
          ...payload,
        } as Record<string, unknown>;

        try {
          window.localStorage.setItem(handoffStorageKey, JSON.stringify(nextStore));
        } catch (error) {
          console.error('[bootAgenda:init] failed to seed handoff store', error);
        }
      },
      {
        handoffStorePayload: handoffStoreSerialized,
        handoffStorageKey: HANDOFF_STORAGE_KEY,
      },
    );
  }

  if (shouldSeedSchedulesToday) {
    const result = await seedSchedulesToday(page);
    seededScheduleItems = result.scheduleItems;
  }

  if (stubSharePoint) {
    const sharePointOptions = options.sharePoint ?? {};
    const { extraLists, lists: overrideLists, ...restSharePoint } = sharePointOptions;
    const listsFromSeed = seededScheduleItems.length ? buildSchedulesTodayListConfigs(seededScheduleItems) : [];
    const mergedLists = overrideLists
      ?? (listsFromSeed.length || (extraLists?.length ?? 0) ? [...listsFromSeed, ...(extraLists ?? [])] : undefined);

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 401, Title: 'Agenda Operator' } },
      fallback: { status: 200, body: { value: [] } },
      ...restSharePoint,
      ...(mergedLists ? { lists: mergedLists } : {}),
    });
  }

  if (autoNavigate) {
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
  }
}
