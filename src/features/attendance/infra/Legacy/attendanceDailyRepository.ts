/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable */
/**
 * AttendanceDaily SharePoint Repository
 *
 * 通所記録日次データのリポジトリ
 * Keyベースでのupsert（更新または作成）操作を提供
 */

import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
    ATTENDANCE_DAILY_LIST_TITLE,
    ATTENDANCE_DAILY_CANDIDATES,
    ATTENDANCE_DAILY_ENSURE_FIELDS
} from '@/sharepoint/fields/attendanceFields';
import { resolveInternalNames, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { methodImpliesShuttle, parseTransportMethod, type TransportMethod } from '../../transportMethod';

export type AttendanceDailyItem = {
  Id?: number;
  Key: string;
  UserCode: string;
  RecordDate: string; // YYYY-MM-DD
  Status: string;
  CheckInAt?: string | null;
  CheckOutAt?: string | null;
  CntAttendIn?: number;
  CntAttendOut?: number;
  TransportTo?: boolean;
  TransportFrom?: boolean;
  ProvidedMinutes?: number | null;
  IsEarlyLeave?: boolean;
  UserConfirmedAt?: string | null;
  AbsentMorningContacted?: boolean;
  AbsentMorningMethod?: string;
  EveningChecked?: boolean;
  EveningNote?: string;
  IsAbsenceAddonClaimable?: boolean;

  // Transport method enum (optional - migration)
  TransportToMethod?: TransportMethod;
  TransportFromMethod?: TransportMethod;
  TransportToNote?: string;
  TransportFromNote?: string;

  // Absent support fields (optional - require SP column creation)
  AbsentContactTimestamp?: string;
  AbsentReason?: string;
  AbsentContactorType?: string;
  AbsentSupportContent?: string;
  NextScheduledDate?: string;
  StaffInChargeId?: string;
};

type SharePointDailyRow = Record<string, unknown> & { Id?: number };
type AttendanceDailyClient = ReturnType<typeof createSpClient>;

type AttendanceDailyResolvedFields = {
  key: string;
  legacyKey?: string;
  userCode: string;
  recordDate: string;
  status: string;
  checkInAt?: string;
  checkOutAt?: string;
  cntAttendIn?: string;
  cntAttendOut?: string;
  transportTo?: string;
  transportFrom?: string;
  providedMinutes?: string;
  isEarlyLeave?: string;
  userConfirmedAt?: string;
  absentMorningContacted?: string;
  absentMorningMethod?: string;
  eveningChecked?: string;
  eveningNote?: string;
  isAbsenceAddonClaimable?: string;
  transportToMethod?: string;
  transportFromMethod?: string;
  transportToNote?: string;
  transportFromNote?: string;
  absentContactTimestamp?: string;
  absentReason?: string;
  absentContactorType?: string;
  absentSupportContent?: string;
  nextScheduledDate?: string;
  staffInChargeId?: string;
  select: string[];
};

const attendanceDailyProvisioningLatch = new Set<string>();

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : (typeof value === 'number' ? String(value) : undefined);

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const getBool = (value: unknown): boolean => Boolean(value);

const attendanceDailyFieldCache = new Map<string, AttendanceDailyResolvedFields>();

const resolveAttendanceDailyFields = async (
  client: AttendanceDailyClient,
  listTitle: string,
): Promise<AttendanceDailyResolvedFields | null> => {
  const cacheKey = listTitle.toLowerCase();
  if (attendanceDailyFieldCache.get(cacheKey)) {
    return attendanceDailyFieldCache.get(cacheKey)!;
  }

  const resolve = async (): Promise<AttendanceDailyResolvedFields | null> => {
    let available: Set<string>;
    try {
      available = await client.getListFieldInternalNames(listTitle);
    } catch (error) {
       console.warn('[AttendanceDailyRepository] failed to fetch field names', error);
       return null;
    }

    const resolvedRaw = resolveInternalNames(available, ATTENDANCE_DAILY_CANDIDATES as any);
    const resolved = resolvedRaw as unknown as AttendanceDailyResolvedFields;
    
    if (!areEssentialFieldsResolved(resolved, ['key', 'userCode', 'recordDate', 'status'])) {
      return null;
    }

    // Build safe select fields
    resolved.select = [
      'Id',
      ...Object.values(resolved).filter((v): v is string => typeof v === 'string')
    ].filter((v, i, a) => a.indexOf(v) === i);

    return resolved;
  };

  let resolved = await resolve();

  // 必須列不足時の自動プロビジョニング
  if (!resolved && !attendanceDailyProvisioningLatch.has(cacheKey)) {
    console.info(`[AttendanceDailyRepository] schema mismatch for "${listTitle}". Attempting provision...`);
    attendanceDailyProvisioningLatch.add(cacheKey);
    try {
      await client.ensureListExists(listTitle, ATTENDANCE_DAILY_ENSURE_FIELDS);
      console.info(`[AttendanceDailyRepository] Provision successful. Re-resolving...`);
      resolved = await resolve();
    } catch (e) {
      console.warn('[AttendanceDailyRepository] Autoprovision failed', e);
    }
  }

  if (resolved) {
    attendanceDailyFieldCache.set(cacheKey, resolved);
  } else {
    console.warn('[AttendanceDailyRepository] Could not resolve essential fields', { listTitle });
  }

  return resolved;
};

const toAttendanceDaily = (row: SharePointDailyRow, fields: AttendanceDailyResolvedFields): AttendanceDailyItem | null => {
  const key =
    getString(row[fields.key]) ??
    (fields.legacyKey ? getString(row[fields.legacyKey]) : undefined);
  const userCode = getString(row[fields.userCode]);
  const recordDate = getString(row[fields.recordDate]);
  const status = getString(row[fields.status]);

  if (!key || !userCode || !recordDate || !status) return null;

  return {
    Id: typeof row.Id === 'number' ? row.Id : undefined,
    Key: key,
    UserCode: userCode,
    RecordDate: recordDate,
    Status: status,
    CheckInAt: fields.checkInAt ? (getString(row[fields.checkInAt]) ?? null) : null,
    CheckOutAt: fields.checkOutAt ? (getString(row[fields.checkOutAt]) ?? null) : null,
    CntAttendIn: fields.cntAttendIn ? (getNumber(row[fields.cntAttendIn]) ?? 0) : 0,
    CntAttendOut: fields.cntAttendOut ? (getNumber(row[fields.cntAttendOut]) ?? 0) : 0,
    TransportTo: fields.transportTo ? getBool(row[fields.transportTo]) : false,
    TransportFrom: fields.transportFrom ? getBool(row[fields.transportFrom]) : false,
    ProvidedMinutes: fields.providedMinutes ? (getNumber(row[fields.providedMinutes]) ?? null) : null,
    IsEarlyLeave: fields.isEarlyLeave ? getBool(row[fields.isEarlyLeave]) : false,
    UserConfirmedAt: fields.userConfirmedAt ? (getString(row[fields.userConfirmedAt]) ?? null) : null,
    AbsentMorningContacted: fields.absentMorningContacted ? getBool(row[fields.absentMorningContacted]) : false,
    AbsentMorningMethod: fields.absentMorningMethod ? (getString(row[fields.absentMorningMethod]) ?? '') : '',
    EveningChecked: fields.eveningChecked ? getBool(row[fields.eveningChecked]) : false,
    EveningNote: fields.eveningNote ? (getString(row[fields.eveningNote]) ?? '') : '',
    IsAbsenceAddonClaimable: fields.isAbsenceAddonClaimable ? getBool(row[fields.isAbsenceAddonClaimable]) : false,

    // Transport method (optional - may not exist in SP yet)
    TransportToMethod: fields.transportToMethod ? parseTransportMethod(row[fields.transportToMethod]) : undefined,
    TransportFromMethod: fields.transportFromMethod ? parseTransportMethod(row[fields.transportFromMethod]) : undefined,
    TransportToNote: fields.transportToNote ? (getString(row[fields.transportToNote]) ?? undefined) : undefined,
    TransportFromNote: fields.transportFromNote ? (getString(row[fields.transportFromNote]) ?? undefined) : undefined,

    // Absent support (optional - may not exist in SP yet)
    AbsentContactTimestamp: fields.absentContactTimestamp ? (getString(row[fields.absentContactTimestamp]) ?? undefined) : undefined,
    AbsentReason: fields.absentReason ? (getString(row[fields.absentReason]) ?? undefined) : undefined,
    AbsentContactorType: fields.absentContactorType ? (getString(row[fields.absentContactorType]) ?? undefined) : undefined,
    AbsentSupportContent: fields.absentSupportContent ? (getString(row[fields.absentSupportContent]) ?? undefined) : undefined,
    NextScheduledDate: fields.nextScheduledDate ? (getString(row[fields.nextScheduledDate]) ?? undefined) : undefined,
    StaffInChargeId: fields.staffInChargeId ? (getString(row[fields.staffInChargeId]) ?? undefined) : undefined,
  };
};

const omitUndefined = (record: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
};

const assignIfFieldPresent = (
  target: Record<string, unknown>,
  fieldName: string | undefined,
  value: unknown,
): void => {
  if (!fieldName || value === undefined) return;
  target[fieldName] = value;
};

const toSpPayload = (
  item: AttendanceDailyItem,
  fields: AttendanceDailyResolvedFields,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    // Required mapping resolved from the target list schema.
    [fields.key]: item.Key,
    [fields.userCode]: item.UserCode,
    [fields.recordDate]: item.RecordDate,
    [fields.status]: item.Status,
  };

  assignIfFieldPresent(payload, fields.checkInAt, item.CheckInAt);
  assignIfFieldPresent(payload, fields.checkOutAt, item.CheckOutAt);
  assignIfFieldPresent(payload, fields.cntAttendIn, item.CntAttendIn);
  assignIfFieldPresent(payload, fields.cntAttendOut, item.CntAttendOut);
  assignIfFieldPresent(
    payload,
    fields.transportTo,
    item.TransportToMethod ? methodImpliesShuttle(item.TransportToMethod) : item.TransportTo,
  );
  assignIfFieldPresent(
    payload,
    fields.transportFrom,
    item.TransportFromMethod ? methodImpliesShuttle(item.TransportFromMethod) : item.TransportFrom,
  );
  assignIfFieldPresent(payload, fields.providedMinutes, item.ProvidedMinutes);
  assignIfFieldPresent(payload, fields.isEarlyLeave, item.IsEarlyLeave);
  assignIfFieldPresent(payload, fields.userConfirmedAt, item.UserConfirmedAt);
  assignIfFieldPresent(payload, fields.absentMorningContacted, item.AbsentMorningContacted);
  assignIfFieldPresent(payload, fields.absentMorningMethod, item.AbsentMorningMethod);
  assignIfFieldPresent(payload, fields.eveningChecked, item.EveningChecked);
  assignIfFieldPresent(payload, fields.eveningNote, item.EveningNote);
  assignIfFieldPresent(payload, fields.isAbsenceAddonClaimable, item.IsAbsenceAddonClaimable);
  assignIfFieldPresent(payload, fields.transportToMethod, item.TransportToMethod);
  assignIfFieldPresent(payload, fields.transportFromMethod, item.TransportFromMethod);
  assignIfFieldPresent(payload, fields.transportToNote, item.TransportToNote);
  assignIfFieldPresent(payload, fields.transportFromNote, item.TransportFromNote);
  assignIfFieldPresent(payload, fields.absentContactTimestamp, item.AbsentContactTimestamp);
  assignIfFieldPresent(payload, fields.absentReason, item.AbsentReason);
  assignIfFieldPresent(payload, fields.absentContactorType, item.AbsentContactorType);
  assignIfFieldPresent(payload, fields.absentSupportContent, item.AbsentSupportContent);
  assignIfFieldPresent(payload, fields.nextScheduledDate, item.NextScheduledDate);
  assignIfFieldPresent(payload, fields.staffInChargeId, item.StaffInChargeId);

  return omitUndefined(payload);
};

