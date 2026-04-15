/**
 * Schedules リスト Phase 1 Query & Mutation Repo
 *
 * - Step 2: querySchedules (read/query)
 * - Step 3: createSchedule / updateSchedule / removeSchedule (write)
 *
 * SharePoint "Schedules" を spClient で操作・整形して返す
 * - EventDate range filter (query)
 * - Optional person filter (query)
 * - DateTime→Date 揺れ吸収 (cr014_dayKey)
 * - ETag 412 conflict handling (update)
 */

import { isWriteEnabled } from '@/env';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { FIELD_MAP, SCHEDULE_FIELD_CR014_PERSON_ID, SCHEDULE_FIELD_CR014_PERSON_TYPE, SCHEDULE_FIELD_START } from '@/sharepoint/fields';
import type { ScheduleStatus, ScheduleServiceType, ScheduleVisibility } from '@/features/schedules/domain/types';
import { getSchedulesListTitle } from '@/features/schedules/data/spSchema';
import { buildDateTime, buildEq, buildGe, buildLt, joinAnd } from '@/sharepoint/query/builders';

// ────────────────────────────────────────────────────────────────
// Write Gate: Repo レベルで mutation を確実に遮断
// ────────────────────────────────────────────────────────────────

export class WriteDisabledError extends Error {
  readonly code = 'WRITE_DISABLED' as const;
  constructor(operation: string) {
    super(`Write operation "${operation}" is disabled. Set VITE_WRITE_ENABLED=1 to enable.`);
    this.name = 'WriteDisabledError';
  }
}

function assertWriteEnabled(operation: string): void {
  if (!isWriteEnabled) {
    throw new WriteDisabledError(operation);
  }
}

// ────────────────────────────────────────────────────────────────
// Step 2: Read/Query Types & Functions
// ────────────────────────────────────────────────────────────────

export type SchedulePersonType = 'User' | 'Staff' | 'Org';

export type SpScheduleRow = {
  Id?: number;
  Title?: string;
  EventDate?: string;
  EndDate?: string;
  Status?: string;
  ServiceType?: string;
  RowKey?: string;
  MonthKey?: string;
  ETag?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  cr014_personType?: string;
  cr014_personId?: string;
  cr014_personName?: string;
  cr014_dayKey?: string;
  cr014_fiscalYear?: string;
  cr014_orgAudience?: string;
  AssignedStaff?: string;
  AssignedStaffId?: string;
  Vehicle?: string;
  VehicleId?: string;
  TargetUserId?: string;
  Note?: string;
  Notes?: string;
  '@odata.etag'?: string;
  etag?: string;
  d?: { Id?: number };
  data?: { Id?: number };
  headers?: { etag?: string; ETag?: string };
  __metadata?: { etag?: string };
} & Record<string, unknown>;

export type QuerySchedulesArgs = {
  from: Date;
  to: Date; // exclusive 推奨
  personType?: SchedulePersonType;
  personId?: string;
  top?: number;
  pageCap?: number;
  signal?: AbortSignal;
};

/** SharePoint の Date/DateTime 揺れ吸収 → yyyy-MM-dd */
export function toDayKey(value?: string) {
  if (!value) return '';
  return value.slice(0, 10);
}

/**
 * Convert Date to ISO string WITHOUT 'Z' suffix
 * SharePoint will interpret as site timezone (JST) instead of UTC
 * This prevents 9-hour offset issues
 */
const toIso = (d: Date) => {
  const iso = d.toISOString();
  return iso.endsWith('Z') ? iso.slice(0, -1) : iso;
};

// Unused function removed (escapeOData)

const isEventScheduleList = (): boolean =>
  getSchedulesListTitle().trim().toLowerCase() === 'scheduleevents';

const resolveNotesFieldName = (): 'Note' | 'Notes' =>
  isEventScheduleList() ? 'Notes' : 'Note';

export function buildSchedulesFilter(args: QuerySchedulesArgs) {
  const clauses: (string | undefined)[] = [];

  clauses.push(buildGe(SCHEDULE_FIELD_START, buildDateTime(toIso(args.from))));
  clauses.push(buildLt(SCHEDULE_FIELD_START, buildDateTime(toIso(args.to))));

  if (args.personType) {
    clauses.push(buildEq(SCHEDULE_FIELD_CR014_PERSON_TYPE, args.personType));
  }
  if (args.personId) {
    clauses.push(buildEq(SCHEDULE_FIELD_CR014_PERSON_ID, args.personId));
  }

  return joinAnd(clauses);
}

