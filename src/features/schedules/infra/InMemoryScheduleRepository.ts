import { getAppConfig } from '@/lib/env';
import { normalizeServiceType as normalizeSharePointServiceType } from '@/sharepoint/serviceTypes';
import { createHash } from '@/utils/createHash';
import type { CreateScheduleInput, DateRange, ScheduleItem, ScheduleRepository, ScheduleRepositoryListParams, ScheduleRepositoryMutationParams, UpdateScheduleInput } from '../domain/ScheduleRepository';
import type { ScheduleServiceType } from '../domain/types';

/**
 * Format date as ISO string
 */
const formatISO = (date: Date): string => date.toISOString();

/**
 * Add hours to date
 */
const addHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

/**
 * Check if schedule is within date range
 */
const withinRange = (item: ScheduleItem, range: DateRange): boolean => {
  const fromTs = new Date(range.from).getTime();
  const toTs = new Date(range.to).getTime();
  const startTs = new Date(item.start).getTime();
  const endTs = new Date(item.end).getTime();
  if ([fromTs, toTs, startTs, endTs].some(Number.isNaN)) return true;
  return startTs < toTs && endTs > fromTs;
};

/**
 * Convert local datetime string to ISO
 */
const toIsoString = (value: string): string => {
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

/**
 * Normalize local datetime string (add seconds if missing)
 */
const normalizeLocal = (value: string): string =>
  (value.length === 16 ? `${value}:00` : value);

/**
 * Normalize optional local datetime
 */
const normalizeOptionalLocal = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return toIsoString(normalizeLocal(value));
};

/**
 * Normalize optional text field
 */
const normalizeOptionalText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

/**
 * Normalize note field
 */
const normalizeNote = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

/**
 * Normalize status reason
 */
const normalizeStatusReason = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * Normalize service type
 */
const normalizeServiceType = (value: CreateScheduleInput['serviceType']): ScheduleServiceType | undefined => {
  const raw = typeof value === 'string' ? value.trim() : value ?? undefined;
  const normalized = normalizeSharePointServiceType(raw ?? null);
  return (normalized ?? raw ?? undefined) as ScheduleServiceType | undefined;
};

/**
 * Resolve title with fallback
 */
const resolveTitle = (input: CreateScheduleInput): string =>
  (input.title ?? '').trim() || '予定';

/**
 * Default demo schedule items
 * Test compatibility: Use fixed date for demo items that covers test range
 */
const createDefaultItems = (): ScheduleItem[] => {
  const base = new Date('2026-01-15T09:00:00Z');
  base.setSeconds(0, 0);

  return [
    {
      id: 'demo-visit-morning',
      title: '訪問介護（午前）',
      start: formatISO(base),
      end: formatISO(addHours(base, 2)),
      status: 'Planned',
      statusReason: null,
      etag: '"demo-1"',
      source: 'demo' as const,
    },
    {
      id: 'demo-meeting',
      title: 'ケース会議',
      start: formatISO(addHours(base, 3)),
      end: formatISO(addHours(base, 4)),
      status: 'Planned',
      statusReason: null,
      etag: '"demo-2"',
      source: 'demo' as const,
    },
    {
      id: 'demo-visit-afternoon',
      title: '訪問介護（午後）',
      start: formatISO(addHours(base, 6)),
      end: formatISO(addHours(base, 8)),
      status: 'Planned',
      statusReason: null,
      etag: '"demo-3"',
      source: 'demo' as const,
    },
  ];
};

/**
 * Scenario-based seed data for testing
 */
const CONFLICTS_BASIC_DATE = '2025-11-14';
type WarningSchedItem = ScheduleItem & { baseShiftWarnings?: { staffId?: string; staffName?: string }[] };

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
    etag: '"demo-conflict-org"',
    source: 'demo' as const,
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
    etag: '"demo-conflict-user"',
    source: 'demo' as const,
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
    etag: '"demo-conflict-org-late"',
    source: 'demo' as const,
  },
];

/**
 * Resolve scenario from URL params
 */
const resolveScenario = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('scenario');
  } catch {
    return null;
  }
};

/**
 * Resolve seed data for scenario
 */
const resolveSeedForScenario = (scenario: string | null): ScheduleItem[] | null => {
  switch (scenario) {
    case 'conflicts-basic':
      return CONFLICTS_BASIC_SEED;
    default:
      return null;
  }
};

/**
 * Resolve E2E fixtures from localStorage
 * E2E tests can inject fixtures via localStorage.setItem('e2e:schedules.v1', JSON.stringify([...]))
 */
const resolveE2eSchedules = (): ScheduleItem[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('e2e:schedules.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ScheduleItem[];
  } catch (error) {
    if (getAppConfig().isDev) console.warn('[InMemoryScheduleRepository] E2E fixtures parse error:', error);
    return null;
  }
};

export type InMemoryScheduleRepositorySeed = {
  items?: ScheduleItem[];
};

/**
 * InMemory Schedule Repository
 *
 * In-memory implementation of ScheduleRepository for demo/test environments.
 * Supports E2E fixtures, scenario-based seeds, and stateful CRUD operations.
 */