/**
 * 指定日の記録を取得
 * @param client SharePoint client
 * @param recordDate YYYY-MM-DD形式の日付
 * @param listTitle リスト名（デフォルト: AttendanceDaily）
 */
export async function getDailyByDate(
  client: ReturnType<typeof createSpClient>,
  recordDate: string,
  listTitle: string = ATTENDANCE_DAILY_LIST_TITLE
): Promise<AttendanceDailyItem[]> {
  const resolvedFields = await resolveAttendanceDailyFields(client, listTitle);
  if (!resolvedFields) {
    return [];
  }
  const select = resolvedFields.select;
  const filter = `${resolvedFields.recordDate} eq '${escapeODataString(recordDate)}'`;

  const rows = await client.getListItemsByTitle<SharePointDailyRow>(
    listTitle,
    select,
    filter
  );

  return (rows ?? [])
    .map((row) => toAttendanceDaily(row, resolvedFields))
    .filter((item): item is AttendanceDailyItem => item !== null);
}

/**
 * KeyでUpsert（更新または作成）
 * 1. Key で検索（top=1）
 * 2. 存在すれば PATCH (updateItemByTitle)
 * 3. 存在しなければ POST (addListItemByTitle)
 *
 * @param client SharePoint client
 * @param item AttendanceDailyItem
 * @param listTitle リスト名（デフォルト: AttendanceDaily）
 */
