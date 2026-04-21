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
  USERS_MASTER_ESSENTIALS,
  USER_TRANSPORT_SETTINGS_CANDIDATES,
  USER_TRANSPORT_SETTINGS_ESSENTIALS,
  USER_BENEFIT_PROFILE_CANDIDATES,
  USER_BENEFIT_PROFILE_ESSENTIALS,
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_ESSENTIALS,
  USERS_BENEFIT_EXT_FIELD_MAP,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';
import { readEnv } from '@/lib/env';
import type { AuditEvent } from '@/lib/audit';
import { AuthRequiredError } from '@/lib/errors';

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
import type { IDataProvider, DataProviderOptions } from '@/lib/data/dataProvider.interface';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';
import {
  applyBenefitCutoverRead,
  applyBenefitCutoverWrite,
  resolveUserBenefitProfileCutoverStage,
  type CutoverStageValue,
} from './migration/userBenefitProfileCutover';

const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const MAX_WRITE_RETRY = 8;
const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);
/** UserTransport_Settings / UserBenefit_Profile 双方の join キー列名 */
const ACCESSORY_LIST_JOIN_FIELD = 'UserID';
const BENEFIT_PROFILE_REPOSITORY_CANDIDATES = Object.fromEntries(
  Object.entries(USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>).filter(
    ([key]) => key !== 'recipientCertNumber',
  ),
) as Record<string, string[]>;
const BENEFIT_PROFILE_REPOSITORY_ESSENTIALS = (USER_BENEFIT_PROFILE_ESSENTIALS as readonly string[]).filter(
  (key) => key !== 'recipientCertNumber',
);

