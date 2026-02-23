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
const getBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);
const isValidationError = (error: unknown): boolean => {
  const status = getHttpStatus(error);
  return status === 400 || status === 422;
};

const toAttendance = (row: SharePointAttendanceRow): StaffAttendance | null => {
  const staffId = getString(row[STAFF_ATTENDANCE_FIELDS.staffId]);
  const recordDate = getString(row[STAFF_ATTENDANCE_FIELDS.recordDate]);
  const status = getString(row[STAFF_ATTENDANCE_FIELDS.status]) as StaffAttendanceStatus | undefined;
  if (!staffId || !recordDate || !status) return null;

  return {
    staffId,
    recordDate: recordDate as RecordDate,
    status,
    isFinalized: getBoolean(row[STAFF_ATTENDANCE_FIELDS.isFinalized]) ?? false,
    finalizedAt: getString(row[STAFF_ATTENDANCE_FIELDS.finalizedAt]),
    finalizedBy: getString(row[STAFF_ATTENDANCE_FIELDS.finalizedBy]),
    checkInAt: getString(row[STAFF_ATTENDANCE_FIELDS.checkInAt]),
    checkOutAt: getString(row[STAFF_ATTENDANCE_FIELDS.checkOutAt]),
    lateMinutes: getNumber(row[STAFF_ATTENDANCE_FIELDS.lateMinutes]),
    note: getString(row[STAFF_ATTENDANCE_FIELDS.note]),
  };
};

const omitUndefined = (record: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
};

const toSpPayload = (
  attendance: StaffAttendance,
  key: string,
  includeAuditFields = true,
): Record<string, unknown> => {
  return omitUndefined({
    [STAFF_ATTENDANCE_FIELDS.title]: key,
    [STAFF_ATTENDANCE_FIELDS.staffId]: attendance.staffId,
    [STAFF_ATTENDANCE_FIELDS.recordDate]: attendance.recordDate,
    [STAFF_ATTENDANCE_FIELDS.isFinalized]: attendance.isFinalized,
    ...(includeAuditFields
      ? {
          [STAFF_ATTENDANCE_FIELDS.finalizedAt]: attendance.finalizedAt,
          [STAFF_ATTENDANCE_FIELDS.finalizedBy]: attendance.finalizedBy,
        }
      : {}),
    [STAFF_ATTENDANCE_FIELDS.status]: attendance.status,
    [STAFF_ATTENDANCE_FIELDS.checkInAt]: attendance.checkInAt,
    [STAFF_ATTENDANCE_FIELDS.checkOutAt]: attendance.checkOutAt,
    [STAFF_ATTENDANCE_FIELDS.lateMinutes]: attendance.lateMinutes,
    [STAFF_ATTENDANCE_FIELDS.note]: attendance.note,
  });
};

