import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  sanitizeEnvValue,
  washRow,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import {
  FIELD_MAP,
  USERS_MASTER_CORE_FIELD_MAP,
  USERS_MASTER_COMPLIANCE_FIELD_MAP,
  USERS_MASTER_CANDIDATES,
  USER_TRANSPORT_SETTINGS_CANDIDATES,
  USER_BENEFIT_PROFILE_CANDIDATES,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';
import { readEnv } from '@/lib/env';
import type { AuditEvent } from '@/lib/audit';

import { normalizeAttendanceDays } from '../attendance';
import { canEditUser, resolveUserLifecycleStatus, toDomainUser } from '../domain/userLifecycle';
import { emitDriftRecord, type DriftResolutionType, type DriftType } from '@/features/diagnostics/drift/domain/driftLogic';
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
import { buildEq, joinAnd } from '@/sharepoint/query/builders';

const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const MAX_WRITE_RETRY = 8;
const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);
/** UserTransport_Settings / UserBenefit_Profile 双方の join キー列名 */
const ACCESSORY_LIST_JOIN_FIELD = 'UserID';

type AuditLogEntry = Omit<AuditEvent, 'ts'>;

interface UserFieldStatus {
  resolvedName?: string;
  candidates: string[];
  isSilent?: boolean;
  isEssential?: boolean;
}

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
  private readonly audit?: (log: AuditLogEntry) => void;
  private readonly defaultTop: number = 200;

  private resolvedFields: Record<string, string | undefined> | null = null;
  private fieldStatus: Record<string, UserFieldStatus> | null = null;
  private unsupportedWriteFields = new Set<string>();

  private readonly transportListTitle: string;
  private readonly benefitListTitle: string;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
    audit?: (log: AuditLogEntry) => void;
    defaultTop?: number;
  }) {
    this.provider = options.provider;
    this.listTitle = options.listTitle || (sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) || DEFAULT_USERS_LIST_TITLE);
    this.audit = options.audit;
    this.defaultTop = options.defaultTop ?? 200;
    
    this.transportListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_TRANSPORT', '')) || 'UserTransport_Settings';
    this.benefitListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT', '')) || 'UserBenefit_Profile';
  }

  private resolvingPromise: Promise<Record<string, string | undefined> | null> | null = null;

  /**
   * フィールド解決（Dynamic Schema Resolution）
   * 400 Bad Request を防ぐための最重要ガードレール
   */
  private async resolveFields(): Promise<Record<string, string | undefined> | null> {
    if (this.resolvedFields) return this.resolvedFields;
    if (this.resolvingPromise) return this.resolvingPromise;

    this.resolvingPromise = (async () => {
      try {
        const available = await this.provider.getFieldInternalNames(this.listTitle);
        
        // フィールド解決用の候補定義型
        interface CandidateDef {
          candidates: string[];
          isSilent: boolean;
        }

        // 1. コンプライアンス・拡張候補 (UI警告不要)
        const extCandidates: Record<string, CandidateDef> = Object.fromEntries(
          Object.entries(USERS_MASTER_COMPLIANCE_FIELD_MAP).map(([key, value]) => [
            key, 
            { candidates: [String(value)], isSilent: true }
          ])
        );

        // 2. コア基本候補 (UI警告対象)
        const coreCandidates: Record<string, CandidateDef> = Object.fromEntries(
          Object.entries(USERS_MASTER_CORE_FIELD_MAP).map(([key, value]) => {
            let candidates: string[] = [String(value)];
            if (key === 'userId') candidates = ['UserID', 'cr013_usercode', 'Title'];
            if (key === 'fullName') candidates = ['FullName', 'cr013_fullname', 'Title'];
            
            // Task 1: 大文字小文字や一般的バリアントを網羅
            if (key === 'id') candidates = ['Id', 'ID', 'id'];
            if (key === 'attendanceDays') candidates = ['AttendanceDays', 'attendanceDays', 'Attendance_x0020_Days'];
            if (key === 'severeFlag') candidates = ['SevereFlag', 'severeFlag', 'Severe_x0020_Flag'];

            return [key, { candidates, isSilent: false }];
          })
        );

        // 統合して解決を実行
        const allCandidates: Record<string, CandidateDef> = { ...coreCandidates, ...extCandidates };
        const candidateNamesOnly = Object.fromEntries(
          Object.entries(allCandidates).map(([k, v]) => [k, v.candidates])
        );

        const { resolved, fieldStatus: rawFieldStatus } = resolveInternalNamesDetailed(
          available,
          candidateNamesOnly as Record<string, string[]>,
          {
            onDrift: (fieldName, resolutionType, driftType) => {
              emitDriftRecord(this.listTitle, fieldName, resolutionType as DriftResolutionType, driftType as DriftType);
            }
          }
        );

        // isSilent フラグを保持した最終的な fieldStatus を作成
        const fieldStatusWithSilent = Object.fromEntries(
          Object.entries(rawFieldStatus).map(([key, status]) => [
            key,
            { 
              ...(status as { resolvedName?: string; candidates: string[] }), 
              isSilent: allCandidates[key]?.isSilent ?? false,
              isEssential: coreCandidates[key] !== undefined
            }
          ])
        ) as Record<string, UserFieldStatus>;

        // 必須フィールド判定（これらが欠けるとシステム警告の対象にする）
        const essentials: string[] = ['id', 'userId', 'fullName', 'isActive'];
        const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);

        reportResourceResolution({
          resourceName: 'Users_Master',
          resolvedTitle: this.listTitle,
          fieldStatus: fieldStatusWithSilent,
          essentials: essentials,
        });

        // 健全性にかかわらずキャッシュし、再解決（および再ループ）を防ぐ
        this.resolvedFields = resolved as Record<string, string | undefined>;
        this.fieldStatus = fieldStatusWithSilent;

        if (!isHealthy) {
          auditLog.warn('users', 'Essential fields missing for Users_Master.', { 
            list: this.listTitle, 
            resolved 
          });
        }

        return this.resolvedFields;
      } catch (err) {
        auditLog.error('users', 'Field resolution failed:', err);
        return null;
      }
    })();

    return this.resolvingPromise;
  }

  /**
   * 分離先リストのフィールド解決（Lazy Resolution）
   */
  private async resolveAccessoryFields(listTitle: string, candidates: Record<string, string[]>): Promise<Record<string, string | undefined>> {
    try {
      const available = await this.provider.getFieldInternalNames(listTitle);
      const { resolved } = resolveInternalNamesDetailed(available, candidates);
      return resolved;
    } catch (e) {
      auditLog.warn('users', `DataProviderUserRepository.resolveAccessoryFields_failed for ${listTitle}`, { error: String(e) });
      return {};
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

    const filterParts: (string | undefined)[] = [];
    if (params?.filters?.isActive !== undefined && fields.isActive) {
      // SharePoint Yes/No fields can be filtered by true/false or 1/0
      filterParts.push(buildEq(fields.isActive, params.filters.isActive ? 1 : 0));
    }

    try {
      const items = await this.provider.listItems<UserRow>(this.listTitle, {
        select: selectFields,
        filter: joinAnd(filterParts) || undefined,
        top: top > 0 ? top : undefined,
      });

      let domainItems = items.map(item => this.toDomain(item, requestedMode));

      // ── 分離先リストからの Join ──
      if (requestedMode === 'detail' || requestedMode === 'full') {
        try {
          const transportCandidatesMap = USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>;
          const benefitCandidatesMap = USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>;

          const [transportRows, benefitRows, transportResolved, benefitResolved] = await Promise.all([
            this.provider.listItems<Record<string, unknown>>(this.transportListTitle).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitListTitle).catch(() => []),
            this.resolveAccessoryFields(this.transportListTitle, transportCandidatesMap),
            this.resolveAccessoryFields(this.benefitListTitle, benefitCandidatesMap)
          ]);

          const transportMap = new Map<string, Record<string, unknown>>(
            washRows(transportRows, transportCandidatesMap, transportResolved).map(r => [String(r.userID || ''), r])
          );
          const benefitMap = new Map<string, Record<string, unknown>>(
            washRows(benefitRows, benefitCandidatesMap, benefitResolved).map(r => [String(r.userID || ''), r])
          );

          domainItems = domainItems.map(user => {
            const tRow = transportMap.get(user.UserID);
            const bRow = benefitMap.get(user.UserID);
            const sanitized = this.sanitizeDomainRecord(user, !!tRow, !!bRow);
            return this.mergeExtraData(sanitized, tRow, bRow);
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
          const filter = buildEq(ACCESSORY_LIST_JOIN_FIELD, domain.UserID);
          const transportCandidatesMap = USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>;
          const benefitCandidatesMap = USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>;

          const [tRowsRaw, bRowsRaw, transportResolved, benefitResolved] = await Promise.all([
            this.provider.listItems<Record<string, unknown>>(this.transportListTitle, { filter, top: 1 }).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitListTitle, { filter, top: 1 }).catch(() => []),
            this.resolveAccessoryFields(this.transportListTitle, transportCandidatesMap),
            this.resolveAccessoryFields(this.benefitListTitle, benefitCandidatesMap)
          ]);

          const tRow = tRowsRaw[0] ? washRow(tRowsRaw[0], transportCandidatesMap, transportResolved) : undefined;
          const bRow = bRowsRaw[0] ? washRow(bRowsRaw[0], benefitCandidatesMap, benefitResolved) : undefined;
          
          const sanitized = this.sanitizeDomainRecord(domain, !!tRow, !!bRow);
          return this.mergeExtraData(sanitized, tRow, bRow);
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
      after: domain as unknown as Record<string, unknown>,
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
      after: payload as Record<string, unknown>,
    });

    return updated;
  }

  /** メインリストへの書き込み（リトライロジック付き） */
  private async writeToMainList(listTitle: string, payload: Partial<IUserMasterCreateDto>, op: 'create' | 'update', id?: number): Promise<UserRow> {
    // スキーマ情報の最新化
    await this.resolveFields();
    
    // 送信データの構築
    let request = this.toRequest(payload);
    
    // 分離先リストのフィールドをメインリストへの送信から除外する
    const transportFields = this.resolveListFields(this.transportListTitle);
    const benefitFields = this.resolveListFields(this.benefitListTitle);
    const accessoryFields = new Set([...transportFields, ...benefitFields]);

    const filteredRequest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request)) {
      if (!accessoryFields.has(key)) {
        filteredRequest[key] = value;
      }
    }

    // 最終的な未サポートフィールドと動的スキーマによるフィルタ
    request = this.filterUnsupportedFields(filteredRequest);

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
      const filter = buildEq(ACCESSORY_LIST_JOIN_FIELD, userId);
      const existing = await this.provider.listItems<Record<string, unknown>>(listTitle, {
        filter,
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
    const validFieldsForSchema = this.resolvedFields ? new Set(Object.values(this.resolvedFields).filter((v): v is string => !!v)) : null;

    for (const [key, value] of Object.entries(request)) {
      if (this.unsupportedWriteFields.has(key)) continue;

      // Schema filtering: If schema is resolved, only allow known fields.
      // This immediately filters out 'Transport' or 'Benefit' fields that were moved to other lists.
      if (validFieldsForSchema && !validFieldsForSchema.has(key)) {
        // Special case: Id and Title are almost always valid base fields.
        if (key !== 'Id' && key !== 'Title') continue;
      }
      
      next[key] = value;
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
    if (dto.TransportToDays !== undefined) req[fields.transportToDays] = dto.TransportToDays ?? [];
    if (dto.TransportFromDays !== undefined) req[fields.transportFromDays] = dto.TransportFromDays ?? [];
    if (dto.TransportCourse !== undefined) req[fields.transportCourse] = dto.TransportCourse;
    if (dto.TransportSchedule !== undefined) req[fields.transportSchedule] = dto.TransportSchedule;
    if (dto.AttendanceDays !== undefined) req[fields.attendanceDays] = dto.AttendanceDays ?? [];
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

    // Compliance fields
    if (dto.LastAssessmentDate !== undefined) req[fields.lastAssessmentDate] = dto.LastAssessmentDate;
    if (dto.BehaviorScore !== undefined) req[fields.behaviorScore] = dto.BehaviorScore;
    if (dto.ChildBehaviorScore !== undefined) req[fields.childBehaviorScore] = dto.ChildBehaviorScore;
    if (dto.ServiceTypesJson !== undefined) req[fields.serviceTypesJson] = dto.ServiceTypesJson;
    if (dto.EligibilityCheckedAt !== undefined) req[fields.eligibilityCheckedAt] = dto.EligibilityCheckedAt;

    return req;
  }

  private toDomain(raw: UserRow, effectiveMode: UserSelectMode): IUserMaster {
    const fields = this.resolvedFields || FIELD_MAP.Users_Master;
    const candidates = USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>;
    
    // ドリフトを正規化
    const record = washRow(raw as unknown as Record<string, unknown>, candidates, fields as Record<string, string | undefined>);

    const attendance = normalizeAttendanceDays(record.attendanceDays);
    const transportTo = normalizeAttendanceDays(record.transportToDays);
    const transportFrom = normalizeAttendanceDays(record.transportFromDays);

    const domain: IUserMaster = {
      Id: Number(record.id ?? raw.Id),
      Title: (record.title as string) ?? raw.Title ?? null,
      UserID: (record.userId as string) ?? raw.UserID ?? '',
      FullName: (record.fullName as string) ?? raw.FullName ?? '',
      Furigana: (record.furigana as string) ?? raw.Furigana ?? null,
      FullNameKana: (record.fullNameKana as string) ?? raw.FullNameKana ?? null,
      ContractDate: (record.contractDate as string) ?? raw.ContractDate ?? null,
      ServiceStartDate: (record.serviceStartDate as string) ?? raw.ServiceStartDate ?? null,
      ServiceEndDate: (record.serviceEndDate as string) ?? raw.ServiceEndDate ?? null,
      IsHighIntensitySupportTarget: Boolean(record.isHighIntensitySupportTarget ?? null),
      IsSupportProcedureTarget: Boolean(record.isSupportProcedureTarget ?? null),
      severeFlag: Boolean(record.severeFlag ?? null),
      IsActive: record.isActive !== undefined ? Boolean(record.isActive) : (raw.IsActive ?? null),
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      TransportCourse: (record.transportCourse as string) ?? null,
      TransportSchedule: (record.transportSchedule as string) ?? null,
      AttendanceDays: attendance,
      RecipientCertNumber: (record.recipientCertNumber as string) ?? (raw.RecipientCertNumber as string) ?? null,
      RecipientCertExpiry: (record.recipientCertExpiry as string) ?? (raw.RecipientCertExpiry as string) ?? null,
      Modified: (record.modified as string) ?? raw.Modified ?? null,
      Created: (record.created as string) ?? raw.Created ?? null,
      UsageStatus: (record.usageStatus as string) ?? null,
      GrantMunicipality: (record.grantMunicipality as string) ?? null,
      GrantPeriodStart: (record.grantPeriodStart as string) ?? null,
      GrantPeriodEnd: (record.grantPeriodEnd as string) ?? null,
      DisabilitySupportLevel: (record.disabilitySupportLevel as string) ?? null,
      GrantedDaysPerMonth: (record.grantedDaysPerMonth as string) ?? null,
      UserCopayLimit: (record.userCopayLimit as string) ?? null,
      TransportAdditionType: (record.transportAdditionType as string) ?? null,
      MealAddition: (record.mealAddition as string) ?? null,
      CopayPaymentMethod: (record.copayPaymentMethod as string) ?? null,
      LastAssessmentDate: (record.lastAssessmentDate as string) ?? null,
      BehaviorScore: (record.behaviorScore as number) ?? null,
      ChildBehaviorScore: (record.childBehaviorScore as number) ?? null,
      ServiceTypesJson: (record.serviceTypesJson as string) ?? null,
      EligibilityCheckedAt: (record.eligibilityCheckedAt as string) ?? null,
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

  /**
   * ── Hardened Sanitization (FixUp) ──
   * 
   * スキャナと分類に基づき、不整合（LEGACY_LEFTOVER）を仮想的に解消する。
   * 分離先リストにデータが存在する場合、メインリスト側の残存フィールドを無効化する。
   */
  private sanitizeDomainRecord(user: IUserMaster, hasTransport: boolean, hasBenefit: boolean): IUserMaster {
    if (!hasTransport && !hasBenefit) return user;
    
    // Virtual Fix: 分離先データが存在するカテゴリの、メイン側の残存フィールドをクリアする。
    // これにより、万が一 mergeExtraData が動作しない環境でも、古いデータが混入するのを防ぐ。
    const sanitized = { ...user };

    if (hasTransport) {
      // These are now strictly managed by UserTransport_Settings
      sanitized.TransportToDays = [];
      sanitized.TransportFromDays = [];
      sanitized.TransportCourse = null;
      sanitized.TransportSchedule = null;
      sanitized.TransportAdditionType = null;
    }

    if (hasBenefit) {
      // These are now strictly managed by UserBenefit_Profile
      sanitized.RecipientCertNumber = null;
      sanitized.RecipientCertExpiry = null;
      sanitized.GrantMunicipality = null;
      sanitized.GrantPeriodStart = null;
      sanitized.GrantPeriodEnd = null;
      sanitized.DisabilitySupportLevel = null;
      sanitized.GrantedDaysPerMonth = null;
      sanitized.UserCopayLimit = null;
      sanitized.MealAddition = null;
      sanitized.CopayPaymentMethod = null;
    }
    
    return sanitized;
  }
}

