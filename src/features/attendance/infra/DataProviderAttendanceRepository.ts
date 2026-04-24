import { toSafeError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import {
  ATTENDANCE_DAILY_CANDIDATES,
  ATTENDANCE_DAILY_ENSURE_FIELDS,
  ATTENDANCE_DAILY_ESSENTIALS,
  ATTENDANCE_DAILY_LIST_TITLE,
  ATTENDANCE_USERS_CANDIDATES,
  ATTENDANCE_USERS_ESSENTIALS,
  ATTENDANCE_USERS_LIST_TITLE,
  type AttendanceDailyCandidateKey,
  type AttendanceDailyFieldMapping,
  type AttendanceUsersCandidateKey,
  type AttendanceUsersFieldMapping,
} from '@/sharepoint/fields/attendanceFields';
import { NURSE_OBS_CANDIDATES } from '@/sharepoint/fields/nurseObservationFields';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { emitDriftRecord, type DriftResolutionType, type DriftType } from '@/features/diagnostics/drift/domain/driftLogic';
import { buildEq, buildSubstringOf, joinAnd, joinOr } from '@/sharepoint/query/builders';
import { NURSE_OBSERVATIONS_LIST_TITLE } from '@/sharepoint/fields/nurseObservationFields';
import type {
  AttendanceRepository,
  AttendanceRepositoryListParams,
  AttendanceRepositoryUpsertParams,
  ObservationTemperatureItem,
} from '../domain/AttendanceRepository';
import { normalizeAttendanceDays } from '../../users/attendance';
import type { AttendanceDailyItem } from './Legacy/attendanceDailyRepository';
import type { AttendanceUserItem } from './Legacy/attendanceUsersRepository';
import { parseTransportMethod } from '../transportMethod';
import {
  AttendanceSchemaResolver,
  type AttendanceResolvedSchema,
} from './modules/AttendanceSchemaResolver';

/**
 * DataProviderAttendanceRepository
 */
export class DataProviderAttendanceRepository implements AttendanceRepository {
  private readonly provider: IDataProvider;
  private readonly listTitleDaily: string;
  private readonly listTitleUsers: string;
  private readonly listTitleNurse: string;

  private readonly usersResolver: AttendanceSchemaResolver<AttendanceUsersCandidateKey>;
  private readonly dailyResolver: AttendanceSchemaResolver<AttendanceDailyCandidateKey>;

  private usersResolutionReported = false;
  private dailyResolutionReported = false;
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

    this.usersResolver = new AttendanceSchemaResolver<AttendanceUsersCandidateKey>({
      provider: this.provider,
      listTitle: this.listTitleUsers,
      listTitleFallbacks: ['Users_Master', 'AttendanceUsers', 'UsersMaster'],
      candidates: ATTENDANCE_USERS_CANDIDATES,
      essentials: ATTENDANCE_USERS_ESSENTIALS,
      logCategory: 'attendance:repo',
      schemaName: 'AttendanceUsers',
      onDrift: (listTitle, fieldName, resolutionType, driftType) => {
        emitDriftRecord(
          listTitle,
          fieldName,
          resolutionType as DriftResolutionType,
          driftType as DriftType,
        );
      },
    });

    this.dailyResolver = new AttendanceSchemaResolver<AttendanceDailyCandidateKey>({
      provider: this.provider,
      listTitle: this.listTitleDaily,
      listTitleFallbacks: ['AttendanceDaily', 'Daily_Attendance', 'SupportRecord_Daily'],
      candidates: ATTENDANCE_DAILY_CANDIDATES,
      essentials: ATTENDANCE_DAILY_ESSENTIALS,
      logCategory: 'attendance:repo',
      schemaName: 'AttendanceDaily',
      onDrift: (listTitle, fieldName, resolutionType, driftType) => {
        emitDriftRecord(
          listTitle,
          fieldName,
          resolutionType as DriftResolutionType,
          driftType as DriftType,
        );
      },
    });
  }

  private uf(mapping: AttendanceUsersFieldMapping, key: AttendanceUsersCandidateKey): string {
    return mapping[key] ?? ATTENDANCE_USERS_CANDIDATES[key][0];
  }

  private df(mapping: AttendanceDailyFieldMapping, key: AttendanceDailyCandidateKey): string {
    return mapping[key] ?? ATTENDANCE_DAILY_CANDIDATES[key][0];
  }

  /**
   * 有効な通所ユーザーマスタ取得
   */
  async getActiveUsers(date?: string, signal?: AbortSignal): Promise<AttendanceUserItem[]> {
    try {
      const schema = await this.resolveUsersSchema();
      if (!schema) return [];

      const isActiveResolved = !schema.missing.includes('isActive');
      const rows = await this.provider.listItems<Record<string, unknown>>(schema.listTitle, {
        select: [...schema.select],
        filter: isActiveResolved ? buildEq(this.uf(schema.mapping, 'isActive'), 1) : undefined,
        orderby: this.uf(schema.mapping, 'userCode'),
        signal,
      });

      const refDate = date || new Date().toISOString().split('T')[0];
      return rows
        .map((row) => this.toAttendanceUser(row, schema.mapping))
        .filter((user): user is AttendanceUserItem => {
          if (!user) return false;
          if (isActiveResolved && !user.IsActive) return false;
          if (user.UsageStatus && (user.UsageStatus.includes('終了') || user.UsageStatus.includes('退会'))) {
            return false;
          }
          if (user.ServiceEndDate && user.ServiceEndDate < refDate) return false;
          return true;
        });
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
      const schema = await this.resolveDailySchema();
      if (!schema) return [];

      const rows = await this.provider.listItems<Record<string, unknown>>(schema.listTitle, {
        select: [...schema.select],
        filter: buildEq(this.df(schema.mapping, 'recordDate'), params.recordDate),
        signal: params.signal,
      });

      return rows
        .map((row) => this.toAttendanceDaily(row, schema.mapping))
        .filter((item): item is AttendanceDailyItem => Boolean(item));
    } catch (err) {
      return this.handleError(err, '日次勤怠の取得に失敗しました。');
    }
  }

  /**
   * 勤怠日次レコード更新（Upsert）
   */
  async upsertDailyByKey(item: AttendanceDailyItem, params?: AttendanceRepositoryUpsertParams): Promise<void> {
    try {
      const schema = await this.ensureDailySchemaForWrite();
      const missingFields = new Set<AttendanceDailyCandidateKey>(schema.missing);

      const { UserCode, RecordDate } = item;
      const key = `${UserCode}_${RecordDate}`;

      const filter = joinOr([
        buildEq(this.df(schema.mapping, 'key'), key),
        `(${joinAnd([
          buildEq(this.df(schema.mapping, 'userCode'), UserCode),
          buildEq(this.df(schema.mapping, 'recordDate'), RecordDate),
        ])})`,
      ]);

      const existing = await this.provider.listItems<Record<string, unknown>>(schema.listTitle, {
        select: ['Id'],
        filter,
        top: 1,
        signal: params?.signal,
      });

      const payload: Record<string, unknown> = {};
      const assign = (
        field: AttendanceDailyCandidateKey,
        value: unknown,
        options?: { allowEmptyString?: boolean },
      ): void => {
        if (missingFields.has(field)) return;
        if (value === undefined) return;
        if (!options?.allowEmptyString && typeof value === 'string' && value.length === 0) return;
        payload[this.df(schema.mapping, field)] = value;
      };

      assign('key', key, { allowEmptyString: true });
      assign('userCode', UserCode, { allowEmptyString: true });
      assign('recordDate', RecordDate, { allowEmptyString: true });
      assign('status', item.Status, { allowEmptyString: true });

      assign('checkInAt', item.CheckInAt ?? undefined, { allowEmptyString: true });
      assign('checkOutAt', item.CheckOutAt ?? undefined, { allowEmptyString: true });
      assign('providedMinutes', item.ProvidedMinutes);
      assign('eveningNote', item.EveningNote);
      assign('isEarlyLeave', item.IsEarlyLeave);
      assign('staffInChargeId', item.StaffInChargeId);

      if (existing.length > 0 && typeof existing[0].Id === 'number') {
        const id = existing[0].Id;
        await this.provider.updateItem(schema.listTitle, String(id), payload, {
          etag: '*',
          signal: params?.signal,
        });
      } else {
        await this.provider.createItem(schema.listTitle, payload, { signal: params?.signal });
      }

      auditLog.info('attendance:repo', 'Daily record upserted', {
        list: schema.listTitle,
        UserCode,
        RecordDate,
      });
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

      return rows
        .map((row) => this.toObservationTemperature(row, fields))
        .filter((item): item is ObservationTemperatureItem => Boolean(item));
    } catch (err) {
      auditLog.error('attendance:repo', 'Failed to load nurse observations.', err);
      return [];
    }
  }

  private async resolveUsersSchema(): Promise<AttendanceResolvedSchema<AttendanceUsersCandidateKey> | null> {
    const schema = await this.usersResolver.resolve();
    if (!schema) return null;

    if (!this.usersResolutionReported) {
      reportResourceResolution({
        resourceName: `Attendance:${schema.listTitle}`,
        resolvedTitle: schema.listTitle,
        fieldStatus: schema.fieldStatus as Record<string, { resolvedName?: string; candidates: string[]; isSilent: boolean }>,
        essentials: [...ATTENDANCE_USERS_ESSENTIALS],
        lifecycle: 'required',
      });
      this.usersResolutionReported = true;
    }
    return schema;
  }

  private async resolveDailySchema(): Promise<AttendanceResolvedSchema<AttendanceDailyCandidateKey> | null> {
    const schema = await this.dailyResolver.resolve();
    if (!schema) return null;

    if (!this.dailyResolutionReported) {
      reportResourceResolution({
        resourceName: `Attendance:${schema.listTitle}`,
        resolvedTitle: schema.listTitle,
        fieldStatus: schema.fieldStatus as Record<string, { resolvedName?: string; candidates: string[]; isSilent: boolean }>,
        essentials: [...ATTENDANCE_DAILY_ESSENTIALS],
        lifecycle: 'required',
      });
      this.dailyResolutionReported = true;
    }
    return schema;
  }

  private async ensureDailySchemaForWrite(): Promise<AttendanceResolvedSchema<AttendanceDailyCandidateKey>> {
    const resolved = await this.resolveDailySchema();
    if (resolved) return resolved;

    // Fail-open with self-healing: ensure list/fields and retry once.
    auditLog.warn(
      'attendance:repo',
      `Schema resolution failed for ${this.listTitleDaily}. Triggering self-healing...`,
    );
    type FieldsType = Parameters<IDataProvider['ensureListExists']>[1];
    await this.provider.ensureListExists(
      this.listTitleDaily,
      [...ATTENDANCE_DAILY_ENSURE_FIELDS] as unknown as FieldsType,
    );

    this.dailyResolver.reset();
    this.dailyResolutionReported = false;
    const healed = await this.resolveDailySchema();
    if (healed) return healed;

    throw new Error(`Cannot resolve fields for daily attendance: ${this.listTitleDaily}`);
  }

  private async resolveNurseFields(): Promise<Record<string, string | string[] | undefined> | null> {
    if (this.resolvedNurse) return this.resolvedNurse;

    const available = await this.provider.getFieldInternalNames(this.listTitleNurse).catch(() => null);
    if (!available) return null;

    const result = resolveInternalNamesDetailed(
      available,
      NURSE_OBS_CANDIDATES as unknown as Record<string, string[]>,
      {
        onDrift: (fieldName, resolutionType, driftType) => {
          emitDriftRecord(
            this.listTitleNurse,
            fieldName,
            resolutionType as DriftResolutionType,
            driftType as DriftType,
          );
        },
      },
    );

    const userField = ['UserLookupId', 'UserLookup', 'UserId'].find((field) => available.has(field));
    const dateField = ['ObservedAt', 'ObsDate', 'RecordDate', 'Created'].find((field) => available.has(field));
    const tempField = ['Temperature', 'Temp', 'BodyTemperature'].find((field) => available.has(field));

    if (!userField || !dateField || !tempField) return null;

    const resolved = result.resolved as Record<string, string | string[] | undefined>;
    resolved.userField = userField;
    resolved.dateField = dateField;
    resolved.tempField = tempField;
    resolved.select = ['Id', userField, dateField, tempField];

    this.resolvedNurse = resolved;
    return resolved;
  }

  private toAttendanceUser(
    row: Record<string, unknown>,
    mapping: AttendanceUsersFieldMapping,
  ): AttendanceUserItem | null {
    const userCode = String(row[this.uf(mapping, 'userCode')] ?? '');
    const title = String(row[this.uf(mapping, 'title')] ?? '');
    if (!userCode || !title) return null;

    return {
      Id: Number(row.Id),
      Title: title,
      UserCode: userCode,
      IsTransportTarget: Boolean(row[this.uf(mapping, 'isTransportTarget')]),
      StandardMinutes: Number(row[this.uf(mapping, 'standardMinutes')] ?? 0),
      IsActive: Boolean(row[this.uf(mapping, 'isActive')] ?? true),
      ServiceEndDate:
        (row[this.uf(mapping, 'serviceEndDate')] as string | undefined) ?? undefined,
      UsageStatus:
        (row[this.uf(mapping, 'usageStatus')] as string | undefined) ?? '利用中',
      AttendanceDays: normalizeAttendanceDays(row[this.uf(mapping, 'attendanceDays')]),
      DefaultTransportToMethod: parseTransportMethod(row[this.uf(mapping, 'defaultTransportToMethod')]),
      DefaultTransportFromMethod: parseTransportMethod(
        row[this.uf(mapping, 'defaultTransportFromMethod')],
      ),
      DefaultTransportToNote:
        (row[this.uf(mapping, 'defaultTransportToNote')] as string | undefined) ?? undefined,
      DefaultTransportFromNote:
        (row[this.uf(mapping, 'defaultTransportFromNote')] as string | undefined) ?? undefined,
    };
  }

  private toAttendanceDaily(
    row: Record<string, unknown>,
    mapping: AttendanceDailyFieldMapping,
  ): AttendanceDailyItem | null {
    const userCode = String(row[this.df(mapping, 'userCode')] ?? '');
    const recordDate = String(row[this.df(mapping, 'recordDate')] ?? '');
    if (!userCode || !recordDate) return null;

    return {
      Id: Number(row.Id),
      Key: String(row[this.df(mapping, 'key')] ?? ''),
      UserCode: userCode,
      RecordDate: recordDate,
      Status: String(row[this.df(mapping, 'status')] ?? ''),
      CheckInAt: row[this.df(mapping, 'checkInAt')] as string | null,
      CheckOutAt: row[this.df(mapping, 'checkOutAt')] as string | null,
      ProvidedMinutes:
        typeof row[this.df(mapping, 'providedMinutes')] === 'number'
          ? (row[this.df(mapping, 'providedMinutes')] as number)
          : null,
      IsEarlyLeave: Boolean(row[this.df(mapping, 'isEarlyLeave')]),
      EveningNote: String(row[this.df(mapping, 'eveningNote')] ?? ''),
      StaffInChargeId: String(row[this.df(mapping, 'staffInChargeId')] ?? ''),
    };
  }

  private toObservationTemperature(
    row: Record<string, unknown>,
    fields: Record<string, string | string[] | undefined>,
  ): ObservationTemperatureItem | null {
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
