import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { formatInTimeZone } from 'date-fns-tz';
import type { ScheduleItem } from '../utils/spMock';
import { TIME_ZONE } from '../utils/spMock';

export type CareLevel = 'low' | 'medium' | 'high';

export type SchedulesTodaySeedEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  careLevel: CareLevel;
  members: string[];
  category?: 'User' | 'Staff' | 'Org';
  notes?: string;
};

export type SchedulesTodaySeedPayload = {
  date: string;
  events: SchedulesTodaySeedEvent[];
};

export type SeedSchedulesTodayResult = {
  payload: SchedulesTodaySeedPayload;
  scheduleItems: ScheduleItem[];
};

export const SCHEDULES_TODAY_STORAGE_KEY = 'schedules.today.dev.v1';

const seedPath = resolve(process.cwd(), 'tests/e2e/_fixtures/schedules.today.dev.v1.json');

let cachedSeed: SchedulesTodaySeedPayload | null = null;

const STATUS_MAP: Record<CareLevel, string> = {
  high: '要注意',
  medium: '通常',
  low: '軽度',
};

const SERVICE_MAP: Record<CareLevel, string> = {
  high: '重点フォロー',
  medium: '定期サポート',
  low: 'スポットケア',
};

const computeDayPart = (iso: string): 'AM' | 'PM' => {
  const hour = Number(formatInTimeZone(new Date(iso), TIME_ZONE, 'H'));
  return hour < 12 ? 'AM' : 'PM';
};

const formatDayKey = (iso: string): string => formatInTimeZone(new Date(iso), TIME_ZONE, 'yyyy-MM-dd');

const formatFiscalYear = (iso: string): string => formatInTimeZone(new Date(iso), TIME_ZONE, 'yyyy');

const toScheduleItem = (event: SchedulesTodaySeedEvent, index: number): ScheduleItem => {
  const start = event.start;
  const end = event.end;
  const dayKey = formatDayKey(start);
  const fiscalYear = formatFiscalYear(start);
  const status = STATUS_MAP[event.careLevel];
  const serviceType = SERVICE_MAP[event.careLevel];
  const category = event.category ?? 'User';
  const personName = event.members.join(', ') || event.title;
  const personType = category === 'Org' ? 'Org' : category === 'Staff' ? 'Staff' : 'Internal';
  const subType = category === 'Org' ? 'OrgEvent' : category === 'Staff' ? 'StaffShift' : 'AgendaSeed';

  return {
    Id: 70_000 + index,
    Title: event.title,
    EventDate: start,
    EndDate: end,
    Start: start,
    End: end,
    AllDay: false,
    Status: status,
    Location: '生活支援フロア',
    DayPart: computeDayPart(start),
    cr014_category: category,
    cr014_serviceType: serviceType,
    cr014_personType: personType,
    cr014_personId: event.members[0] ?? `seed-member-${index}`,
    cr014_personName: personName,
    cr014_staffIds: event.members,
    cr014_staffNames: event.members,
    cr014_dayKey: dayKey,
    cr014_fiscalYear: fiscalYear,
    SubType: subType,
    '@odata.etag': `"seed-schedules-${index}"`,
  } satisfies ScheduleItem;
};

export function readSchedulesTodaySeed(): SchedulesTodaySeedPayload {
  if (!cachedSeed) {
    cachedSeed = JSON.parse(readFileSync(seedPath, 'utf-8')) as SchedulesTodaySeedPayload;
  }
  return cachedSeed;
}

export function buildSchedulesTodaySharePointItems(
  seed: SchedulesTodaySeedPayload = readSchedulesTodaySeed(),
): ScheduleItem[] {
  return seed.events.map(toScheduleItem);
}

export const getSchedulesTodaySeedDate = (): string => readSchedulesTodaySeed().date;

export function buildSchedulesTodayListConfigs(scheduleItems: ScheduleItem[]) {
  if (!scheduleItems.length) return [];
  return [
    {
      name: 'Schedules_Master',
      aliases: ['Schedules', 'ScheduleEvents', 'SupportSchedule'],
      items: scheduleItems,
    },
  ];
}

export async function seedSchedulesToday(
  page: Page,
  options: { storageKey?: string; payload?: SchedulesTodaySeedPayload } = {},
): Promise<SeedSchedulesTodayResult> {
  const payload = options.payload ?? readSchedulesTodaySeed();
  const storageKey = options.storageKey ?? SCHEDULES_TODAY_STORAGE_KEY;
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(payload) },
  );
  return { payload, scheduleItems: buildSchedulesTodaySharePointItems(payload) };
}

/**
 * E2E fixture をデモアダプタ用の storage key に書き込む
 * demoAdapter.ts 内の resolveE2eSchedules() で読み込まれる
 */
export async function seedSchedulesTodayForDemoAdapter(
  page: Page,
  options: { payload?: SchedulesTodaySeedPayload } = {},
): Promise<void> {
  const payload = options.payload ?? readSchedulesTodaySeed();
  const e2eKey = 'e2e:schedules.v1';
  
  // ScheduleItem から SchedItem フォーマットに変換
  const schedItems = payload.events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    status: 'Planned',
    statusReason: null,
    category: event.category ?? 'User',
    etag: `"e2e-${event.id}"`,
  }));

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: e2eKey, value: JSON.stringify(schedItems) },
  );
}
