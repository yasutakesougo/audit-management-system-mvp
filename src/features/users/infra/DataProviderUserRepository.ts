import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  sanitizeEnvValue
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import {
  FIELD_MAP,
  USERS_MASTER_FIELD_MAP,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';
import { readEnv } from '@/lib/env';

import { normalizeAttendanceDays } from '../attendance';
import { canEditUser, resolveUserLifecycleStatus, toDomainUser } from '../domain/userLifecycle';
import type {
  UserRepository,
  UserRepositoryGetParams,
  UserRepositoryListParams,
  UserRepositoryUpdateDto,
} from '../domain/UserRepository';
import { userMasterCreateSchema } from '../schema';
import { USAGE_STATUS_VALUES } from '../typesExtended';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const MAX_WRITE_RETRY = 8;
const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

/**
 * DataProviderUserRepository
 * 
 * IDataProvider ベースの UserRepository 実装。
 * Users_Master の巨大なカラム数（300+）とリスト分割（Split Write / Lazy Join）を管理しつつ、
 * Dynamic Schema Resolution によって 400 Bad Request (Missing Column) を防ぐ。
 */
export class DataProviderUserRepository implements UserRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly audit?: (log: any) => void;
  private readonly defaultTop: number = 200;

  private resolvedFields: Record<string, string | undefined> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fieldStatus: any = null;
  private unsupportedWriteFields = new Set<string>();

  private readonly transportListTitle: string;
  private readonly benefitListTitle: string;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audit?: (log: any) => void;
    defaultTop?: number;
  }) {
    this.provider = options.provider;
    this.listTitle = options.listTitle || (sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) || DEFAULT_USERS_LIST_TITLE);
    this.audit = options.audit;
    this.defaultTop = options.defaultTop ?? 200;
    
    this.transportListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_TRANSPORT', '')) || 'UserTransport_Settings';
    this.benefitListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT', '')) || 'UserBenefit_Profile';
  }

  /**
   * フィールド解決（Dynamic Schema Resolution）
   * 400 Bad Request を防ぐための最重要ガードレール
   */
  private async resolveFields(): Promise<Record<string, string | undefined> | null> {
    if (this.resolvedFields) return this.resolvedFields;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      
      // USERS_MASTER_FIELD_MAP (flat string map) -> candidates (string[] map) に変換
      const candidates = Object.fromEntries(
        Object.entries(USERS_MASTER_FIELD_MAP).map(([key, value]) => {
          if (key === 'userId') return [key, ['UserID', 'cr013_usercode', 'Title']];
          if (key === 'fullName') return [key, ['FullName', 'cr013_fullname', 'Title']];
          return [key, [value]];
        })
      ) as Record<keyof typeof USERS_MASTER_FIELD_MAP, string[]>;

      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        candidates
      );

      // 必須フィールド判定（極限まで緩和: id さえあれば ok とする）
      const essentials: (keyof typeof USERS_MASTER_FIELD_MAP)[] = ['id'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isHealthy = areEssentialFieldsResolved(resolved, essentials as any);

      reportResourceResolution({
        resourceName: 'Users_Master',
        resolvedTitle: this.listTitle,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fieldStatus: fieldStatus as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        essentials: essentials as any,
      });

      if (isHealthy) {
        this.resolvedFields = resolved as Record<string, string | undefined>;
        this.fieldStatus = fieldStatus;
        return this.resolvedFields;
      }

      auditLog.warn('users', 'Essential fields missing for Users_Master.', { 
        list: this.listTitle, 
        resolved 
      });
      return null;
    } catch (err) {
      auditLog.error('users', 'Field resolution failed:', err);
      return null;
    }
  }

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) return [];

    const top = params?.top ?? this.defaultTop;
    const requestedMode = params?.selectMode ?? 'detail';
    
    const fields = await this.resolveFields();
    if (!fields) return [];

    // OData $select に含めるフィールドを、実際に存在する列のみに絞り込む
    const selectFields = [
      'Id', 'Title', 'Modified', 'Created',
      ...Object.values(fields).filter((f): f is string => !!f)
    ].filter((v, i, a) => a.indexOf(v) === i);

    const filterParts: string[] = [];
    if (params?.filters?.isActive !== undefined && fields.isActive) {
      filterParts.push(`${fields.isActive} eq ${params.filters.isActive ? 1 : 0}`);
    }

    try {
      const items = await this.provider.listItems<UserRow>(this.listTitle, {
        select: selectFields,
        filter: filterParts.join(' and ') || undefined,
        top: top > 0 ? top : undefined,
      });

      let domainItems = items.map(item => this.toDomain(item, requestedMode));

      // ── 分離先リストからの Join ──
      if (requestedMode === 'detail' || requestedMode === 'full') {
        try {
          const [transportRows, benefitRows] = await Promise.all([
            this.provider.listItems<Record<string, unknown>>(this.transportListTitle).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitListTitle).catch(() => [])
          ]);

          const transportMap = new Map(transportRows.map(r => [String(r.UserID || ''), r]));
          const benefitMap = new Map(benefitRows.map(r => [String(r.UserID || ''), r]));

          domainItems = domainItems.map(user => {
            const tRow = transportMap.get(user.UserID);
            const bRow = benefitMap.get(user.UserID);
            if (!tRow && !bRow) return user;
            return this.mergeExtraData(user, tRow, bRow);
          });
        } catch (je) {
          auditLog.warn('users', 'DataProviderUserRepository.lazy_join_failed', { error: String(je) });
        }
      }

      if (params?.filters?.keyword) {
        const keyword = params.filters.keyword.trim().toLowerCase();
        if (keyword) {
          domainItems = domainItems.filter((row) => this.matchesKeyword(row, keyword));
        }
      }

      return domainItems;
    } catch (e) {
      auditLog.error('users', 'DataProviderUserRepository.getAll_failed', { error: String(e) });
      return [];
    }
  }

  public async getById(id: number | string, options?: UserRepositoryGetParams): Promise<IUserMaster | null> {
    const numericId = Number(id);
    const requestedMode = options?.selectMode ?? 'detail';

    const fields = await this.resolveFields();
    if (!fields) return null;

    const selectFields = [
      'Id', 'Title', 'Modified', 'Created',
      ...Object.values(fields).filter((f): f is string => !!f)
    ].filter((v, i, a) => a.indexOf(v) === i);

    try {
      const row = await this.provider.getItemById<UserRow>(this.listTitle, numericId, {
        select: selectFields,
        signal: options?.signal,
      });

      const domain = this.toDomain(row, requestedMode);

      if (requestedMode === 'detail' || requestedMode === 'full') {
        try {
          const filter = `UserID eq '${domain.UserID}'`;
          const [tRows, bRows] = await Promise.all([
            this.provider.listItems<Record<string, unknown>>(this.transportListTitle, { filter, top: 1 }).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitListTitle, { filter, top: 1 }).catch(() => [])
          ]);
          return this.mergeExtraData(domain, tRows[0], bRows[0]);
        } catch (je) {
          auditLog.warn('users', 'DataProviderUserRepository.getById_join_failed', { error: String(je) });
        }
      }

      return domain;
    } catch (e) {
      auditLog.error('users', 'DataProviderUserRepository.getById_failed', { id, error: String(e) });
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    userMasterCreateSchema.parse(payload);
    
    // Core リストへの書き込み
    const created = await this.writeToMainList(this.listTitle, payload, 'create');
    const domain = this.toDomain(created, 'full');

    // 分離先リストへの書き込み (非同期・非ブロッキングでも可能だが、整合性のために待機)
    await Promise.all([
      this.syncAccessoryList(this.transportListTitle, domain.UserID, payload),
      this.syncAccessoryList(this.benefitListTitle, domain.UserID, payload)
    ]);

    this.audit?.({
      actor: 'user',
      entity: 'Users_Master_Split',
      action: 'create',
      entity_id: String(domain.Id),
      channel: 'UI',
      after: { item: domain },
    });

    return domain;
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    const numericId = Number(id);
    const existing = await this.getById(numericId);
    if (!existing) throw new Error('Not found');
    if (!canEditUser(existing)) throw new Error('Cannot edit terminated user');

    // Core リストへの書き込み
    await this.writeToMainList(this.listTitle, payload, 'update', numericId);

    // 分離先リストへの同期 (UserID 紐付け)
    await Promise.all([
      this.syncAccessoryList(this.transportListTitle, existing.UserID, payload),
      this.syncAccessoryList(this.benefitListTitle, existing.UserID, payload)
    ]);

    const updated = await this.getById(numericId);
    if (!updated) throw new Error('Failed to reload after update');

    this.audit?.({
      actor: 'user',
      entity: 'Users_Master_Split',
      action: 'update',
      entity_id: String(numericId),
      channel: 'UI',
      after: { patch: payload },
    });

    return updated;
  }

  /** メインリストへの書き込み（リトライロジック付き） */
  private async writeToMainList(listTitle: string, payload: Partial<IUserMasterCreateDto>, op: 'create' | 'update', id?: number): Promise<UserRow> {
    let request = this.toRequest(payload);
    request = this.filterUnsupportedFields(request);

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt++) {
      try {
        if (op === 'create') {
          return await this.provider.createItem<UserRow>(listTitle, request);
        } else {
          return await this.provider.updateItem<UserRow>(listTitle, id!, request);
        }
      } catch (error) {
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) throw error;
        
        this.unsupportedWriteFields.add(retryField);
        request = { ...request };
        delete request[retryField];
        auditLog.warn('users', `DataProviderUserRepository.${op}_retry`, { field: retryField, attempt });
      }
    }
    throw new Error(`${op} failed after retries`);
  }

  /** 分離先リストへの同期（Upsert ロジック） */
  private async syncAccessoryList(listTitle: string, userId: string, payload: Partial<IUserMasterCreateDto>): Promise<void> {
    const request = this.toRequest(payload);
    
    // このリストに該当するフィールドがあるかチェック (UserID は必須で含める)
    const listFields = this.resolveListFields(listTitle);
    const filteredRequest: Record<string, unknown> = { UserID: userId };
    let hasData = false;
    for (const f of listFields) {
      if (f in request) {
        filteredRequest[f] = request[f];
        hasData = true;
      }
    }

    if (!hasData) return; // 更新対象フィールドがない場合はスキップ

    try {
      // UserID で既存レコードを検索
      const existing = await this.provider.listItems<Record<string, unknown>>(listTitle, {
        filter: `UserID eq '${userId}'`,
        top: 1
      });

      if (existing.length > 0) {
        await this.provider.updateItem(listTitle, Number(existing[0].Id), filteredRequest);
      } else {
        await this.provider.createItem(listTitle, filteredRequest);
      }
    } catch (e) {
      auditLog.warn('users', 'DataProviderUserRepository.sync_accessory_failed', { listTitle, userId, error: String(e) });
    }
  }

  private resolveListFields(listTitle: string): string[] {
    const fields = FIELD_MAP.Users_Master;
    if (listTitle === this.transportListTitle) {
      return [fields.transportToDays, fields.transportFromDays, fields.transportCourse, fields.transportSchedule, fields.transportAdditionType];
    }
    if (listTitle === this.benefitListTitle) {
      return [
        fields.recipientCertNumber, fields.recipientCertExpiry, fields.grantMunicipality, 
        fields.grantPeriodStart, fields.grantPeriodEnd, fields.disabilitySupportLevel, 
        fields.grantedDaysPerMonth, fields.userCopayLimit, fields.mealAddition, fields.copayPaymentMethod
      ];
    }
    return [];
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
    return normalized;
  }

  private mergeExtraData(domain: IUserMaster, transport?: Record<string, unknown>, benefit?: Record<string, unknown>): IUserMaster {
    const next = { ...domain };
    
    if (transport) {
      if (transport.TransportToDays !== undefined) next.TransportToDays = normalizeAttendanceDays(transport.TransportToDays);
      if (transport.TransportFromDays !== undefined) next.TransportFromDays = normalizeAttendanceDays(transport.TransportFromDays);
      if (transport.TransportCourse !== undefined) next.TransportCourse = transport.TransportCourse as string;
      if (transport.TransportSchedule !== undefined) next.TransportSchedule = transport.TransportSchedule as string;
      if (transport.TransportAdditionType !== undefined) next.TransportAdditionType = transport.TransportAdditionType as string;
    }

    if (benefit) {
      if (benefit.RecipientCertNumber !== undefined) next.RecipientCertNumber = benefit.RecipientCertNumber as string;
      if (benefit.RecipientCertExpiry !== undefined) next.RecipientCertExpiry = benefit.RecipientCertExpiry as string;
      if (benefit.GrantMunicipality !== undefined) next.GrantMunicipality = benefit.GrantMunicipality as string;
      if (benefit.GrantPeriodStart !== undefined) next.GrantPeriodStart = benefit.GrantPeriodStart as string;
      if (benefit.GrantPeriodEnd !== undefined) next.GrantPeriodEnd = benefit.GrantPeriodEnd as string;
      if (benefit.DisabilitySupportLevel !== undefined) next.DisabilitySupportLevel = benefit.DisabilitySupportLevel as string;
      if (benefit.GrantedDaysPerMonth !== undefined) next.GrantedDaysPerMonth = benefit.GrantedDaysPerMonth as string;
      if (benefit.UserCopayLimit !== undefined) next.UserCopayLimit = benefit.UserCopayLimit as string;
      if (benefit.MealAddition !== undefined) next.MealAddition = benefit.MealAddition as string;
      if (benefit.CopayPaymentMethod !== undefined) next.CopayPaymentMethod = benefit.CopayPaymentMethod as string;
    }

    return next;
  }
}
