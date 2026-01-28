/**
 * Schedules リスト Phase 1 Query Repo
 *
 * SharePoint "Schedules" を spClient.listItems() で取得・整形して返す
 * - EventDate range filter
 * - Optional person filter (personType/personId)
 * - Sort: EventDate asc, RowKey asc
 * - DateTime→Date 揺れ吸収 (cr014_dayKey)
 */

import { useSP } from '@/lib/spClient';
import { LIST_CONFIG } from '@/sharepoint/fields';

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

function toIso(d: Date) {
  return d.toISOString();
}

function escapeOData(s: string) {
  return s.replace(/'/g, "''");
}

/** SharePoint の Date/DateTime 揺れ吸収 → yyyy-MM-dd */
export function toDayKey(value?: string) {
  if (!value) return '';
  return value.slice(0, 10);
}

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
  endDate: string;   // ISO

  status?: string;
  serviceType?: string;

  personType: SchedulePersonType;
  personId: string;
  personName?: string;

  assignedStaffId?: string;
  targetUserId?: string;

  dayKey: string;     // yyyy-MM-dd（正規化済み）
  monthKey: string;   // yyyy-MM
  fiscalYear: string; // "2025"

  orgAudience?: string;
  note?: string;

  createdAt?: string;
  updatedAt?: string;
};

export function mapSpToRepoSchedule(sp: SpScheduleRow): RepoSchedule {
  const eventDate = String(sp.EventDate ?? '');
  const dayKeyRaw = sp.cr014_dayKey ? String(sp.cr014_dayKey) : eventDate;

  return {
    id: Number(sp.Id),
    etag: sp['@odata.etag'] ?? sp.ETag,

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
 *
 * @param args - Query arguments (from, to dates, optional person filters)
 * @param client - SharePoint client from useSP()
 */
export async function querySchedules(
  args: QuerySchedulesArgs,
  client: ReturnType<typeof useSP>
): Promise<RepoSchedule[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listIdentifier = ((LIST_CONFIG as any).Schedules?.listIdentifier ?? (LIST_CONFIG as any).Schedules?.title ?? 'Schedules');

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

  return rows.map(mapSpToRepoSchedule);
}
