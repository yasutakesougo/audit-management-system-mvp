import { createHash } from '@/utils/createHash';
import type { CreateScheduleEventInput, DateRange, SchedItem, ScheduleServiceType, SchedulesPort, UpdateScheduleEventInput } from './port';
import { result } from '@/shared/result';
import { normalizeServiceType as normalizeSharePointServiceType } from '@/sharepoint/serviceTypes';

const formatISO = (date: Date): string => date.toISOString();
const addHours = (date: Date, hours: number): Date => new Date(date.getTime() + hours * 60 * 60 * 1000);

// Test compatibility: Use a fixed date for demo items that covers the test range
const base = new Date('2026-01-15T09:00:00Z'); // Fixed date within test range
base.setSeconds(0, 0);

let demoItems: SchedItem[] = [
  {
    id: 'demo-visit-morning',
    title: '訪問介護（午前）',
    start: formatISO(base),
    end: formatISO(addHours(base, 2)),
    status: 'Planned',
    statusReason: null,
    etag: '"demo-1"', // Phase 2-0: seed etag
  },
  {
    id: 'demo-meeting',
    title: 'ケース会議',
    start: formatISO(addHours(base, 3)),
    end: formatISO(addHours(base, 4)),
    status: 'Planned',
    statusReason: null,
    etag: '"demo-2"', // Phase 2-0: seed etag
  },
  {
    id: 'demo-visit-afternoon',
    title: '訪問介護（午後）',
    start: formatISO(addHours(base, 6)),
    end: formatISO(addHours(base, 8)),
    status: 'Planned',
    statusReason: null,
    etag: '"demo-3"', // Phase 2-0: seed etag
  },
];

const CONFLICTS_BASIC_DATE = '2025-11-14';
type WarningSchedItem = SchedItem & { baseShiftWarnings?: { staffId?: string; staffName?: string }[] };

const CONFLICTS_BASIC_SEED: WarningSchedItem[] = [
  {
    id: 'conflict-org',
    title: '送迎便（スタッフ重複）',
    category: 'Staff',
    start: `${CONFLICTS_BASIC_DATE}T10:00:00`,
    end: `${CONFLICTS_BASIC_DATE}T11:00:00`,
    assignedStaffId: 'STF-100',
    baseShiftWarnings: [{ staffId: 'STF-100', staffName: '佐藤' }],
    status: 'Planned',
    statusReason: '同時間帯に別予定',
    etag: '"demo-conflict-org"', // Phase 2-0: etag seed
  },
  {
    id: 'conflict-user',
    title: '個別支援（重なり）',
    category: 'User',
    userId: 'USR-200',
    personName: '田中太郎',
    start: `${CONFLICTS_BASIC_DATE}T10:30:00`,
    end: `${CONFLICTS_BASIC_DATE}T11:30:00`,
    assignedStaffId: 'STF-100',
    baseShiftWarnings: [{ staffId: 'STF-100', staffName: '佐藤' }],
    status: 'Planned',
    statusReason: '担当者が重複',
    etag: '"demo-conflict-user"', // Phase 2-0: etag seed
  },
  {
    id: 'conflict-org-late',
    title: '事業所イベント調整',
    category: 'Org',
    start: `${CONFLICTS_BASIC_DATE}T14:00:00`,
    end: `${CONFLICTS_BASIC_DATE}T15:00:00`,
    locationName: '会議室A',
    baseShiftWarnings: [{ staffId: 'STF-200', staffName: '鈴木' }],
    status: 'Postponed',
    statusReason: '会場準備遅延',
    etag: '"demo-conflict-org-late"', // Phase 2-0: etag seed
  },
];

const resolveScenario = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('scenario');
  } catch {
    return null;
  }
};

const resolveSeedForScenario = (scenario: string | null): SchedItem[] | null => {
  switch (scenario) {
    case 'conflicts-basic':
      return CONFLICTS_BASIC_SEED;
    default:
      return null;
  }
};

/**
 * E2E用 fixture 注入ポイント
 * localStorage.setItem('e2e:schedules.v1', JSON.stringify([...])) で供給されたスケジュールを読み込む
 */
const resolveE2eSchedules = (): SchedItem[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('e2e:schedules.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as SchedItem[];
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[demoAdapter] E2E fixtures parse error:', error);
    return null;
  }
};

const normalizeStatusReason = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const withinRange = ({ start, end }: SchedItem, range: DateRange) => {
  const fromTs = new Date(range.from).getTime();
  const toTs = new Date(range.to).getTime();
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  if ([fromTs, toTs, startTs, endTs].some(Number.isNaN)) return true;
  return startTs < toTs && endTs > fromTs;
};

const toIsoString = (value: string): string => {
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeLocal = (value: string): string => (value.length === 16 ? `${value}:00` : value);

const normalizeOptionalLocal = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return toIsoString(normalizeLocal(value));
};

const normalizeOptionalText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeNote = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeServiceType = (value: CreateScheduleEventInput['serviceType']): ScheduleServiceType | undefined => {
  const raw = typeof value === 'string' ? value.trim() : value ?? undefined;
  const normalized = normalizeSharePointServiceType(raw ?? null);
  return (normalized ?? raw ?? undefined) as ScheduleServiceType | undefined;
};