export class InMemoryScheduleRepository implements ScheduleRepository {
  private items: ScheduleItem[];

  constructor(seed: InMemoryScheduleRepositorySeed = {}) {
    // Initialize with provided seed or default items
    const scenario = resolveScenario();
    const scenarioSeed = resolveSeedForScenario(scenario);
    const defaultSeed = scenarioSeed ?? createDefaultItems();
    this.items = [...(seed.items ?? defaultSeed)];
  }

  /**
   * List schedules within date range
   * Prioritizes E2E fixtures > scenario seed > default items
   */
  async list(params: ScheduleRepositoryListParams): Promise<ScheduleItem[]> {
    if (params.signal?.aborted) {
      return [];
    }

    const { range } = params;

    // Priority 1: E2E fixtures
    const e2eSchedules = resolveE2eSchedules();
    if (e2eSchedules) {
      return e2eSchedules
        .filter((item) => withinRange(item, range))
        .map((item) => ({
          ...item,
          etag: item.etag ?? `"demo-${item.id}"`,
        }));
    }

    // Priority 2: Current items (may include scenario seed)
    return this.items
      .filter((item) => withinRange(item, range))
      .map((item) => ({ ...item })); // Return shallow copies
  }

  /**
   * Create new schedule
   */
  async create(input: CreateScheduleInput, params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    if (params?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    const title = resolveTitle(input);
    const start = toIsoString(normalizeLocal(input.startLocal));
    const end = toIsoString(normalizeLocal(input.endLocal));
    const status = input.status ?? 'Planned';
    const statusReason = normalizeStatusReason(input.statusReason);
    const normalizedServiceType = normalizeServiceType(input.serviceType);
    const acceptedOn = normalizeOptionalLocal(input.acceptedOn);
    const acceptedBy = normalizeOptionalText(input.acceptedBy);
    const acceptedNote = normalizeNote(input.acceptedNote);

    // Generate entry hash for deduplication
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
    const etagValue = `"demo-${Date.now()}"`;

    const created: ScheduleItem = {
      id: `demo-${Date.now()}`,
      title,
      start,
      end,
      category: input.category,
      userId: input.userId,
      userLookupId: input.userLookupId ? Number(input.userLookupId) : undefined,
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
      visibility: input.visibility,
      ownerUserId: input.ownerUserId,
      source: 'demo' as const,
    };

    this.items.push(created);
    return { ...created };
  }

  /**
   * Update existing schedule
   */
  async update(input: UpdateScheduleInput, params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem> {
    if (params?.signal?.aborted) {
      throw new Error('Request aborted');
    }

    const index = this.items.findIndex((item) => item.id === input.id);
    if (index === -1) {
      throw new Error(`Schedule item not found: ${input.id}`);
    }

    const existingItem = this.items[index];
    const start = toIsoString(normalizeLocal(input.startLocal));
    const end = toIsoString(normalizeLocal(input.endLocal));
    const title = resolveTitle(input);
    const updatedAt = new Date().toISOString();
    const normalizedServiceType = normalizeServiceType(input.serviceType);
    const acceptedOn = normalizeOptionalLocal(input.acceptedOn) ?? existingItem.acceptedOn;
    const acceptedBy = normalizeOptionalText(input.acceptedBy) ?? existingItem.acceptedBy;
    const acceptedNote = input.acceptedNote !== undefined
      ? normalizeNote(input.acceptedNote)
      : existingItem.acceptedNote ?? null;
    const nextEtag = `"demo-${Date.now()}"`; // Bump etag on update

    const updated: ScheduleItem = {
      ...existingItem,
      id: input.id,
      title,
      start,
      end,
      category: input.category,
      userId: input.userId ?? existingItem.userId,
      userLookupId: input.userLookupId ? Number(input.userLookupId) : existingItem.userLookupId,
      personName: input.userName ?? existingItem.personName,
      serviceType: normalizedServiceType ?? (existingItem.serviceType as ScheduleServiceType | undefined),
      locationName: input.locationName ?? existingItem.locationName,
      notes: input.notes ?? existingItem.notes,
      assignedStaffId: input.assignedStaffId ?? existingItem.assignedStaffId,
      vehicleId: input.vehicleId ?? existingItem.vehicleId,
      status: input.status ?? existingItem.status,
      statusReason: input.statusReason !== undefined
        ? normalizeStatusReason(input.statusReason)
        : existingItem.statusReason ?? null,
      updatedAt,
      acceptedOn,
      acceptedBy,
      acceptedNote,
      etag: nextEtag,
      visibility: input.visibility ?? existingItem.visibility,
      ownerUserId: input.ownerUserId ?? existingItem.ownerUserId,
    };

    this.items[index] = updated;
    return { ...updated };
  }

  /**
   * Remove schedule by id
   */
  async remove(id: string, params?: ScheduleRepositoryMutationParams): Promise<void> {
    if (params?.signal?.aborted) {
      return;
    }

    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Schedule not found: ${id}`);
    }

    this.items = [...this.items.slice(0, index), ...this.items.slice(index + 1)];
  }
}

/**
 * Default singleton instance for demo mode
 */
export const inMemoryScheduleRepository: ScheduleRepository = new InMemoryScheduleRepository();