export async function upsertDailyByKey(
  client: ReturnType<typeof createSpClient>,
  item: AttendanceDailyItem,
  listTitle: string = ATTENDANCE_DAILY_LIST_TITLE
): Promise<void> {
  const resolvedFields = await resolveAttendanceDailyFields(client, listTitle);
  if (!resolvedFields) {
    throw new Error(`[AttendanceDailyRepository] list schema not compatible: ${listTitle}`);
  }

  const select = resolvedFields.select;
  const filter = `${resolvedFields.key} eq '${escapeODataString(item.Key)}'`;

  // 1) GET by Key (top 1)
  const existing = await client.getListItemsByTitle<SharePointDailyRow>(
    listTitle,
    select,
    filter,
    undefined,
    1
  );

  const payload = toSpPayload(item, resolvedFields);

  // 2) if found -> PATCH by Id
  if (existing && existing.length > 0 && typeof existing[0].Id === 'number') {
    const existingId = existing[0].Id;
    const { etag } = await client.getItemByIdWithEtag(listTitle, existingId, select);
    await client.updateItemByTitle(listTitle, existingId, payload, { ifMatch: etag ?? '*' });
    return;
  }

  // 3) else -> POST
  await client.addListItemByTitle(listTitle, payload);
}

/**
 * デフォルトクライアントでのヘルパー（認証付き）
 */
export function createAttendanceDailyRepository(
  acquireToken: () => Promise<string | null>
) {
  const client = createSpClient(acquireToken, ensureConfig().baseUrl);

  return {
    getDailyByDate: (recordDate: string, listTitle?: string) =>
      getDailyByDate(client, recordDate, listTitle),
    upsertDailyByKey: (item: AttendanceDailyItem, listTitle?: string) =>
      upsertDailyByKey(client, item, listTitle),
  };
}