const resolveTitle = (input: CreateScheduleEventInput): string =>
  (input.title ?? '').trim() || '予定';

export const demoSchedulesPort: SchedulesPort = {
  async list(range) {
    // E2E fixture 優先
    const e2eSchedules = resolveE2eSchedules();
    if (e2eSchedules) {
      return e2eSchedules
        .filter((item) => withinRange(item, range))
        .map((item) => ({
          ...item,
          etag: item.etag ?? `"demo-${item.id}"`,
        }));
    }

    // Fallback: scenario or default demo items
    const scenario = resolveScenario();
    const scenarioSeed = resolveSeedForScenario(scenario);
    const source = scenarioSeed ?? demoItems;
    return source
      .filter((item) => withinRange(item, range))
      .map((item) => ({
        ...item,
        etag: item.etag ?? `"demo-${item.id}"`,
      }));
  },
  async create(input) {
    const title = resolveTitle(input);
    const start = toIsoString(normalizeLocal(input.startLocal));
    const end = toIsoString(normalizeLocal(input.endLocal));
    const status = input.status ?? 'Planned';
    const statusReason = normalizeStatusReason(input.statusReason);
    const normalizedServiceType = normalizeServiceType(input.serviceType);
    const acceptedOn = normalizeOptionalLocal(input.acceptedOn);
    const acceptedBy = normalizeOptionalText(input.acceptedBy);
    const acceptedNote = normalizeNote(input.acceptedNote);
    const entryHash = createHash({
      title,
      userId: input.userId ?? null,
      start,
      end,
      serviceType: normalizedServiceType ?? undefined,
      assignedStaffId: input.assignedStaffId ?? null,
      vehicleId: input.vehicleId ?? null,
      status,
      statusReason,
    });
    const now = new Date().toISOString();
    const etagValue = `"demo-${Date.now()}"`; // Phase 2-0: etag for conflict detection
    const created: SchedItem = {
      id: `demo-${Date.now()}`,
      title,
      start,
      end,
      userId: input.userId,
      userLookupId: input.userLookupId,
      personName: input.userName,
      serviceType: normalizedServiceType,
      locationName: input.locationName,
      notes: input.notes,
      assignedStaffId: input.assignedStaffId,
      vehicleId: input.vehicleId,
      status,
      statusReason,
      acceptedOn,
      acceptedBy,
      acceptedNote,
      entryHash,
      createdAt: now,
      updatedAt: now,
      etag: etagValue,
    } satisfies SchedItem;

    demoItems = [...demoItems, created];
    return result.ok(created);
  },
  async update(input: UpdateScheduleEventInput) {
    const index = demoItems.findIndex((item) => item.id === input.id);
    if (index === -1) {
      return result.notFound<SchedItem>(`Schedule item not found: ${input.id}`);
    }

    const start = toIsoString(normalizeLocal(input.startLocal));
    const end = toIsoString(normalizeLocal(input.endLocal));
    const title = resolveTitle(input);
    const updatedAt = new Date().toISOString();
    const normalizedServiceType = normalizeServiceType(input.serviceType);
    const acceptedOn = normalizeOptionalLocal(input.acceptedOn) ?? demoItems[index].acceptedOn;
    const acceptedBy = normalizeOptionalText(input.acceptedBy) ?? demoItems[index].acceptedBy;
    const acceptedNote =
      input.acceptedNote !== undefined ? normalizeNote(input.acceptedNote) : demoItems[index].acceptedNote ?? null;
    const nextEtag = `"demo-${Date.now()}"`; // Phase 2-0: bump etag on update

    const next: SchedItem = {
      ...demoItems[index],
      id: input.id,
      title,
      start,
      end,
      category: input.category,
      userId: input.userId ?? demoItems[index].userId,
      userLookupId: input.userLookupId ?? demoItems[index].userLookupId,
      personName: input.userName ?? demoItems[index].personName,
      serviceType: normalizedServiceType ?? (demoItems[index].serviceType as ScheduleServiceType | undefined),
      locationName: input.locationName ?? demoItems[index].locationName,
      notes: input.notes ?? demoItems[index].notes,
      assignedStaffId: input.assignedStaffId ?? demoItems[index].assignedStaffId,
      vehicleId: input.vehicleId ?? demoItems[index].vehicleId,
      status: input.status ?? demoItems[index].status,
      statusReason:
        input.statusReason !== undefined
          ? normalizeStatusReason(input.statusReason)
          : demoItems[index].statusReason ?? null,
      updatedAt,
      acceptedOn,
      acceptedBy,
      acceptedNote,
      etag: nextEtag,
    };

    demoItems[index] = next;
    return result.ok(next);
  },
  async remove(eventId: string) {
    const index = demoItems.findIndex((item) => item.id === eventId);
    if (index === -1) {
      throw new Error(`Schedule not found: ${eventId}`);
    }
    demoItems = [...demoItems.slice(0, index), ...demoItems.slice(index + 1)];
  },
};
