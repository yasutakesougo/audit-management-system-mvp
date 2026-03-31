import { toSafeError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { 
  ATTENDANCE_DAILY_CANDIDATES, 
// Removed unused ATTENDANCE_DAILY_ENSURE_FIELDS
} from '@/sharepoint/fields/attendanceFields';
import { 
  NURSE_OBS_CANDIDATES
} from '@/sharepoint/fields/nurseObservationFields';
import {
    ATTENDANCE_USERS_FIELDS,
    ATTENDANCE_USERS_LIST_TITLE,
    ATTENDANCE_USERS_SELECT_FIELDS,
} from '@/sharepoint/fields/attendanceFields';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved 
} from '@/lib/sp/helpers';
import { buildEq, buildSubstringOf, joinAnd, joinOr } from '@/sharepoint/query/builders';

import { 
  ATTENDANCE_DAILY_LIST_TITLE,
} from '@/sharepoint/fields/attendanceFields';
import {
  NURSE_OBSERVATIONS_LIST_TITLE,
} from '@/sharepoint/fields/nurseObservationFields';
import type { 
  AttendanceRepository, 
  AttendanceRepositoryListParams,
  AttendanceRepositoryUpsertParams,
  ObservationTemperatureItem
} from '../domain/AttendanceRepository';
import type { AttendanceDailyItem } from './Legacy/attendanceDailyRepository';
import type { AttendanceUserItem } from './Legacy/attendanceUsersRepository';
import { parseTransportMethod } from '../transportMethod';

/**
 * DataProviderAttendanceRepository
 */
export class DataProviderAttendanceRepository implements AttendanceRepository {
  private readonly provider: IDataProvider;
  private readonly listTitleDaily: string;
  private readonly listTitleUsers: string;
  private readonly listTitleNurse: string;

  private resolvedDaily: Record<string, string | string[] | undefined> | null = null;
  private resolvedNurse: Record<string, string | string[] | undefined> | null = null;


  constructor(options: {
    provider: IDataProvider;
    listTitleDaily?: string;
    listTitleUsers?: string;
    listTitleNurse?: string;
  }) {
    this.provider = options.provider;
    this.listTitleDaily = options.listTitleDaily ?? ATTENDANCE_DAILY_LIST_TITLE;
    this.listTitleUsers = options.listTitleUsers ?? ATTENDANCE_USERS_LIST_TITLE;
    this.listTitleNurse = options.listTitleNurse ?? NURSE_OBSERVATIONS_LIST_TITLE;
  }

  /**
   * 有効な通所ユーザーマスタ取得
   */
  async getActiveUsers(signal?: AbortSignal): Promise<AttendanceUserItem[]> {
    try {
      const rows = await this.provider.listItems<Record<string, unknown>>(this.listTitleUsers, {
        select: ATTENDANCE_USERS_SELECT_FIELDS as unknown as string[],
        filter: buildEq(ATTENDANCE_USERS_FIELDS.isActive as string, true),
        orderby: ATTENDANCE_USERS_FIELDS.userCode as string,
        signal
      });

      return rows.map(r => this.toAttendanceUser(r)).filter((u): u is AttendanceUserItem => !!u);
    } catch (err) {
      auditLog.warn('attendance:repo', 'Failed to load active users. Returning empty.', err);
      return [];
    }
  }

  /**
   * 勤怠日次レコード取得
   */
  async getDailyByDate(params: AttendanceRepositoryListParams): Promise<AttendanceDailyItem[]> {
    try {
      const fields = await this.resolveDailyFields();
      if (!fields) return [];

      const rows = await this.provider.listItems<Record<string, unknown>>(this.listTitleDaily, {
        select: fields.select as string[],
        filter: buildEq(fields.recordDate as string, params.recordDate),

        signal: params.signal
      });

      return rows.map(r => this.toAttendanceDaily(r, fields)).filter((i): i is AttendanceDailyItem => !!i);
    } catch (err) {
      return this.handleError(err, '日次勤怠の取得に失敗しました。');
    }
  }