export type RepoSchedule = {
  id: number;
  etag?: string;

  title: string;
  rowKey: string;

  eventDate: string; // ISO
  endDate: string;

  status?: string;
  serviceType?: string;

  personType: SchedulePersonType;
  personId: string;
  personName?: string;

  assignedStaffId?: string;
  vehicleId?: string;
  targetUserId?: string;

  dayKey: string; // yyyy-MM-dd
  monthKey: string;
  fiscalYear: string;

  orgAudience?: string;
  note?: string;

  createdAt?: string;
  updatedAt?: string;
};

export function mapSpToRepoSchedule(sp: SpScheduleRow, etag?: string): RepoSchedule {
  // Safe field extraction with fallbacks
  const id = Number(sp.Id);
  if (!id || !Number.isFinite(id)) {
    console.error('[mapSpToRepoSchedule] Invalid or missing Id:', sp);
    throw new Error('Invalid schedule item: missing or invalid Id');
  }

  const eventDate = String(sp.EventDate ?? '');
  const endDate = String(sp.EndDate ?? sp.EventDate ?? ''); // Fallback to EventDate if EndDate missing
  const dayKeyRaw = sp.cr014_dayKey ? String(sp.cr014_dayKey) : eventDate;
  const monthKeyRaw = sp.MonthKey ? String(sp.MonthKey) : dayKeyRaw;

  if (!eventDate) {
    console.error('[mapSpToRepoSchedule] Missing EventDate for item:', sp);
    throw new Error(`Schedule item ${id} is missing EventDate`);
  }

  // Normalize dayKey/monthKey to TEXT format (YYYY-MM-DD / YYYY-MM)
  // SharePoint may return DateTime format even if we send TEXT
  const dayKeyNormalized = toDayKeyJst(dayKeyRaw);
  const monthKeyNormalized = toMonthKeyJst(monthKeyRaw);

  return {
    id,
    etag: etag ?? sp['@odata.etag'] ?? sp.ETag,

    title: String(sp.Title ?? ''),
    rowKey: String(sp.RowKey ?? ''),

    eventDate,
    endDate,

    status: sp.Status ? String(sp.Status) : undefined,
    serviceType: sp.ServiceType ? String(sp.ServiceType) : undefined,

    personType: sp.cr014_personType as SchedulePersonType,
    personId: String(sp.cr014_personId ?? ''),
    personName: sp.cr014_personName ? String(sp.cr014_personName) : undefined,

    assignedStaffId: sp.AssignedStaffId
      ? String(sp.AssignedStaffId)
      : (sp.AssignedStaff ? String(sp.AssignedStaff) : undefined),
    vehicleId: sp.Vehicle
      ? String(sp.Vehicle)
      : (sp.VehicleId ? String(sp.VehicleId) : undefined),
    targetUserId: sp.TargetUserId ? String(sp.TargetUserId) : undefined,

    dayKey: dayKeyNormalized,
    monthKey: monthKeyNormalized,
    fiscalYear: String(sp.cr014_fiscalYear ?? ''),

    orgAudience: sp.cr014_orgAudience ? String(sp.cr014_orgAudience) : undefined,
    note: sp.Note
      ? String(sp.Note)
      : (sp.Notes ? String(sp.Notes) : undefined),

    createdAt: sp.CreatedAt ? String(sp.CreatedAt) : undefined,
    updatedAt: sp.UpdatedAt ? String(sp.UpdatedAt) : undefined,
  };
}

/**
 * Step 2: SharePoint "Schedules" を read/query
 * - EventDate range + optional person filter
 * - Sort: EventDate asc, RowKey asc
 */
export async function querySchedules(
  args: QuerySchedulesArgs,
  client: IDataProvider
): Promise<RepoSchedule[]> {
  const listIdentifier = FIELD_MAP.Schedules.title;
  const notesField = resolveNotesFieldName();

  const select = [
    'Id',
    'Title',
    'EventDate',
    'EndDate',
    'Status',
    'ServiceType',
    'cr014_personType',
    'cr014_personId',
    'cr014_personName',
    'AssignedStaffId',
    'TargetUserId',
    'RowKey',
    'cr014_dayKey',
    'MonthKey',
    'cr014_fiscalYear',
    'cr014_orgAudience',
    notesField,
    'CreatedAt',
    'UpdatedAt',
  ];

  const filter = buildSchedulesFilter(args);
  const orderby = 'EventDate asc, RowKey asc';

  const rows = await client.listItems<SpScheduleRow>(listIdentifier, {
    select,
    filter,
    orderby,
    top: args.top ?? 100,
    pageCap: args.pageCap,
    signal: args.signal,
  });

  return rows.map(row => mapSpToRepoSchedule(row));
}

// ────────────────────────────────────────────────────────────────
// Step 3: Write (Create / Update / Delete)
// ────────────────────────────────────────────────────────────────

