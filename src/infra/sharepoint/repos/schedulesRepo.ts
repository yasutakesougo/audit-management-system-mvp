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
import { useSP } from '@/lib/spClient';
import { FIELD_MAP } from '@/sharepoint/fields';
import type { ScheduleStatus, ScheduleServiceType, ScheduleVisibility } from '@/features/schedules/domain/types';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SpScheduleRow = Record<string, any>;

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

const toIso = (d: Date) => d.toISOString();
const escapeOData = (s: string) => s.replace(/'/g, "''");

export function buildSchedulesFilter(args: QuerySchedulesArgs) {
  const clauses: string[] = [];

  clauses.push(`EventDate ge datetime'${toIso(args.from)}'`);
  clauses.push(`EventDate lt datetime'${toIso(args.to)}'`);

  if (args.personType) {
    clauses.push(`cr014_personType eq '${escapeOData(args.personType)}'`);
  }
  if (args.personId) {
    clauses.push(`cr014_personId eq '${escapeOData(args.personId)}'`);
  }

  return clauses.join(' and ');
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
  const eventDate = String(sp.EventDate ?? '');
  const dayKeyRaw = sp.cr014_dayKey ? String(sp.cr014_dayKey) : eventDate;

  return {
    id: Number(sp.Id),
    etag: etag ?? sp['@odata.etag'] ?? sp.ETag,

    title: String(sp.Title ?? ''),
    rowKey: String(sp.RowKey ?? ''),

    eventDate,
    endDate: String(sp.EndDate ?? ''),

    status: sp.Status ? String(sp.Status) : undefined,
    serviceType: sp.ServiceType ? String(sp.ServiceType) : undefined,

    personType: sp.cr014_personType as SchedulePersonType,
    personId: String(sp.cr014_personId ?? ''),
    personName: sp.cr014_personName ? String(sp.cr014_personName) : undefined,

    assignedStaffId: sp.AssignedStaffId ? String(sp.AssignedStaffId) : undefined,
    targetUserId: sp.TargetUserId ? String(sp.TargetUserId) : undefined,

    dayKey: toDayKey(dayKeyRaw), // ← DateTime でもOK（yyyy-MM-dd に正規化）
    monthKey: String(sp.MonthKey ?? ''),
    fiscalYear: String(sp.cr014_fiscalYear ?? ''),

    orgAudience: sp.cr014_orgAudience ? String(sp.cr014_orgAudience) : undefined,
    note: sp.Note ? String(sp.Note) : undefined,

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
  client: ReturnType<typeof useSP>
): Promise<RepoSchedule[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listIdentifier = ((FIELD_MAP as any).Schedules?.title ?? 'Schedules');

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
    'Note',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickEtag = (v: any): string | undefined => {
  return v?.etag ?? v?.ETag ?? v?.__metadata?.etag ?? v?.headers?.etag ?? v?.headers?.ETag;
};

const buildCreateBody = (input: CreateScheduleInput) => {
  // ScheduleEvents (event list) has different fields than custom Schedules list
  // Use only fields that exist in event list: Title, EventDate, EndDate, Category, Location
  const body: Record<string, unknown> = {
    Title: input.title,
    EventDate: input.start,
    EndDate: input.end,
    Category: input.serviceType ?? 'User',
    Location: input.personName ?? '',
  };

  return body;
};

const buildUpdateBody = (input: UpdateScheduleInput) => {
  // ScheduleEvents (event list) has different fields than custom Schedules list
  const body: Record<string, unknown> = {};

  if (input.title !== undefined) body.Title = input.title;
  if (input.start !== undefined) body.EventDate = input.start;
  if (input.end !== undefined) body.EndDate = input.end;
  if (input.serviceType !== undefined) body.Category = input.serviceType;
  if (input.personName !== undefined) body.Location = input.personName;

  return body;
};

export async function createSchedule(
  client: ReturnType<typeof useSP>,
  input: CreateScheduleInput
): Promise<RepoSchedule> {
  assertWriteEnabled('createSchedule');

  // Use ScheduleEvents list (event list, not custom Schedules list)
  const listId = 'ScheduleEvents';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created: any = await client.addListItemByTitle(listId, buildCreateBody(input));

  const etag = pickEtag(created);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = created?.data ?? created;

  return mapSpToRepoSchedule(row, etag);
}

export async function updateSchedule(
  client: ReturnType<typeof useSP>,
  id: number,
  etag: string,
  input: UpdateScheduleInput
): Promise<RepoSchedule> {
  assertWriteEnabled('updateSchedule');

  // Use ScheduleEvents list (event list, not custom Schedules list)
  const listId = 'ScheduleEvents';

  // NOTE: spClient.updateItem(listId, id, body, { ifMatch }) 前提
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated: any = await client.updateItem(listId, id, buildUpdateBody(input), { ifMatch: etag });

  const nextEtag = pickEtag(updated) ?? etag;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = updated?.data ?? updated;

  return mapSpToRepoSchedule(row, nextEtag);
}

export async function removeSchedule(client: ReturnType<typeof useSP>, id: number): Promise<void> {
  assertWriteEnabled('removeSchedule');

  // Use ScheduleEvents list (event list, not custom Schedules list)
  const listId = 'ScheduleEvents';
  await client.deleteItem(listId, id);
}