  /**
   * 勤怠日次レコード更新（Upsert）
   */
  async upsertDailyByKey(item: AttendanceDailyItem, params?: AttendanceRepositoryUpsertParams): Promise<void> {
    try {
      const fields = await this.resolveDailyFields();
      if (!fields) throw new Error('Cannot resolve fields for daily attendance');

      const { UserCode, RecordDate } = item;
      const key = `${UserCode}_${RecordDate}`;

      const filter = joinOr([
        buildEq(fields.key as string, key),
        `(${joinAnd([
          buildEq(fields.userCode as string, UserCode),
          buildEq(fields.recordDate as string, RecordDate),
        ])})`,
      ]);

      const existing = await this.provider.listItems<Record<string, unknown>>(this.listTitleDaily, {
        select: ['Id'],
        filter,
        top: 1,
        signal: params?.signal
      });

      const payload: Record<string, unknown> = {
        [fields.key as string]: key,
        [fields.userCode as string]: UserCode,
        [fields.recordDate as string]: RecordDate,
        [fields.status as string]: item.Status,
      };

      if (fields.checkInAt && item.CheckInAt) payload[fields.checkInAt as string] = item.CheckInAt;
      if (fields.checkOutAt && item.CheckOutAt) payload[fields.checkOutAt as string] = item.CheckOutAt;
      if (fields.providedMinutes && item.ProvidedMinutes !== undefined) payload[fields.providedMinutes as string] = item.ProvidedMinutes;
      if (fields.eveningNote && item.EveningNote) payload[fields.eveningNote as string] = item.EveningNote;
      if (fields.isEarlyLeave && item.IsEarlyLeave !== undefined) payload[fields.isEarlyLeave as string] = item.IsEarlyLeave;
      if (fields.staffInChargeId && item.StaffInChargeId) payload[fields.staffInChargeId as string] = item.StaffInChargeId;


      if (existing.length > 0 && typeof existing[0].Id === 'number') {
        const id = existing[0].Id;
        await this.provider.updateItem(this.listTitleDaily, String(id), payload, { etag: '*', signal: params?.signal });
      } else {
        await this.provider.createItem(this.listTitleDaily, payload, { signal: params?.signal });
      }

      auditLog.info('attendance:repo', 'Daily record upserted', { UserCode, RecordDate });
    } catch (err) {
      return this.handleError(err, '勤怠記録の保存に失敗しました。');
    }
  }

  /**
    * 看護師所見取得
    */
  async getObservationsByDate(recordDate: string): Promise<ObservationTemperatureItem[]> {
    try {
      const fields = await this.resolveNurseFields();
      if (!fields) return [];

      const rows = await this.provider.listItems<Record<string, unknown>>(this.listTitleNurse, {
        select: fields.select as string[],
        filter: buildSubstringOf(fields.dateField as string, recordDate),

      });

      return rows.map(r => this.toObservationTemperature(r, fields)).filter((i): i is ObservationTemperatureItem => !!i);
    } catch (err) {
      auditLog.error('attendance:repo', 'Failed to load nurse observations.', err);
      return [];
    }
  }

  private async resolveDailyFields(): Promise<Record<string, string | string[] | undefined> | null> {
    if (this.resolvedDaily) return this.resolvedDaily;
    const available = await this.provider.getFieldInternalNames(this.listTitleDaily).catch(() => null);
    if (!available) return null;
    const result = resolveInternalNamesDetailed(available, ATTENDANCE_DAILY_CANDIDATES as unknown as Record<string, string[]>);
    if (!areEssentialFieldsResolved(result.resolved as Record<string, string | undefined>, ['key', 'userCode', 'recordDate', 'status'])) {
      return null;
    }
    const resolved = result.resolved as Record<string, string | string[] | undefined>;
    resolved.select = ['Id', ...Object.values(resolved).filter((v): v is string => typeof v === 'string')];
    this.resolvedDaily = resolved;
    return resolved;

  }