export type CreateScheduleInput = {
  title: string;
  start: string; // ISO
  end: string;   // ISO
  status?: ScheduleStatus;
  serviceType?: ScheduleServiceType | string;
  visibility?: ScheduleVisibility;

  personType: 'User' | 'Staff' | 'Org';
  personId: string;
  personName?: string;

  assignedStaffId?: string;
  vehicleId?: string;
  targetUserId?: string;

  rowKey: string;
  dayKey: string; // yyyy-MM-dd
  monthKey: string; // yyyy-MM
  fiscalYear: string; // e.g. "2025"

  orgAudience?: string;
  notes?: string;
};

export type UpdateScheduleInput = Partial<Omit<CreateScheduleInput, 'rowKey'>> & {
  // rowKey は原則不変
};

const pickEtag = (v: SpScheduleRow | undefined | null): string | undefined => {
  if (!v) return undefined;
  return (v.etag ?? v.ETag ?? v.__metadata?.etag ?? v.headers?.etag ?? v.headers?.ETag) as string | undefined;
};

/**
 * Convert any date-like value to JST dayKey (YYYY-MM-DD)
 * CRITICAL: Ensures TEXT format for SharePoint, preventing DateTime auto-conversion
 */
const toDayKeyJst = (v: unknown): string => {
  // Already valid dayKey format
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // Convert Date or ISO string to timestamp
  const t =
    v instanceof Date ? v.getTime() :
    typeof v === 'string' ? Date.parse(v) :
    Number.NaN;

  if (Number.isNaN(t)) {
    console.error('[schedulesRepo] Invalid dayKey input:', v);
    throw new Error(`Invalid dayKey: ${String(v)}`);
  }

  const d = new Date(t);
  // sv-SE locale returns YYYY-MM-DD format
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/**
 * Convert any date-like value to JST monthKey (YYYY-MM)
 */
const toMonthKeyJst = (v: unknown): string => toDayKeyJst(v).slice(0, 7);

const buildCreateBody = (input: CreateScheduleInput) => {
  // Convert dayKey/monthKey to guaranteed YYYY-MM-DD / YYYY-MM format
  const dayKeyText = toDayKeyJst(input.dayKey);
  const monthKeyText = toMonthKeyJst(input.monthKey);

  // DailyOpsSignals custom list uses FIELD_MAP.Schedules field names
  const body: Record<string, unknown> = {
    Title: input.title,
    EventDate: input.start,
    EndDate: input.end,
    Status: input.status ?? 'scheduled',
    ServiceType: input.serviceType ?? 'User',
    cr014_personType: input.personType,
    cr014_personId: input.personId,
    RowKey: input.rowKey,
    // CRITICAL: Use toDayKeyJst/toMonthKeyJst to ensure TEXT format
    // Prevents SharePoint DateTime auto-conversion
    cr014_dayKey: dayKeyText,
    MonthKey: monthKeyText,
    cr014_fiscalYear: input.fiscalYear,
  };

  // Optional fields
  if (input.personName) body.cr014_personName = input.personName;
  if (input.assignedStaffId) {
    body.AssignedStaff = input.assignedStaffId;
    body.AssignedStaffId = input.assignedStaffId;
  }
  if (input.vehicleId) {
    body.Vehicle = input.vehicleId;
    body.VehicleId = input.vehicleId;
  }
  if (input.targetUserId) body.TargetUserId = input.targetUserId;
  if (input.orgAudience) body.cr014_orgAudience = input.orgAudience;
  if (input.notes) body[resolveNotesFieldName()] = input.notes;

  return body;
};

const buildUpdateBody = (input: UpdateScheduleInput) => {
  // DailyOpsSignals custom list uses FIELD_MAP.Schedules field names
  const body: Record<string, unknown> = {};

  if (input.title !== undefined) body.Title = input.title;
  if (input.start !== undefined) body.EventDate = input.start;
  if (input.end !== undefined) body.EndDate = input.end;
  if (input.status !== undefined) body.Status = input.status;
  if (input.serviceType !== undefined) body.ServiceType = input.serviceType;
  if (input.personType !== undefined) body.cr014_personType = input.personType;
  if (input.personId !== undefined) body.cr014_personId = input.personId;
  if (input.personName !== undefined) body.cr014_personName = input.personName;
  if (input.assignedStaffId !== undefined) {
    const assignedStaff = input.assignedStaffId || null;
    body.AssignedStaff = assignedStaff;
    body.AssignedStaffId = assignedStaff;
  }
  if (input.vehicleId !== undefined) {
    const vehicle = input.vehicleId || null;
    body.Vehicle = vehicle;
    body.VehicleId = vehicle;
  }
  if (input.targetUserId !== undefined) body.TargetUserId = input.targetUserId;
  // CRITICAL: Use toDayKeyJst/toMonthKeyJst to ensure TEXT format
  if (input.dayKey !== undefined) body.cr014_dayKey = toDayKeyJst(input.dayKey);
  if (input.monthKey !== undefined) body.MonthKey = toMonthKeyJst(input.monthKey);
  if (input.fiscalYear !== undefined) body.cr014_fiscalYear = input.fiscalYear;
  if (input.orgAudience !== undefined) body.cr014_orgAudience = input.orgAudience;
  if (input.notes !== undefined) body[resolveNotesFieldName()] = input.notes;

  return body;
};

export async function createSchedule(
  client: IDataProvider,
  input: CreateScheduleInput
): Promise<RepoSchedule> {
  assertWriteEnabled('createSchedule');

  const listId = getSchedulesListTitle();
  const payload = buildCreateBody(input);

  // Step 1: POST to create item (may return incomplete data)
  const created = await client.createItem<SpScheduleRow>(listId, payload);
  
  // Step 2: Extract ID from response
  const createdId = Number(created?.Id ?? created?.d?.Id ?? created?.data?.Id);
  
  if (!createdId || !Number.isFinite(createdId)) {
    console.error('[schedulesRepo] Failed to extract ID from POST response:', created);
    throw new Error('Failed to extract item ID from create response');
  }

  console.log('[schedulesRepo] Created schedule with ID:', createdId);

  // Step 3: Fetch the full item with all fields (same $select as query)
  const notesField = resolveNotesFieldName();
  const select = [
    'Id',
    'Title',
    'EventDate',
    'EndDate',
    'Status',
    'ServiceType',
    'cr014_personType',
    'cr014_personId',
    'cr014_personName',
    'AssignedStaffId',
    'TargetUserId',
    'RowKey',
    'cr014_dayKey',
    'MonthKey',
    'cr014_fiscalYear',
    'cr014_orgAudience',
    notesField,
    'CreatedAt',
    'UpdatedAt',
  ];

  const items = await client.listItems<SpScheduleRow>(listId, {
    select,
    filter: buildEq(FIELD_MAP.Schedules.id, createdId),
    top: 1,
  });

  const fullItem = items[0];
  
  if (!fullItem) {
    console.error('[schedulesRepo] Failed to fetch created item with ID:', createdId);
    throw new Error('Failed to fetch created schedule after POST');
  }

  console.log('[schedulesRepo] Fetched full item:', JSON.stringify(fullItem, null, 2));

  // Step 4: Map to domain type
  const etag = pickEtag(created) || pickEtag(fullItem);
  try {
    return mapSpToRepoSchedule(fullItem, etag);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error(
      '[schedulesRepo] 🔴 MAP_FAILED:\n' +
      `  message: ${errorMessage}\n` +
      `  stack: ${errorStack}\n` +
      `  keys: ${Object.keys(fullItem ?? {}).join(', ')}\n` +
      `  fullItem JSON:\n${JSON.stringify(fullItem, null, 2)}`
    );
    throw new Error(`Failed to map created schedule: ${errorMessage}`);
  }
}

export async function updateSchedule(
  client: IDataProvider,
  id: number,
  etag: string,
  input: UpdateScheduleInput
): Promise<RepoSchedule> {
  assertWriteEnabled('updateSchedule');

  // Use ScheduleEvents list (event list, not custom Schedules list)
  const listId = getSchedulesListTitle();

  // NOTE: client.updateItem(listId, id, body, { etag }) 前提
  const updated = await client.updateItem<SpScheduleRow>(listId, id, buildUpdateBody(input), { etag });

  const nextEtag = pickEtag(updated) ?? etag;
  const row = (updated?.data ?? updated) as SpScheduleRow | undefined;

  try {
    return mapSpToRepoSchedule(row!, nextEtag);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error('[schedulesRepo] 🔴 Failed to map updated schedule');
    console.error('  error:', { message: errorMessage, stack: errorStack });
    console.error('  row keys:', Object.keys(row ?? {}));
    console.table({
      Id: row?.Id,
      Title: row?.Title,
      EventDate: row?.EventDate,
      EndDate: row?.EndDate,
      Status: row?.Status,
      ServiceType: row?.ServiceType,
      cr014_personType: (row as Record<string, unknown>)?.cr014_personType,
      cr014_personId: (row as Record<string, unknown>)?.cr014_personId,
    });
    console.error('  row (raw):', JSON.stringify(row, null, 2));
    throw new Error(`Failed to map updated schedule: ${errorMessage}`);
  }
}

export async function removeSchedule(client: IDataProvider, id: number): Promise<void> {
  assertWriteEnabled('removeSchedule');

  // Use ScheduleEvents list (event list, not custom Schedules list)
  const listId = getSchedulesListTitle();
  await client.deleteItem(listId, id);
}
