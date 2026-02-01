import { readOptionalEnv } from '@/lib/env';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { result, type Result, type ResultError } from '@/shared/result';
import { STAFF_ATTENDANCE_FIELDS, STAFF_ATTENDANCE_LIST_TITLE, STAFF_ATTENDANCE_SELECT_FIELDS } from '@/sharepoint/fields';
import type { AttendanceCounts, StaffAttendancePort } from '../port';
import type { RecordDate, StaffAttendance, StaffAttendanceStatus } from '../types';

type SharePointAttendanceRow = Record<string, unknown> & { Id?: number };

type SharePointAdapterOptions = {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
  client?: ReturnType<typeof createSpClient>;
};

const getHttpStatus = (e: unknown): number | undefined => {
  const anyErr = e as { status?: number; response?: { status?: number } };
  return anyErr?.status ?? anyErr?.response?.status;
};

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

const buildKey = (recordDate: RecordDate, staffId: string): string => `${recordDate}#${staffId}`;

const getListTitle = (override?: string): string =>
  override ?? readOptionalEnv('VITE_SP_LIST_STAFF_ATTENDANCE') ?? STAFF_ATTENDANCE_LIST_TITLE;

const toResultError = (error: unknown, op?: 'create' | 'update' | 'remove'): ResultError => {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) {
    return { kind: 'forbidden', message: 'Authentication required' };
  }
  if (status === 412) {
    return { kind: 'conflict', message: 'ETag conflict', resource: 'StaffAttendance', op };
  }
  if (status === 400 || status === 422) {
    return { kind: 'validation', message: 'Validation error', details: error };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'unknown', message, cause: error };
};

const getString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const getNumber = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

const toAttendance = (row: SharePointAttendanceRow): StaffAttendance | null => {
  const staffId = getString(row[STAFF_ATTENDANCE_FIELDS.staffId]);
  const recordDate = getString(row[STAFF_ATTENDANCE_FIELDS.recordDate]);
  const status = getString(row[STAFF_ATTENDANCE_FIELDS.status]) as StaffAttendanceStatus | undefined;
  if (!staffId || !recordDate || !status) return null;

  return {
    staffId,
    recordDate: recordDate as RecordDate,
    status,
    checkInAt: getString(row[STAFF_ATTENDANCE_FIELDS.checkInAt]),
    checkOutAt: getString(row[STAFF_ATTENDANCE_FIELDS.checkOutAt]),
    lateMinutes: getNumber(row[STAFF_ATTENDANCE_FIELDS.lateMinutes]),
    note: getString(row[STAFF_ATTENDANCE_FIELDS.note]),
  };
};

const omitUndefined = (record: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
};

const toSpPayload = (attendance: StaffAttendance, key: string): Record<string, unknown> => {
  return omitUndefined({
    [STAFF_ATTENDANCE_FIELDS.title]: key,
    [STAFF_ATTENDANCE_FIELDS.staffId]: attendance.staffId,
    [STAFF_ATTENDANCE_FIELDS.recordDate]: attendance.recordDate,
    [STAFF_ATTENDANCE_FIELDS.status]: attendance.status,
    [STAFF_ATTENDANCE_FIELDS.checkInAt]: attendance.checkInAt,
    [STAFF_ATTENDANCE_FIELDS.checkOutAt]: attendance.checkOutAt,
    [STAFF_ATTENDANCE_FIELDS.lateMinutes]: attendance.lateMinutes,
    [STAFF_ATTENDANCE_FIELDS.note]: attendance.note,
  });
};

const defaultSelect = [...STAFF_ATTENDANCE_SELECT_FIELDS];

