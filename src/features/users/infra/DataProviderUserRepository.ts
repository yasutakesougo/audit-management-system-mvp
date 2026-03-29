import type { AuditEvent } from '@/lib/audit';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { readEnv } from '@/lib/env';
import {
  DEFAULT_USERS_LIST_TITLE,
  sanitizeEnvValue,
} from '@/lib/sp/helpers';
import {
  FIELD_MAP,
  resolveUserSelectFields,
  USERS_SELECT_FIELDS_CORE,
  USERS_SELECT_FIELDS_MINIMAL,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';

import { normalizeAttendanceDays } from '../attendance';
import { canEditUser, resolveUserLifecycleStatus, toDomainUser } from '../domain/userLifecycle';
import type {
  UserRepository,
  UserRepositoryGetParams,
  UserRepositoryListParams,
  UserRepositoryUpdateDto,
} from '../domain/UserRepository';
import { userMasterCreateSchema, userMasterSchema } from '../schema';
import { USAGE_STATUS_VALUES } from '../typesExtended';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

const DEFAULT_TOP = 500;
const MAX_WRITE_RETRY = 8;
const TRANSPORT_SCHEDULE_FIELD = FIELD_MAP.Users_Master.transportSchedule;
const MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR =
  'Users_Master に TransportSchedule 列がないため、送迎手段を保存できません。管理者に列追加を依頼してください。';
const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export type DataProviderUserRepositoryOptions = {
  provider: IDataProvider;
  defaultTop?: number;
  audit?: (event: Omit<AuditEvent, 'ts'>) => void;
};

/**
 * DataProviderUserRepository
 * 
 * IDataProvider ベースの UserRepository 実装。
 * SharePoint / InMemory / Dataverse のバックエンド差異を隠蔽しつつ、
 * Users_Master 特有のフィールド不備リトライロジックを保持する。
 */
export class DataProviderUserRepository implements UserRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly defaultTop: number;
  private readonly audit?: (event: Omit<AuditEvent, 'ts'>) => void;

  private unsupportedWriteFields = new Set<string>();

  constructor(options: DataProviderUserRepositoryOptions) {
    this.provider = options.provider;
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.audit = options.audit;

    this.listTitle =
      sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) ||
      DEFAULT_USERS_LIST_TITLE;
  }

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) return [];

    const filters = params?.filters;
    const top = params?.top ?? this.defaultTop;
    const requestedMode = params?.selectMode ?? 'detail';
    
    // IDataProvider.listItems を使用
    const selectFields = [...resolveUserSelectFields(requestedMode)];
    const filterParts: string[] = [];
    if (filters?.isActive !== undefined) {
      filterParts.push(`${FIELD_MAP.Users_Master.isActive} eq ${filters.isActive ? 1 : 0}`);
    }

    try {
      const items = await this.provider.listItems<UserRow>(this.listTitle, {
        select: selectFields,
        filter: filterParts.join(' and ') || undefined,
        top: top > 0 ? top : undefined,
      });

      let domainItems = items.map(item => this.toDomain(item, requestedMode));

      if (filters?.keyword) {
        const keyword = filters.keyword.trim().toLowerCase();
        if (keyword) {
          domainItems = domainItems.filter((row) => this.matchesKeyword(row, keyword));
        }
      }

      return domainItems;
    } catch (e) {
      // Fallback 1: CORE (基本的な20列) でリトライ
      auditLog.warn('users', 'DataProviderUserRepository.getAll_fallback_core', { error: String(e) });
      try {
        const fallbackItems = await this.provider.listItems<UserRow>(this.listTitle, {
          select: USERS_SELECT_FIELDS_CORE as unknown as string[],
          filter: filterParts.join(' and ') || undefined,
          top: top > 0 ? top : undefined,
        });
        let domainItems = fallbackItems.map(item => this.toDomain(item, 'core'));
        if (filters?.keyword) {
          const keyword = filters.keyword.trim().toLowerCase();
          if (keyword) {
            domainItems = domainItems.filter((row) => this.matchesKeyword(row, keyword));
          }
        }
        return domainItems;
      } catch (e2) {
        // Fallback 2: MINIMAL (絶対にある Id, Title, FullName) でリトライ
        auditLog.error('users', 'DataProviderUserRepository.getAll_fallback_minimal', { error: String(e2) });
        const minimalItems = await this.provider.listItems<UserRow>(this.listTitle, {
          select: USERS_SELECT_FIELDS_MINIMAL as unknown as string[],
          filter: filterParts.join(' and ') || undefined,
          top: top > 0 ? top : undefined,
        });
        let domainItems = minimalItems.map(item => this.toDomain(item, 'minimal'));
        if (filters?.keyword) {
          const keyword = filters.keyword.trim().toLowerCase();
          if (keyword) {
            domainItems = domainItems.filter((row) => this.matchesKeyword(row, keyword));
          }
        }
        return domainItems;
      }
    }
  }

  public async getById(id: number | string, params?: UserRepositoryGetParams): Promise<IUserMaster | null> {
    if (params?.signal?.aborted) return null;

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) throw new Error(`Invalid id: ${id}`);

    const requestedMode = params?.selectMode ?? 'detail';
    const selectFields = [...resolveUserSelectFields(requestedMode)];

    try {
      // IDataProvider.getItem は現在無いので、listItems を $filter=Id eq ... で代用するか、provider にメソッド追加が必要
      // DataProvider.interface には getItem は無いが、将来的に追加されるべき。
      // 現在の実装状況では listItems を使う。
      const items = await this.provider.listItems<UserRow>(this.listTitle, {
        select: selectFields,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      if (!items.length) return null;
      return this.toDomain(items[0], requestedMode);
    } catch (e) {
      auditLog.warn('users', 'DataProviderUserRepository.getById_fallback', { id, error: String(e) });
      const items = await this.provider.listItems<UserRow>(this.listTitle, {
        filter: `Id eq ${numericId}`,
        top: 1,
      });
      if (!items.length) return null;
      return this.toDomain(items[0], 'core');
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    userMasterCreateSchema.parse(payload);
    const requiresTransportSchedule = payload.TransportSchedule !== undefined;
    let request = this.toRequest(payload);
    request = this.filterUnsupportedFields(request);

    if (requiresTransportSchedule && !(TRANSPORT_SCHEDULE_FIELD in request)) {
      throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
    }

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt++) {
      try {
        const created = await this.provider.createItem<UserRow>(this.listTitle, request);
        const domain = this.toDomain(created, 'full');

        this.audit?.({
          actor: 'user',
          entity: 'Users_Master',
          action: 'create',
          entity_id: String(domain.Id),
          channel: 'UI',
          after: { item: domain },
        });

        return domain;
      } catch (error) {
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) throw error;

        if (retryField === TRANSPORT_SCHEDULE_FIELD) {
          throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
        }

        this.unsupportedWriteFields.add(retryField);
        request = { ...request };
        delete request[retryField];

        auditLog.warn('users', 'DataProviderUserRepository.create_retry', { field: retryField, attempt });
      }
    }
    throw new Error('Create failed after retries');
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    const numericId = Number(id);
    const existing = await this.getById(numericId);
    if (!existing) throw new Error('Not found');
    if (!canEditUser(existing)) throw new Error('Cannot edit terminated user');

    const requiresTransportSchedule = payload.TransportSchedule !== undefined;
    let request = this.toRequest(payload);
    request = this.filterUnsupportedFields(request);

    if (requiresTransportSchedule && !(TRANSPORT_SCHEDULE_FIELD in request)) {
      throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
    }

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt++) {
      try {
        await this.provider.updateItem(this.listTitle, numericId, request);
        const updated = await this.getById(numericId);
        if (!updated) throw new Error('Failed to reload after update');

        this.audit?.({
          actor: 'user',
          entity: 'Users_Master',
          action: 'update',
          entity_id: String(numericId),
          channel: 'UI',
          after: { patch: payload },
        });

        return updated;
      } catch (error) {
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) throw error;

        if (retryField === TRANSPORT_SCHEDULE_FIELD) {
          throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
        }

        this.unsupportedWriteFields.add(retryField);
        request = { ...request };
        delete request[retryField];

        auditLog.warn('users', 'DataProviderUserRepository.update_retry', { id: numericId, field: retryField, attempt });
      }
    }
    throw new Error('Update failed after retries');
  }

  public async terminate(id: number | string): Promise<IUserMaster> {
    const numericId = Number(id);
    const current = await this.getById(numericId);
    if (!current) throw new Error('Not found');
    if (resolveUserLifecycleStatus(current) === 'terminated') return current;

    return this.update(numericId, {
      UsageStatus: USAGE_STATUS_VALUES.TERMINATED,
      ServiceEndDate: current.ServiceEndDate ?? getTodayIsoDate(),
      IsActive: false,
    });
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = Number(id);
    await this.provider.deleteItem(this.listTitle, numericId);
    this.audit?.({
      actor: 'user',
      entity: 'Users_Master',
      action: 'delete',
      entity_id: String(numericId),
      channel: 'UI',
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  private matchesKeyword(row: IUserMaster, keyword: string): boolean {
    const candidates = [row.FullName, row.FullNameKana, row.Furigana, row.UserID]
      .filter(Boolean)
      .map((value) => (value as string).toLowerCase());
    return candidates.some((value) => value.includes(keyword));
  }

  private filterUnsupportedFields(request: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request)) {
      if (!this.unsupportedWriteFields.has(key)) {
        next[key] = value;
      }
    }
    return next;
  }

  private resolveRetryField(error: unknown, request: Record<string, unknown>): string | null {
    const msg = String((error as Error)?.message || '').toLowerCase();
    if (!msg.includes('field') && !msg.includes('column') && !msg.includes('property')) return null;
    
    // Extract 'InternalName' from error message (standard SharePoint error pattern)
    const match = msg.match(/'([^']+)'/);
    const field = match?.[1]?.trim();
    if (field && field in request) return field;
    return null;
  }

  private toRequest(dto: Partial<IUserMasterCreateDto>): Record<string, unknown> {
    const fields = FIELD_MAP.Users_Master;
    const req: Record<string, unknown> = {};

    if (dto.UserID !== undefined) req[fields.userId] = dto.UserID;
    if (dto.FullName !== undefined) req[fields.fullName] = dto.FullName;
    if (dto.Furigana !== undefined) req[fields.furigana] = dto.Furigana;
    if (dto.FullNameKana !== undefined) req[fields.fullNameKana] = dto.FullNameKana;
    if (dto.ContractDate !== undefined) req[fields.contractDate] = dto.ContractDate;
    if (dto.ServiceStartDate !== undefined) req[fields.serviceStartDate] = dto.ServiceStartDate;
    if (dto.ServiceEndDate !== undefined) req[fields.serviceEndDate] = dto.ServiceEndDate;
    if (dto.IsHighIntensitySupportTarget !== undefined) req[fields.isHighIntensitySupportTarget] = dto.IsHighIntensitySupportTarget;
    if (dto.IsSupportProcedureTarget !== undefined) req[fields.isSupportProcedureTarget] = dto.IsSupportProcedureTarget;
    if (dto.severeFlag !== undefined) req[fields.severeFlag] = dto.severeFlag;
    if (dto.IsActive !== undefined) req[fields.isActive] = dto.IsActive;
    if (dto.TransportToDays !== undefined) req[fields.transportToDays] = JSON.stringify(dto.TransportToDays);
    if (dto.TransportFromDays !== undefined) req[fields.transportFromDays] = JSON.stringify(dto.TransportFromDays);
    if (dto.TransportCourse !== undefined) req[fields.transportCourse] = dto.TransportCourse;
    if (dto.TransportSchedule !== undefined) req[fields.transportSchedule] = dto.TransportSchedule;
    if (dto.AttendanceDays !== undefined) req[fields.attendanceDays] = JSON.stringify(dto.AttendanceDays);
    if (dto.RecipientCertNumber !== undefined) req[fields.recipientCertNumber] = dto.RecipientCertNumber;
    if (dto.RecipientCertExpiry !== undefined) req[fields.recipientCertExpiry] = dto.RecipientCertExpiry;
    
    // Billing fields
    if (dto.UsageStatus !== undefined) req[fields.usageStatus] = dto.UsageStatus;
    if (dto.GrantMunicipality !== undefined) req[fields.grantMunicipality] = dto.GrantMunicipality;
    if (dto.GrantPeriodStart !== undefined) req[fields.grantPeriodStart] = dto.GrantPeriodStart;
    if (dto.GrantPeriodEnd !== undefined) req[fields.grantPeriodEnd] = dto.GrantPeriodEnd;
    if (dto.DisabilitySupportLevel !== undefined) req[fields.disabilitySupportLevel] = dto.DisabilitySupportLevel;
    if (dto.GrantedDaysPerMonth !== undefined) req[fields.grantedDaysPerMonth] = dto.GrantedDaysPerMonth;
    if (dto.UserCopayLimit !== undefined) req[fields.userCopayLimit] = dto.UserCopayLimit;
    if (dto.TransportAdditionType !== undefined) req[fields.transportAdditionType] = dto.TransportAdditionType;
    if (dto.MealAddition !== undefined) req[fields.mealAddition] = dto.MealAddition;
    if (dto.CopayPaymentMethod !== undefined) req[fields.copayPaymentMethod] = dto.CopayPaymentMethod;

    return req;
  }

  private toDomain(raw: UserRow, effectiveMode: UserSelectMode): IUserMaster {
    const fields = FIELD_MAP.Users_Master;
    const record = raw as Record<string, unknown>;
    const get = <T = unknown>(field: string): T | undefined => record[field] as T | undefined;

    const attendance = normalizeAttendanceDays(get(fields.attendanceDays));
    const transportTo = normalizeAttendanceDays(get(fields.transportToDays));
    const transportFrom = normalizeAttendanceDays(get(fields.transportFromDays));

    const domain: IUserMaster = {
      Id: Number(get(fields.id) ?? raw.Id),
      Title: get(fields.title) ?? raw.Title ?? null,
      UserID: get(fields.userId) ?? raw.UserID ?? '',
      FullName: get(fields.fullName) ?? raw.FullName ?? '',
      Furigana: get(fields.furigana) ?? raw.Furigana ?? null,
      FullNameKana: get(fields.fullNameKana) ?? raw.FullNameKana ?? null,
      ContractDate: get(fields.contractDate) ?? raw.ContractDate ?? null,
      ServiceStartDate: get(fields.serviceStartDate) ?? raw.ServiceStartDate ?? null,
      ServiceEndDate: get(fields.serviceEndDate) ?? raw.ServiceEndDate ?? null,
      IsHighIntensitySupportTarget: get(fields.isHighIntensitySupportTarget) ?? null,
      IsSupportProcedureTarget: get(fields.isSupportProcedureTarget) ?? null,
      severeFlag: get(fields.severeFlag) ?? null,
      IsActive: get(fields.isActive) ?? raw.IsActive ?? null,
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      TransportCourse: get(fields.transportCourse) ?? null,
      TransportSchedule: get(fields.transportSchedule) ?? null,
      AttendanceDays: attendance,
      RecipientCertNumber: get(fields.recipientCertNumber) ?? raw.RecipientCertNumber ?? null,
      RecipientCertExpiry: get(fields.recipientCertExpiry) ?? raw.RecipientCertExpiry ?? null,
      Modified: get(fields.modified) ?? raw.Modified ?? null,
      Created: get(fields.created) ?? raw.Created ?? null,
      UsageStatus: get(fields.usageStatus) ?? null,
      GrantMunicipality: get(fields.grantMunicipality) ?? null,
      GrantPeriodStart: get(fields.grantPeriodStart) ?? null,
      GrantPeriodEnd: get(fields.grantPeriodEnd) ?? null,
      DisabilitySupportLevel: get(fields.disabilitySupportLevel) ?? null,
      GrantedDaysPerMonth: get(fields.grantedDaysPerMonth) ?? null,
      UserCopayLimit: get(fields.userCopayLimit) ?? null,
      TransportAdditionType: get(fields.transportAdditionType) ?? null,
      MealAddition: get(fields.mealAddition) ?? null,
      CopayPaymentMethod: get(fields.copayPaymentMethod) ?? null,
      __selectMode: effectiveMode,
    };

    const normalized = toDomainUser(domain);
    try {
      userMasterSchema.parse(normalized);
    } catch (error) {
      auditLog.warn('users', 'DataProviderUserRepository.validation_failed', { id: normalized.Id, error: String(error) });
    }
    return normalized;
  }
}