  private async resolveNurseFields(): Promise<Record<string, string | string[] | undefined> | null> {
    if (this.resolvedNurse) return this.resolvedNurse;
    const available = await this.provider.getFieldInternalNames(this.listTitleNurse).catch(() => null);
    if (!available) return null;
    const result = resolveInternalNamesDetailed(available, NURSE_OBS_CANDIDATES as unknown as Record<string, string[]>);
    
    const userField = ['UserLookupId', 'UserLookup', 'UserId'].find(f => available.has(f));
    const dateField = ['ObservedAt', 'ObsDate', 'RecordDate', 'Created'].find(f => available.has(f));
    const tempField = ['Temperature', 'Temp', 'BodyTemperature'].find(f => available.has(f));

    if (!userField || !dateField || !tempField) return null;
    
    const resolved = result.resolved as Record<string, string | string[] | undefined>;
    resolved.userField = userField;
    resolved.dateField = dateField;
    resolved.tempField = tempField;
    resolved.select = ['Id', userField, dateField, tempField];
    
    this.resolvedNurse = resolved;
    return resolved;
  }


  private toAttendanceUser(row: Record<string, unknown>): AttendanceUserItem | null {
    const userCode = String(row[ATTENDANCE_USERS_FIELDS.userCode as string] || '');
    const title = String(row[ATTENDANCE_USERS_FIELDS.title as string] || '');
    if (!userCode || !title) return null;

    return {
      Id: Number(row.Id),
      Title: title,
      UserCode: userCode,
      IsTransportTarget: Boolean(row[ATTENDANCE_USERS_FIELDS.isTransportTarget as string]),
      StandardMinutes: Number(row[ATTENDANCE_USERS_FIELDS.standardMinutes as string] || 0),
      IsActive: Boolean(row[ATTENDANCE_USERS_FIELDS.isActive as string]),
      DefaultTransportToMethod: parseTransportMethod(row[ATTENDANCE_USERS_FIELDS.defaultTransportToMethod as string]),
      DefaultTransportFromMethod: parseTransportMethod(row[ATTENDANCE_USERS_FIELDS.defaultTransportFromMethod as string]),
      DefaultTransportToNote: row[ATTENDANCE_USERS_FIELDS.defaultTransportToNote as string] as string | undefined,
      DefaultTransportFromNote: row[ATTENDANCE_USERS_FIELDS.defaultTransportFromNote as string] as string | undefined,
    };
  }

  private toAttendanceDaily(row: Record<string, unknown>, fields: Record<string, string | string[] | undefined>): AttendanceDailyItem | null {
    const userCode = String(row[fields.userCode as string] || '');
    const recordDate = String(row[fields.recordDate as string] || '');
    if (!userCode || !recordDate) return null;

    return {
      Id: Number(row.Id),
      Key: String(row[fields.key as string] || ''),
      UserCode: userCode,
      RecordDate: recordDate,
      Status: String(row[fields.status as string] || ''),
      CheckInAt: row[fields.checkInAt as string] as string | null,
      CheckOutAt: row[fields.checkOutAt as string] as string | null,
      ProvidedMinutes: typeof row[fields.providedMinutes as string] === 'number' ? (row[fields.providedMinutes as string] as number) : null,
      IsEarlyLeave: !!row[fields.isEarlyLeave as string],
      EveningNote: String(row[fields.eveningNote as string] || ''),
      StaffInChargeId: String(row[fields.staffInChargeId as string] || ''),
    };
  }

  private toObservationTemperature(row: Record<string, unknown>, fields: Record<string, string | string[] | undefined>): ObservationTemperatureItem | null {
    const uId = row[fields.userField as string];
    const temp = row[fields.tempField as string];
    const at = row[fields.dateField as string];

    const userLookupId = typeof uId === 'number' ? uId : parseInt(String(uId), 10);
    if (isNaN(userLookupId)) return null;

    return {
      userLookupId,
      temperature: typeof temp === 'number' ? temp : parseFloat(String(temp)),
      observedAt: String(at || ''),
    };
  }

  private handleError(err: unknown, userMessage: string): never {
    auditLog.error('attendance:repo', userMessage, err);
    throw toSafeError(err instanceof Error ? err : new Error(String(err)));
  }
}