export const createSharePointStaffAttendanceAdapter = (options: SharePointAdapterOptions = {}): StaffAttendancePort => {
  const listTitle = getListTitle(options.listTitle);
  const client = options.client ?? (options.acquireToken
    ? createSpClient(options.acquireToken, ensureConfig().baseUrl)
    : null);

  const assertClient = (): ReturnType<typeof createSpClient> => {
    if (!client) {
      throw new Error('SharePoint client not configured');
    }
    return client;
  };

  const findByKey = async (key: string): Promise<SharePointAttendanceRow | null> => {
    const sp = assertClient();
    const filter = `${STAFF_ATTENDANCE_FIELDS.title} eq '${escapeODataString(key)}'`;
    const rows = await sp.getListItemsByTitle<SharePointAttendanceRow>(listTitle, defaultSelect, filter, undefined, 1);
    return rows?.[0] ?? null;
  };

  return {
    async upsert(attendance: StaffAttendance): Promise<Result<void>> {
      let op: 'create' | 'update' = 'create';
      try {
        const sp = assertClient();
        const key = buildKey(attendance.recordDate, attendance.staffId);
        const existing = await findByKey(key);
        const payload = toSpPayload(attendance, key);

        if (existing && typeof existing.Id === 'number') {
          op = 'update';
          const { etag } = await sp.getItemByIdWithEtag(listTitle, existing.Id, defaultSelect);
          await sp.updateItemByTitle(listTitle, existing.Id, payload, { ifMatch: etag ?? '*' });
          return result.ok(undefined);
        }

        op = 'create';
        await sp.addListItemByTitle(listTitle, payload);
        return result.ok(undefined);
      } catch (error) {
        return result.err(toResultError(error, op));
      }
    },

    async remove(key: string): Promise<Result<void>> {
      try {
        const sp = assertClient();
        const existing = await findByKey(key);
        if (!existing || typeof existing.Id !== 'number') {
          return result.notFound('StaffAttendance not found');
        }
        await sp.deleteItemByTitle(listTitle, existing.Id);
        return result.ok(undefined);
      } catch (error) {
        return result.err(toResultError(error, 'remove'));
      }
    },

    async getByKey(key: string): Promise<Result<StaffAttendance | null>> {
      try {
        const existing = await findByKey(key);
        if (!existing) return result.ok(null);
        const attendance = toAttendance(existing);
        return result.ok(attendance ?? null);
      } catch (error) {
        return result.err(toResultError(error));
      }
    },

    async listByDate(date: string): Promise<Result<StaffAttendance[]>> {
      try {
        const sp = assertClient();
        const filter = `${STAFF_ATTENDANCE_FIELDS.recordDate} eq '${escapeODataString(date)}'`;
        const rows = await sp.getListItemsByTitle<SharePointAttendanceRow>(listTitle, defaultSelect, filter);
        const list = (rows ?? []).map(toAttendance).filter((v): v is StaffAttendance => Boolean(v));
        return result.ok(list);
      } catch (error) {
        return result.err(toResultError(error));
      }
    },

    async listByDateRange(from: string, to: string, top = 200): Promise<Result<StaffAttendance[]>> {
      try {
        const sp = assertClient();
        const filter = `${STAFF_ATTENDANCE_FIELDS.recordDate} ge '${escapeODataString(from)}' and ${STAFF_ATTENDANCE_FIELDS.recordDate} le '${escapeODataString(to)}'`;
        const orderby = `${STAFF_ATTENDANCE_FIELDS.recordDate} desc, ${STAFF_ATTENDANCE_FIELDS.staffId} asc`;
        const rows = await sp.getListItemsByTitle<SharePointAttendanceRow>(
          listTitle,
          defaultSelect,
          filter,
          orderby,
          top,
        );
        const list = (rows ?? []).map(toAttendance).filter((v): v is StaffAttendance => Boolean(v));
        return result.ok(list);
      } catch (error) {
        return result.err(toResultError(error));
      }
    },

    async countByDate(date: string): Promise<Result<AttendanceCounts>> {
      try {
        const listResult = await this.listByDate(date);
        if (!listResult.isOk) {
          return result.err(listResult.error);
        }
        const list = listResult.value;
        const onDuty = list.filter((a) => a.status === '出勤').length;
        const out = list.filter((a) => a.status === '外出中').length;
        const absent = list.filter((a) => a.status === '欠勤').length;
        return result.ok({ onDuty, out, absent, total: list.length });
      } catch (error) {
        return result.err(toResultError(error));
      }
    },
  };
};

export const sharePointStaffAttendanceAdapter = createSharePointStaffAttendanceAdapter();