const defaultSelect = [...STAFF_ATTENDANCE_SELECT_FIELDS];
const selectWithOptionalAudit = [
  ...defaultSelect,
  STAFF_ATTENDANCE_FIELDS.finalizedAt,
  STAFF_ATTENDANCE_FIELDS.finalizedBy,
] as string[];

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
    try {
      const rows = await sp.getListItemsByTitle<SharePointAttendanceRow>(listTitle, selectWithOptionalAudit, filter, undefined, 1);
      return rows?.[0] ?? null;
    } catch (error) {
      if (!isValidationError(error)) throw error;
      const rows = await sp.getListItemsByTitle<SharePointAttendanceRow>(listTitle, defaultSelect, filter, undefined, 1);
      return rows?.[0] ?? null;
    }
  };

  const listByDateRows = async (date: string): Promise<SharePointAttendanceRow[]> => {
    const sp = assertClient();
    const filter = `${STAFF_ATTENDANCE_FIELDS.recordDate} eq '${escapeODataString(date)}'`;
    try {
      return await sp.getListItemsByTitle<SharePointAttendanceRow>(listTitle, selectWithOptionalAudit, filter);
    } catch (error) {
      if (!isValidationError(error)) throw error;
      return await sp.getListItemsByTitle<SharePointAttendanceRow>(listTitle, defaultSelect, filter);
    }
  };

  const listByDateRangeRows = async (from: string, to: string, top: number): Promise<SharePointAttendanceRow[]> => {
    const sp = assertClient();
    const filter = `${STAFF_ATTENDANCE_FIELDS.recordDate} ge '${escapeODataString(from)}' and ${STAFF_ATTENDANCE_FIELDS.recordDate} le '${escapeODataString(to)}'`;
    const orderby = `${STAFF_ATTENDANCE_FIELDS.recordDate} desc, ${STAFF_ATTENDANCE_FIELDS.staffId} asc`;
    const maxPages = 10;
    try {
      return await sp.listItems<SharePointAttendanceRow>(listTitle, {
        select: selectWithOptionalAudit,
        filter,
        orderby,
        top,
        pageCap: maxPages,
      });
    } catch (error) {
      if (!isValidationError(error)) throw error;
      return await sp.listItems<SharePointAttendanceRow>(listTitle, {
        select: defaultSelect,
        filter,
        orderby,
        top,
        pageCap: maxPages,
      });
    }
  };

  const upsertWithFallback = async (attendance: StaffAttendance): Promise<Result<void>> => {
    let op: 'create' | 'update' = 'create';
    try {
      const sp = assertClient();
      const key = buildKey(attendance.recordDate, attendance.staffId);
      const existing = await findByKey(key);
      const payload = toSpPayload(attendance, key, true);

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
      if (!isValidationError(error)) {
        return result.err(toResultError(error, op));
      }

      try {
        const sp = assertClient();
        const key = buildKey(attendance.recordDate, attendance.staffId);
        const existing = await findByKey(key);
        const payload = toSpPayload(attendance, key, false);

        if (existing && typeof existing.Id === 'number') {
          const { etag } = await sp.getItemByIdWithEtag(listTitle, existing.Id, defaultSelect);
          await sp.updateItemByTitle(listTitle, existing.Id, payload, { ifMatch: etag ?? '*' });
          return result.ok(undefined);
        }

        await sp.addListItemByTitle(listTitle, payload);
        return result.ok(undefined);
      } catch (fallbackError) {
        return result.err(toResultError(fallbackError, op));
      }
    }
  };

  return {
    async upsert(attendance: StaffAttendance): Promise<Result<void>> {
      return upsertWithFallback(attendance);
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
        const rows = await listByDateRows(date);
        const list = (rows ?? []).map(toAttendance).filter((v): v is StaffAttendance => Boolean(v));
        return result.ok(list);
      } catch (error) {
        return result.err(toResultError(error));
      }
    },

    async listByDateRange(from: string, to: string, top = 200): Promise<Result<StaffAttendance[]>> {
      try {
        // Safety cap: 10 pages × 200 items per page = 2000 items max
        const maxPages = 10;
        const rows = await listByDateRangeRows(from, to, top);
        
        if (rows.length >= top * maxPages) {
          return result.err({
            kind: 'validation',
            message: `Read list exceeded max items (${top * maxPages}). Please refine date range.`,
          });
        }
        
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

    async finalizeDay(params): Promise<Result<void>> {
      const listResult = await this.listByDate(params.recordDate);
      if (!listResult.isOk) return result.err(listResult.error);

      const records = listResult.value
        .slice()
        .sort((left, right) => left.staffId.localeCompare(right.staffId));
      if (records.length === 0) {
        return result.notFound('No attendance records found for this date');
      }

      const representativeStaffId = records[0]?.staffId;
      const settled = await Promise.allSettled(
        records.map((record) =>
          upsertWithFallback({
            ...record,
            isFinalized: record.staffId === representativeStaffId,
            finalizedAt: record.staffId === representativeStaffId ? new Date().toISOString() : undefined,
            finalizedBy: record.staffId === representativeStaffId ? (params.finalizedBy ?? 'unknown') : undefined,
          })
        )
      );

      const rejected = settled.find((entry) => entry.status === 'rejected');
      if (rejected && rejected.status === 'rejected') {
        return result.err(toResultError(rejected.reason));
      }
      const failed = settled
        .filter((entry): entry is PromiseFulfilledResult<Result<void>> => entry.status === 'fulfilled')
        .map((entry) => entry.value)
        .find((value) => !value.isOk);
      if (failed && !failed.isOk) {
        return result.err(failed.error);
      }

      return result.ok(undefined);
    },

    async unfinalizeDay(params): Promise<Result<void>> {
      const listResult = await this.listByDate(params.recordDate);
      if (!listResult.isOk) return result.err(listResult.error);

      const records = listResult.value;
      if (records.length === 0) {
        return result.notFound('No attendance records found for this date');
      }

      const finalized = records.filter((record) => record.isFinalized);
      if (finalized.length === 0) {
        return result.ok(undefined);
      }

      const settled = await Promise.allSettled(
        finalized.map((record) =>
          upsertWithFallback({
            ...record,
            isFinalized: false,
            finalizedAt: undefined,
            finalizedBy: undefined,
          })
        )
      );

      const rejected = settled.find((entry) => entry.status === 'rejected');
      if (rejected && rejected.status === 'rejected') {
        return result.err(toResultError(rejected.reason));
      }
      const failed = settled
        .filter((entry): entry is PromiseFulfilledResult<Result<void>> => entry.status === 'fulfilled')
        .map((entry) => entry.value)
        .find((value) => !value.isOk);
      if (failed && !failed.isOk) {
        return result.err(failed.error);
      }

      return result.ok(undefined);
    },

    async getDayFinalizedState(params): Promise<Result<boolean>> {
      const listResult = await this.listByDate(params.recordDate);
      if (!listResult.isOk) return result.err(listResult.error);
      return result.ok(listResult.value.some((record) => record.isFinalized === true));
    },
  };
};

export const sharePointStaffAttendanceAdapter = createSharePointStaffAttendanceAdapter();