const isAuthRequiredLike = (error: unknown): boolean => {
  if (error instanceof AuthRequiredError) return true;
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return (
    error.name === 'AuthRequiredError' ||
    error.message === 'AUTH_REQUIRED' ||
    code === 'AUTH_REQUIRED'
  );
};

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
  private readonly defaultTop: number = 500;
  private readonly reportedSkips = new Set<string>();

  private resolvedFields: Record<string, string | undefined> | null = null;
  private fieldStatus: Record<string, UserFieldStatus> | null = null;
  private unsupportedWriteFields = new Set<string>();

  private transportResolvedFields: Record<string, string | undefined> | null = null;
  private benefitResolvedFields: Record<string, string | undefined> | null = null;
  private benefitExtResolvedFields: Record<string, string | undefined> | null = null;
  private readonly transportListTitle: string;
  private readonly benefitListTitle: string;
  private readonly benefitExtListTitle: string;
  private cachedBenefitCutoverStage: CutoverStageValue | null = null;

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
    this.benefitExtListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT_EXT', '')) || 'UserBenefit_Profile_Ext';
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
        
        // 1. 統合候補マップを構築 (USERS_MASTER_CANDIDATES を活用して Drift 耐性を高める)
        const candidatesMap: Record<string, string[]> = {
          ...(USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>),
        };
        
        // CORE/COMPLIANCE マップから候補が漏れている場合に備えて補完 (safe guard)
        Object.entries(USERS_MASTER_CORE_FIELD_MAP).forEach(([key, val]) => {
          if (!candidatesMap[key]) candidatesMap[key] = [String(val)];
        });
        Object.entries(USERS_MASTER_COMPLIANCE_FIELD_MAP).forEach(([key, val]) => {
          if (!candidatesMap[key]) candidatesMap[key] = [String(val)];
        });

        // 2. 解決を実行
        const { resolved, fieldStatus: rawFieldStatus } = resolveInternalNamesDetailed(
          available,
          candidatesMap,
          {
            onDrift: (fieldName, resolutionType, driftType) => {
              emitDriftRecord(this.listTitle, fieldName, resolutionType as DriftResolutionType, driftType as DriftType);
            }
          }
        );

        // 3. 各属性の付帯情報を付与 (isSilent, isEssential)
        const essentialsSet = new Set(USERS_MASTER_ESSENTIALS as string[]);
        const fieldStatusWithSilent = Object.fromEntries(
          Object.entries(rawFieldStatus).map(([key, status]) => [
            key,
            { 
              ...(status as { resolvedName?: string; candidates: string[] }), 
              isSilent: !essentialsSet.has(key),
              isEssential: essentialsSet.has(key)
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
        // 未解決フィールドは原則 undefined のまま保持し、存在しない内部名を $select に流さない。
        // 例外として、フィールドメタデータ自体を取得できないケース（available が空）だけは
        // 従来どおり第1候補へフォールバックして初期環境での書き込みを可能にする。
        const availableLower = new Set(Array.from(available, (name) => name.toLowerCase()));
        const hasFieldMetadata = availableLower.size > 0;
        const bestEffort: Record<string, string | undefined> = {};
        for (const [key, cands] of Object.entries(candidatesMap)) {
          const resolvedName = resolved[key] as string | undefined;
          if (resolvedName) {
            bestEffort[key] = resolvedName;
            continue;
          }

          // [Robustness] If not resolved by inspection, try candidates in order
          let foundCandidate: string | undefined;

          if (!hasFieldMetadata) {
            // No metadata available (e.g. offline with empty cache), pick primary
            foundCandidate = cands[0];
          } else {
            // Pick first candidate that actually exists in the list
            foundCandidate = cands.find(c => availableLower.has(c.toLowerCase()));
          }

          bestEffort[key] = foundCandidate;
        }

        this.resolvedFields = bestEffort;
        this.fieldStatus = fieldStatusWithSilent;

        if (!isHealthy) {
          auditLog.warn('users', 'Essential fields missing for Users_Master.', { 
            list: this.listTitle, 
            resolved 
          });
        }

        return this.resolvedFields;
      } catch (err) {
        if (isAuthRequiredLike(err)) {
          throw err;
        }
        auditLog.warn('users', 'Field resolution failed (likely 403 Forbidden). Falling back to primary candidates (Best Effort).', err);
        
        // メタデータ取得失敗時は、候補リストの第1要素を信じて返却する (Best Effort Fallback)
        const candidatesMap = USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>;
        const fallback: Record<string, string | undefined> = {};
        const fieldStatus: Record<string, UserFieldStatus> = {};
        const essentialKeys = new Set<string>(USERS_MASTER_ESSENTIALS as readonly string[]);

        for (const [key, cands] of Object.entries(candidatesMap)) {
          fallback[key] = cands[0];
          const isEssential = essentialKeys.has(key);
          fieldStatus[key] = {
            candidates: cands,
            isSilent: !isEssential,
            isEssential,
          };
        }
        this.resolvedFields = fallback;
        this.fieldStatus = fieldStatus;
        return fallback;
      }
    })();

    return this.resolvingPromise;
  }

  /**
   * 分離先リストのフィールド解決（Lazy Resolution）
   */
  private async resolveAccessoryFields(
    listTitle: string, 
    candidates: Record<string, string[]>,
    essentials: string[] = []
  ): Promise<{ resolvedFields: Record<string, string | undefined>, resolvedKeys: Set<string> }> {
    try {
      const available = await this.provider.getFieldInternalNames(listTitle);
      const { resolved } = resolveInternalNamesDetailed(available, candidates);
      
      const bestEffort: Record<string, string | undefined> = {};
      const resolvedKeys = new Set<string>();

      for (const [key, cands] of Object.entries(candidates)) {
        if (resolved[key]) {
          bestEffort[key] = resolved[key] as string;
          resolvedKeys.add(key);
        } else if (essentials.includes(key)) {
          // 必須フィールドかつ未解決の場合はフォールバックする（ただし400の可能性あり）
          bestEffort[key] = cands[0];
        } else {
          // 任意フィールドで未解決の場合は undefined にして、後の $select から除外させる
          bestEffort[key] = undefined;
        }
      }
      return { resolvedFields: bestEffort, resolvedKeys };
    } catch {
      // 解決不能な場合は必須フィールドのみフォールバック使用
      const fallback: Record<string, string | undefined> = {};
      for (const [key, cands] of Object.entries(candidates)) {
        fallback[key] = essentials.includes(key) ? cands[0] : undefined;
      }
      return { resolvedFields: fallback, resolvedKeys: new Set() };
    }
  }

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) return [];

    const top = params?.top ?? this.defaultTop;
    const requestedMode = params?.selectMode ?? 'detail';
    
    const fields = await this.resolveFields();
    if (!fields) {
      throw new Error(`Users schema resolution failed: ${this.listTitle}`);
    }

    const selectFields = await this.getSelectFieldsForMainList(fields);

    const filterParts: (string | undefined)[] = [];
    if (params?.filters?.isActive !== undefined && fields.isActive) {
      // SharePoint Yes/No fields can be filtered by true/false or 1/0
      filterParts.push(buildEq(fields.isActive, params.filters.isActive ? 1 : 0));
    }

    const onFieldRemoved = (targetList: string) => (fieldName: string, status: number, error: string) => {
      const cacheKey = `${targetList}:${fieldName}`;
      if (!this.reportedSkips.has(cacheKey)) {
        this.reportedSkips.add(cacheKey);
        emitDriftRecord(
          targetList, 
          fieldName, 
          'runtime_skip', 
          'resolution_failure',
          `Status: ${status}. Error: ${error}`
        );
      }
    };

    const onCriticalFallback = (targetList: string) => (status: number, error: string) => {
      emitDriftRecord(
        targetList, 
        'CRITICAL_FALLBACK', 
        'action_required', 
        'fallback_to_minimal_fields',
        `Status: ${status}. Error: ${error}`
      );
    };

    const options: DataProviderOptions = {
      select: selectFields,
      filter: joinAnd(filterParts) || undefined,
      top: top > 0 ? top : undefined,
      onFieldRemoved: onFieldRemoved(this.listTitle),
      onCriticalFallback: onCriticalFallback(this.listTitle)
    };

    try {
      const items = await this.provider.listItems<UserRow>(this.listTitle, options);

      let domainItems = items.map(item => this.toDomain(item, requestedMode));

      // ── 分離先リストからの Join ──
      if (requestedMode === 'detail' || requestedMode === 'full') {
        try {
          const transportCandidatesMap = USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>;
          const benefitCandidatesMap = BENEFIT_PROFILE_REPOSITORY_CANDIDATES;
          const benefitExtCandidatesMap = USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>;

          const [transportRes, benefitRes, benefitExtRes] = await Promise.all([
            this.resolveAccessoryFields(this.transportListTitle, transportCandidatesMap, USER_TRANSPORT_SETTINGS_ESSENTIALS),
            this.resolveAccessoryFields(this.benefitListTitle, benefitCandidatesMap, BENEFIT_PROFILE_REPOSITORY_ESSENTIALS),
            this.resolveAccessoryFields(this.benefitExtListTitle, benefitExtCandidatesMap, USER_BENEFIT_PROFILE_EXT_ESSENTIALS)
          ]);

          const [transportRows, benefitRows, benefitExtRows] = await Promise.all([
            this.provider.listItems<Record<string, unknown>>(this.transportListTitle, {
              select: Object.values(transportRes.resolvedFields).filter((f): f is string => !!f),
              onFieldRemoved: onFieldRemoved(this.transportListTitle),
            }).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitListTitle, {
              select: Object.values(benefitRes.resolvedFields).filter((f): f is string => !!f),
              onFieldRemoved: onFieldRemoved(this.benefitListTitle),
            }).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitExtListTitle, {
              select: Object.values(benefitExtRes.resolvedFields).filter((f): f is string => !!f),
              onFieldRemoved: onFieldRemoved(this.benefitExtListTitle),
            }).catch(() => []),
          ]);

          const transportResolvedFields = transportRes.resolvedFields;
          const benefitResolvedFields = benefitRes.resolvedFields;
          const benefitExtResolvedFields = benefitExtRes.resolvedFields;

          const transportMap = new Map<string, Record<string, unknown>>(
            washRows(transportRows, transportCandidatesMap, transportResolvedFields).map((r) => [
              String(r.userId || r.UserID || r.userID || ''),
              r,
            ]),
          );
          const benefitCutoverStage = this.getBenefitCutoverStage();
          const benefitMap = new Map<string, Record<string, unknown>>(
            benefitRows.map((rawRow, idx) => {
              const washed = washRows([rawRow], benefitCandidatesMap, benefitResolvedFields)[0] ?? benefitRows[idx];
              const overlaid = applyBenefitCutoverRead(washed, rawRow, benefitCutoverStage);
              return [String(overlaid.userId || overlaid.UserID || overlaid.userID || ''), overlaid];
            }),
          );
          const benefitExtMap = new Map<string, Record<string, unknown>>(
            washRows(benefitExtRows, benefitExtCandidatesMap, benefitExtResolvedFields).map((r) => [
              String(r.userId || r.UserID || r.userID || ''),
              r,
            ]),
          );

          domainItems = domainItems.map(user => {
            const tRow = transportMap.get(user.UserID);
            const bRow = benefitMap.get(user.UserID);
            const beRow = benefitExtMap.get(user.UserID);
            const sanitized = this.sanitizeDomainRecord(user, !!tRow, !!bRow, !!beRow);
            return this.mergeExtraData(sanitized, tRow, bRow, beRow);
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
      if (isAuthRequiredLike(e)) {
        throw e;
      }
      auditLog.error('users', 'DataProviderUserRepository.getAll_failed', { error: String(e) });
      throw e;
    }
  }

  public async getById(id: number | string, options?: UserRepositoryGetParams): Promise<IUserMaster | null> {
    const numericId = Number(id);
    const requestedMode = options?.selectMode ?? 'detail';
    const signal = options?.signal;

    const fields = await this.resolveFields();
    if (!fields) return null;

    const selectFields = await this.getSelectFieldsForMainList(fields);

    const onFieldRemoved = (targetList: string) => (fieldName: string, status: number, error: string) => {
      const cacheKey = `${targetList}:${fieldName}`;
      if (!this.reportedSkips.has(cacheKey)) {
        this.reportedSkips.add(cacheKey);
        emitDriftRecord(
          targetList, 
          fieldName, 
          'runtime_skip', 
          'resolution_failure',
          `Status: ${status}. Error: ${error}`
        );
      }
    };

    const fetchOptions: DataProviderOptions = {
      select: selectFields,
      signal: signal,
      onFieldRemoved: onFieldRemoved(this.listTitle),
      onCriticalFallback: (status: number, error: string) => {
        emitDriftRecord(
          this.listTitle, 
          'CRITICAL_FALLBACK', 
          'action_required', 
          'fallback_to_minimal_fields',
          `Status: ${status}. Error: ${error}`
        );
      }
    };

    try {
      const row = await this.provider.getItemById<UserRow>(this.listTitle, numericId, fetchOptions);

      const domain = this.toDomain(row, requestedMode);

      if (requestedMode === 'detail' || requestedMode === 'full') {
        try {
          const filter = buildEq(ACCESSORY_LIST_JOIN_FIELD, domain.UserID);
          const transportCandidatesMap = USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>;
          const benefitCandidatesMap = BENEFIT_PROFILE_REPOSITORY_CANDIDATES;
          const benefitExtCandidatesMap = USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>;

          const [transportRes, benefitRes, benefitExtRes] = await Promise.all([
            this.resolveAccessoryFields(this.transportListTitle, transportCandidatesMap, USER_TRANSPORT_SETTINGS_ESSENTIALS),
            this.resolveAccessoryFields(this.benefitListTitle, benefitCandidatesMap, BENEFIT_PROFILE_REPOSITORY_ESSENTIALS),
            this.resolveAccessoryFields(this.benefitExtListTitle, benefitExtCandidatesMap, USER_BENEFIT_PROFILE_EXT_ESSENTIALS)
          ]);

          const [tRowsRaw, bRowsRaw, beRowsRaw] = await Promise.all([
            this.provider.listItems<Record<string, unknown>>(this.transportListTitle, { 
              filter, 
              select: Object.values(transportRes.resolvedFields).filter((f): f is string => !!f),
              onFieldRemoved: onFieldRemoved(this.transportListTitle),
              top: 1,
            }).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitListTitle, { 
              filter, 
              select: Object.values(benefitRes.resolvedFields).filter((f): f is string => !!f),
              onFieldRemoved: onFieldRemoved(this.benefitListTitle),
              top: 1,
            }).catch(() => []),
            this.provider.listItems<Record<string, unknown>>(this.benefitExtListTitle, { 
              filter, 
              select: Object.values(benefitExtRes.resolvedFields).filter((f): f is string => !!f),
              onFieldRemoved: onFieldRemoved(this.benefitExtListTitle),
              top: 1,
            }).catch(() => [])
          ]);

          const transportResolvedFields = transportRes.resolvedFields;
          const benefitResolvedFields = benefitRes.resolvedFields;
          const benefitExtResolvedFields = benefitExtRes.resolvedFields;

          const tRow = tRowsRaw[0] ? washRow(tRowsRaw[0], transportCandidatesMap, transportResolvedFields) : undefined;
          
          const benefitCutoverStage = this.getBenefitCutoverStage();
          const bRowBase = bRowsRaw[0] ? washRow(bRowsRaw[0], benefitCandidatesMap, benefitResolvedFields) : undefined;
          const bRow = bRowBase && bRowsRaw[0] ? applyBenefitCutoverRead(bRowBase, bRowsRaw[0], benefitCutoverStage) : undefined;

          const beRow = beRowsRaw[0] ? washRow(beRowsRaw[0], benefitExtCandidatesMap, benefitExtResolvedFields) : undefined;
          
          const sanitized = this.sanitizeDomainRecord(domain, !!tRow, !!bRow, !!beRow);
          return this.mergeExtraData(sanitized, tRow, bRow, beRow);
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

    // 分離先リストへの書き込み (UserID 紐付け)
    await Promise.all([
      this.syncAccessoryList(this.transportListTitle, domain.UserID, payload, 'transport'),
      this.syncAccessoryList(this.benefitListTitle, domain.UserID, payload, 'benefit'),
      this.syncAccessoryList(this.benefitExtListTitle, domain.UserID, payload, 'benefit_ext')
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
      this.syncAccessoryList(this.transportListTitle, existing.UserID, payload, 'transport'),
      this.syncAccessoryList(this.benefitListTitle, existing.UserID, payload, 'benefit'),
      this.syncAccessoryList(this.benefitExtListTitle, existing.UserID, payload, 'benefit_ext')
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
    const mapping = await this.resolveFields();
    if (!mapping) throw new Error('Schema resolution failed for main list');
    
    // 送信データの構築
    let request = this.toRequest(payload, mapping);
    
    // 分離先リストのフィールドをメインリストへの送信から除外する
    const transportMapping = await this.getAccessoryMapping('transport');
    const benefitMapping = await this.getAccessoryMapping('benefit');
    const benefitExtMapping = await this.getAccessoryMapping('benefit_ext');
    const accessoryPhysicalFields = new Set([
      ...Object.values(transportMapping).filter((v): v is string => !!v),
      ...Object.values(benefitMapping).filter((v): v is string => !!v),
      ...Object.values(benefitExtMapping).filter((v): v is string => !!v)
    ]);

    const filteredRequest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request)) {
      // UserID (join key) はメインリストにも必須なので、除外対象から外す
      if (!accessoryPhysicalFields.has(key) || key === 'UserID') {
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
  private async syncAccessoryList(listTitle: string, userId: string, payload: Partial<IUserMasterCreateDto>, type: 'transport' | 'benefit' | 'benefit_ext'): Promise<void> {
    const mapping = await this.getAccessoryMapping(type);
    const request = this.toRequest(payload, mapping);

    // UserID は必須で含める
    const filteredRequest: Record<string, unknown> = { UserID: userId };
    let hasData = false;
    
    // このリストに該当する（解決済みの）物理フィールドのみを抽出
    const physicalFields = new Set(Object.values(mapping).filter((v): v is string => !!v));
    for (const [key, value] of Object.entries(request)) {
      if (physicalFields.has(key) && key !== 'UserID') {
        filteredRequest[key] = value;
        hasData = true;
      }
    }

    // Lot1B PR #E — benefit リストのみ cutover overlay を適用（6列 rename-migrate）
    let finalRequest = filteredRequest;
    if (type === 'benefit') {
      const stage = this.getBenefitCutoverStage();
      finalRequest = applyBenefitCutoverWrite(filteredRequest, payload, stage);
      // cutover overlay の結果、UserID 以外にキーが増えた場合は hasData を再評価
      if (Object.keys(finalRequest).some((k) => k !== 'UserID')) {
        hasData = true;
      }
    }

    auditLog.debug('users', 'DataProviderUserRepository.sync_accessory_prepare', {
      listTitle,
      userId,
      hasData,
      filteredRequest: finalRequest,
    });
    if (!hasData) return; // 更新対象フィールドがない場合はスキップ

    try {
      // UserID で既存レコードを検索 (物理名 'UserID' 決め打ちだが、ACCESSORY_LIST_JOIN_FIELD も一応考慮)
      const joinField = mapping.userId || ACCESSORY_LIST_JOIN_FIELD;
      const filter = buildEq(joinField, userId);
      const existing = await this.provider.listItems<Record<string, unknown>>(listTitle, {
        filter,
        top: 1
      });

      auditLog.debug('users', 'DataProviderUserRepository.sync_accessory_find', {
        existing: existing.length,
        joinField,
        filter,
      });

      if (existing.length > 0) {
        const existingItem = existing[0];
        const idValue = existingItem.Id ?? existingItem.id ?? existingItem.ID;
        if (idValue === undefined || idValue === null || idValue === '') {
          // Best-effort fallback: some test/in-memory fixtures may omit Id while the row is still uniquely found by join key.
          auditLog.warn('users', 'DataProviderUserRepository.sync_accessory_missing_id', {
            listTitle,
            userId,
            joinField,
          });
          await this.provider.updateItem(listTitle, idValue as unknown as string | number, finalRequest);
        } else {
          await this.provider.updateItem(listTitle, idValue as string | number, finalRequest);
        }
      } else {
        await this.provider.createItem(listTitle, finalRequest);
      }
    } catch (e) {
      auditLog.warn('users', 'DataProviderUserRepository.sync_accessory_failed', { listTitle, userId, error: String(e) });
    }
  }

  /** Lot1B PR #E — 6列 rename-migrate cutover stage（テスト override 可） */
  private getBenefitCutoverStage(): CutoverStageValue {
    if (this.cachedBenefitCutoverStage) return this.cachedBenefitCutoverStage;
    this.cachedBenefitCutoverStage = resolveUserBenefitProfileCutoverStage();
    return this.cachedBenefitCutoverStage;
  }

  /** テスト用: stage を固定する（production では呼ばない） */
  public __setBenefitCutoverStageForTest(stage: CutoverStageValue | null): void {
    this.cachedBenefitCutoverStage = stage;
  }

  private async getAccessoryMapping(type: 'transport' | 'benefit' | 'benefit_ext'): Promise<Record<string, string | undefined>> {
    if (type === 'transport') {
      if (this.transportResolvedFields) return this.transportResolvedFields;
      const candidates = USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>;
      this.transportResolvedFields = (await this.resolveAccessoryFields(
        this.transportListTitle,
        candidates,
        USER_TRANSPORT_SETTINGS_ESSENTIALS,
      )).resolvedFields;
      return this.transportResolvedFields;
    } else if (type === 'benefit') {
      if (this.benefitResolvedFields) return this.benefitResolvedFields;
      const candidates = BENEFIT_PROFILE_REPOSITORY_CANDIDATES;
      this.benefitResolvedFields = (await this.resolveAccessoryFields(
        this.benefitListTitle,
        candidates,
        BENEFIT_PROFILE_REPOSITORY_ESSENTIALS,
      )).resolvedFields;
      return this.benefitResolvedFields;
    } else {
      if (this.benefitExtResolvedFields) return this.benefitExtResolvedFields;
      const candidates = USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>;
      this.benefitExtResolvedFields = (await this.resolveAccessoryFields(
        this.benefitExtListTitle,
        candidates,
        USER_BENEFIT_PROFILE_EXT_ESSENTIALS,
      )).resolvedFields;
      return this.benefitExtResolvedFields;
    }
  }

  private resolveListFields(listTitle: string): string[] {
    const fields = FIELD_MAP.Users_Master;
    if (listTitle === this.transportListTitle) {
      return [fields.transportToDays, fields.transportFromDays, fields.transportCourse, fields.transportSchedule, fields.transportAdditionType];
    }
    if (listTitle === this.benefitListTitle) {
      return [
        // recipientCertNumber moved to benefitExt
        fields.recipientCertExpiry, fields.grantMunicipality, 
        fields.grantPeriodStart, fields.grantPeriodEnd, fields.disabilitySupportLevel, 
        fields.grantedDaysPerMonth, fields.userCopayLimit, fields.mealAddition, fields.copayPaymentMethod
      ];
    }
    if (listTitle === this.benefitExtListTitle) {
      return [
        USERS_BENEFIT_EXT_FIELD_MAP.recipientCertNumber
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

  private toRequest(dto: Partial<IUserMasterCreateDto>, mappingOverrides?: Record<string, string | undefined>): Record<string, unknown> {
    const mapping: Record<string, string | undefined> = (mappingOverrides || this.resolvedFields || FIELD_MAP.Users_Master) as Record<string, string | undefined>;
    const req: Record<string, unknown> = {};

    const assign = (dtoKey: keyof IUserMasterCreateDto, mappingKey: string) => {
      const val = dto[dtoKey];
      if (val !== undefined) {
        const physical = mapping[mappingKey];
        if (physical) {
          req[physical] = val;
        }
      }
    };

    assign('UserID', 'userId');
    assign('FullName', 'fullName');
    assign('Furigana', 'furigana');
    assign('FullNameKana', 'fullNameKana');
    assign('ContractDate', 'contractDate');
    assign('ServiceStartDate', 'serviceStartDate');
    assign('ServiceEndDate', 'serviceEndDate');
    assign('IsHighIntensitySupportTarget', 'isHighIntensitySupportTarget');
    assign('IsSupportProcedureTarget', 'isSupportProcedureTarget');
    assign('severeFlag', 'severeFlag');
    assign('IsActive', 'isActive');
    
    // Arrays need default value normalization if passed as undefined in DTO
    if (dto.TransportToDays !== undefined) {
      const p = mapping.transportToDays;
      if (p) req[p] = dto.TransportToDays ?? [];
    }
    if (dto.TransportFromDays !== undefined) {
      const p = mapping.transportFromDays;
      if (p) req[p] = dto.TransportFromDays ?? [];
    }
    assign('TransportCourse', 'transportCourse');
    assign('TransportSchedule', 'transportSchedule');
    if (dto.AttendanceDays !== undefined) {
      const p = mapping.attendanceDays;
      if (p) req[p] = dto.AttendanceDays ?? [];
    }
    assign('RecipientCertNumber', 'recipientCertNumber');
    assign('RecipientCertExpiry', 'recipientCertExpiry');
    
    // Billing fields
    assign('UsageStatus', 'usageStatus');
    assign('GrantMunicipality', 'grantMunicipality');
    assign('GrantPeriodStart', 'grantPeriodStart');
    assign('GrantPeriodEnd', 'grantPeriodEnd');
    assign('DisabilitySupportLevel', 'disabilitySupportLevel');
    assign('GrantedDaysPerMonth', 'grantedDaysPerMonth');
    assign('UserCopayLimit', 'userCopayLimit');
    assign('TransportAdditionType', 'transportAdditionType');
    assign('MealAddition', 'mealAddition');
    assign('CopayPaymentMethod', 'copayPaymentMethod');

    // Compliance fields
    assign('LastAssessmentDate', 'lastAssessmentDate');
    assign('BehaviorScore', 'behaviorScore');
    assign('ChildBehaviorScore', 'childBehaviorScore');
    assign('ServiceTypesJson', 'serviceTypesJson');
    assign('EligibilityCheckedAt', 'eligibilityCheckedAt');

    return req;
  }

  private toDomain(raw: UserRow, effectiveMode: UserSelectMode): IUserMaster {
    const fields = this.resolvedFields || FIELD_MAP.Users_Master;
    const candidates = USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>;
    const rawRecord = raw as unknown as Record<string, unknown>;
    
    // ドリフトを正規化
    const record = washRow(raw as unknown as Record<string, unknown>, candidates, fields as Record<string, string | undefined>);

    const attendance = normalizeAttendanceDays(record.attendanceDays);
    const transportTo = normalizeAttendanceDays(record.transportToDays);
    const transportFrom = normalizeAttendanceDays(record.transportFromDays);

    const domain: IUserMaster = {
      Id: Number(record['id'] ?? record['Id'] ?? rawRecord['Id'] ?? rawRecord['id']),
      Title:
        (record['title'] as string) ??
        (record['Title'] as string) ??
        (rawRecord['Title'] as string | undefined) ??
        (rawRecord['title'] as string | undefined) ??
        null,
      UserID:
        (record['userId'] as string) ??
        (record['UserID'] as string) ??
        (rawRecord['UserID'] as string | undefined) ??
        (rawRecord['userId'] as string | undefined) ??
        '',
      FullName:
        (record['fullName'] as string) ??
        (record['FullName'] as string) ??
        (rawRecord['FullName'] as string | undefined) ??
        (rawRecord['fullName'] as string | undefined) ??
        '',
      Furigana:
        (record['furigana'] as string) ??
        (record['Furigana'] as string) ??
        (rawRecord['Furigana'] as string | undefined) ??
        (rawRecord['furigana'] as string | undefined) ??
        null,
      FullNameKana:
        (record['fullNameKana'] as string) ??
        (record['FullNameKana'] as string) ??
        (rawRecord['FullNameKana'] as string | undefined) ??
        (rawRecord['fullNameKana'] as string | undefined) ??
        null,
      ContractDate:
        (record['contractDate'] as string) ??
        (record['ContractDate'] as string) ??
        (rawRecord['ContractDate'] as string | undefined) ??
        (rawRecord['contractDate'] as string | undefined) ??
        null,
      ServiceStartDate:
        (record['serviceStartDate'] as string) ??
        (record['ServiceStartDate'] as string) ??
        (rawRecord['ServiceStartDate'] as string | undefined) ??
        (rawRecord['serviceStartDate'] as string | undefined) ??
        null,
      ServiceEndDate:
        (record['serviceEndDate'] as string) ??
        (record['ServiceEndDate'] as string) ??
        (rawRecord['ServiceEndDate'] as string | undefined) ??
        (rawRecord['serviceEndDate'] as string | undefined) ??
        null,
      IsHighIntensitySupportTarget: Boolean(
        record['isHighIntensitySupportTarget'] ??
          record['IsHighIntensitySupportTarget'] ??
          rawRecord['IsHighIntensitySupportTarget'] ??
          rawRecord['isHighIntensitySupportTarget'] ??
          null,
      ),
      IsSupportProcedureTarget: Boolean(
        record['isSupportProcedureTarget'] ??
          record['IsSupportProcedureTarget'] ??
          rawRecord['IsSupportProcedureTarget'] ??
          rawRecord['isSupportProcedureTarget'] ??
          null,
      ),
      severeFlag: Boolean(
        record['severeFlag'] ?? record['SevereFlag'] ?? rawRecord['SevereFlag'] ?? rawRecord['severeFlag'] ?? null,
      ),
      IsActive: record['isActive'] !== undefined ? Boolean(record['isActive']) : ((rawRecord['IsActive'] as boolean | null | undefined) ?? null),
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      TransportCourse: (record['transportCourse'] as string) ?? (record['TransportCourse'] as string) ?? null,
      TransportSchedule: (record['transportSchedule'] as string) ?? (record['TransportSchedule'] as string) ?? null,
      AttendanceDays: attendance,
      RecipientCertNumber:
        (record['recipientCertNumber'] as string) ??
        (record['RecipientCertNumber'] as string) ??
        (rawRecord['RecipientCertNumber'] as string | undefined) ??
        (rawRecord['recipientCertNumber'] as string | undefined) ??
        null,
      RecipientCertExpiry:
        (record['recipientCertExpiry'] as string) ??
        (record['RecipientCertExpiry'] as string) ??
        (rawRecord['RecipientCertExpiry'] as string | undefined) ??
        (rawRecord['recipientCertExpiry'] as string | undefined) ??
        null,
      Modified:
        (record['modified'] as string) ??
        (record['Modified'] as string) ??
        (rawRecord['Modified'] as string | undefined) ??
        (rawRecord['modified'] as string | undefined) ??
        null,
      Created:
        (record['created'] as string) ??
        (record['Created'] as string) ??
        (rawRecord['Created'] as string | undefined) ??
        (rawRecord['created'] as string | undefined) ??
        null,
      UsageStatus: (record['usageStatus'] as string) ?? (record['UsageStatus'] as string) ?? null,
      GrantMunicipality: (record['grantMunicipality'] as string) ?? (record['GrantMunicipality'] as string) ?? null,
      GrantPeriodStart: (record['grantPeriodStart'] as string) ?? (record['GrantPeriodStart'] as string) ?? null,
      GrantPeriodEnd: (record['grantPeriodEnd'] as string) ?? (record['GrantPeriodEnd'] as string) ?? null,
      DisabilitySupportLevel: (record['disabilitySupportLevel'] as string) ?? (record['DisabilitySupportLevel'] as string) ?? null,
      GrantedDaysPerMonth: (record['grantedDaysPerMonth'] as string) ?? (record['GrantedDaysPerMonth'] as string) ?? null,
      UserCopayLimit: (record['userCopayLimit'] as string) ?? (record['UserCopayLimit'] as string) ?? null,
      TransportAdditionType: (record['transportAdditionType'] as string) ?? (record['TransportAdditionType'] as string) ?? null,
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

  private mergeExtraData(domain: IUserMaster, transport?: Record<string, unknown>, benefit?: Record<string, unknown>, benefitExt?: Record<string, unknown>): IUserMaster {
    const next = { ...domain };
    
    if (transport) {
      if (transport.transportToDays !== undefined) next.TransportToDays = normalizeAttendanceDays(transport.transportToDays);
      if (transport.transportFromDays !== undefined) next.TransportFromDays = normalizeAttendanceDays(transport.transportFromDays);
      if (transport.transportCourse !== undefined) next.TransportCourse = transport.transportCourse as string;
      if (transport.transportSchedule !== undefined) next.TransportSchedule = transport.transportSchedule as string;
      if (transport.transportAdditionType !== undefined) next.TransportAdditionType = transport.transportAdditionType as string;
    }

    if (benefit) {
      // recipientCertNumber is now handled by benefitExt
      if (benefit.recipientCertExpiry !== undefined) next.RecipientCertExpiry = benefit.recipientCertExpiry as string;
      if (benefit.grantMunicipality !== undefined) next.GrantMunicipality = benefit.grantMunicipality as string;
      if (benefit.grantPeriodStart !== undefined) next.GrantPeriodStart = benefit.grantPeriodStart as string;
      if (benefit.grantPeriodEnd !== undefined) next.GrantPeriodEnd = benefit.grantPeriodEnd as string;
      if (benefit.disabilitySupportLevel !== undefined) next.DisabilitySupportLevel = benefit.disabilitySupportLevel as string;
      if (benefit.grantedDaysPerMonth !== undefined) next.GrantedDaysPerMonth = benefit.grantedDaysPerMonth as string;
      if (benefit.userCopayLimit !== undefined) next.UserCopayLimit = benefit.userCopayLimit as string;
      if (benefit.mealAddition !== undefined) next.MealAddition = benefit.mealAddition as string;
      if (benefit.copayPaymentMethod !== undefined) next.CopayPaymentMethod = benefit.copayPaymentMethod as string;
    }

    if (benefitExt) {
      if (benefitExt.recipientCertNumber !== undefined) next.RecipientCertNumber = benefitExt.recipientCertNumber as string;
    }

    return next;
  }

  /**
   * ── Hardened Sanitization (FixUp) ──
   * 
   * スキャナと分類に基づき、不整合（LEGACY_LEFTOVER）を仮想的に解消する。
   * 分離先リストにデータが存在する場合、メインリスト側の残存フィールドを無効化する。
   */
  private sanitizeDomainRecord(user: IUserMaster, hasTransport: boolean, hasBenefit: boolean, hasBenefitExt: boolean): IUserMaster {
    if (!hasTransport && !hasBenefit && !hasBenefitExt) return user;
    
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
      // Note: RecipientCertNumber is special (moved further to EXT)
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

    if (hasBenefitExt) {
      sanitized.RecipientCertNumber = null;
    }
    
    return sanitized;
  }

  /**
   * メインリスト (Users_Master) から取得すべき列を特定する。
   * 分離先リスト (Transport, Benefit) に移動済みの物理列は、メインリストでの 400 エラーを避けるため除外する。
   */
  private async getSelectFieldsForMainList(fields: Record<string, string | undefined>): Promise<string[]> {
    const transportMapping = await this.getAccessoryMapping('transport');
    const benefitMapping = await this.getAccessoryMapping('benefit');
    const benefitExtMapping = await this.getAccessoryMapping('benefit_ext');
    
    const accessoryPhysicalFields = new Set([
      ...Object.values(transportMapping).filter((v): v is string => !!v),
      ...Object.values(benefitMapping).filter((v): v is string => !!v),
      ...Object.values(benefitExtMapping).filter((v): v is string => !!v)
    ]);

    const mainSelectableFields = Object.entries(fields)
      .filter(([logicalKey, physicalName]) => {
        if (!physicalName) return false;

        // 必須フィールドは解決成否にかかわらず含める（フォールバックでも400の代償を払って読みに行く）
        const status = this.fieldStatus?.[logicalKey];
        const isEssential = status?.isEssential || logicalKey === 'userId' || logicalKey === 'fullName';
        const isResolved = !!status?.resolvedName;

        if (!isEssential && !isResolved) {
          // 任意フィールドかつ解決失敗（フォールバック）の場合は、$select から除外して 400 を防ぐ
          return false;
        }

        // 結合キー (UserID) はメインリストにも物理的に存在し、必須なので除外しない
        if (physicalName === 'UserID') return true;

        // 分離先リストの列として解決されている物理名はメインリストの select から外す
        return !accessoryPhysicalFields.has(physicalName);
      })
      .map(([, physicalName]) => physicalName)
      .filter((physicalName): physicalName is string => typeof physicalName === 'string');

    return [
      'Id', 'Title', 'Modified', 'Created',
      ...mainSelectableFields,
    ].filter((v, i, a) => a.indexOf(v) === i);
  }
}
