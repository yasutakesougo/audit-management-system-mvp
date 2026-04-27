import { sanitizeEnvValue, washRow } from '@/lib/sp/helpers';
import { auditLog } from '@/lib/debugLogger';
import { BaseRepository } from '@/lib/data/BaseRepository';
import { getAppConfig, readEnv, isAuditDebugEnabled } from '@/lib/env';
import type { AuditEvent } from '@/lib/audit';
import {
  USER_TRANSPORT_SETTINGS_CANDIDATES,
  USER_TRANSPORT_SETTINGS_ESSENTIALS,
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_ESSENTIALS,
  type UserRow,
} from '@/sharepoint/fields';

import { canEditUser, resolveUserLifecycleStatus } from '../domain/userLifecycle';
import type {
  UserRepository,
  UserRepositoryGetParams,
  UserRepositoryListParams,
  UserRepositoryUpdateDto,
} from '../domain/UserRepository';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { buildEq } from '@/sharepoint/query/builders';

import { UserFieldResolver } from './services/UserFieldResolver';
import { UserJoiner } from './services/UserJoiner';
import { UserPayloadBuilder } from './services/UserPayloadBuilder';
import {
  buildAccessorySelect,
  groupRowsByUserId,
  joinUsersWithAccessoryMaps,
  type AccessoryListContext,
  type AccessoryRowMap,
} from './services/userBulkJoin';
import { applyBenefitCutoverRead } from './migration/userBenefitProfileCutover';
import { USAGE_STATUS_VALUES } from '../typesExtended';
import type { CutoverStageValue } from './migration/userBenefitProfileCutover/stage';

const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

type AuditLogEntry = Omit<AuditEvent, 'ts'>;

type AccessoryListKey = 'transport' | 'benefit' | 'benefitExt';

interface BulkEnrichMetrics {
  transportRows: number | null;
  benefitRows: number | null;
  benefitExtRows: number | null;
  failedLists: AccessoryListKey[];
}

/**
 * DataProviderUserRepository
 * 
 * IDataProvider ベースの UserRepository 実装。
 * 巨大なロジックを UserFieldResolver, UserJoiner, UserPayloadBuilder に委譲し、
 * 責務を分離することで保守性を向上させている。
 */
export class DataProviderUserRepository extends BaseRepository implements UserRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private readonly audit?: (log: AuditLogEntry) => void;
  private readonly defaultTop: number = 200;

  private readonly resolver: UserFieldResolver;
  private readonly joiner: UserJoiner;
  private readonly payloadBuilder: UserPayloadBuilder;

  private readonly transportListTitle: string;
  private readonly benefitListTitle: string;
  private readonly benefitExtListTitle: string;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
    audit?: (log: AuditLogEntry) => void;
    defaultTop?: number;
  }) {
    super();
    this.provider = options.provider;
    this.listTitle = options.listTitle || (sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) || DEFAULT_USERS_LIST_TITLE);
    this.audit = options.audit;
    this.defaultTop = options.defaultTop ?? 200;
    
    this.transportListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_TRANSPORT', '')) || 'UserTransport_Settings';
    this.benefitListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT', '')) || 'UserBenefit_Profile';
    this.benefitExtListTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USER_BENEFIT_EXT', '')) || 'UserBenefit_Profile_Ext';

    this.resolver = new UserFieldResolver(this.provider, this.listTitle);
    this.joiner = new UserJoiner();
    this.payloadBuilder = new UserPayloadBuilder(this.provider, this.resolver);
  }

  public async getAll(params: UserRepositoryListParams = {}): Promise<IUserMaster[]> {
    try {
      const fields = await this.resolver.resolveMainFields();
      if (!fields) return [];

      const select = await this.getSelectFieldsForMainList(fields);
      const top = params.top ?? this.defaultTop;
      const rows = await this.provider.listItems<UserRow>(this.listTitle, {
        select,
        filter: params.filters?.isActive !== undefined ? buildEq(fields.isActive || 'IsActive', params.filters.isActive ? 1 : 0) : undefined,
        orderby: 'ID asc',
        top,
      });

      let users = rows.map(row => this.joiner.toDomain(row, params.selectMode || 'core', fields));

      if (params.selectMode === 'detail' || params.selectMode === 'full') {
        users = await this.enrichUsers(users);
      }

      if (params.filters?.keyword) {
        const keyword = params.filters.keyword.trim().toLowerCase();
        users = users.filter(u => 
          u.FullName.toLowerCase().includes(keyword) || 
          u.UserID.toLowerCase().includes(keyword) ||
          (u.Furigana && u.Furigana.toLowerCase().includes(keyword))
        );
      }

      return users;
    } catch (error) {
      auditLog.error('users', 'DataProviderUserRepository.getAll_failed', { error: String(error) });
      throw error;
    }
  }

  public async getById(id: number | string, params: UserRepositoryGetParams = {}): Promise<IUserMaster | null> {
    try {
      const fields = await this.resolver.resolveMainFields();
      if (!fields) return null;

      const select = await this.getSelectFieldsForMainList(fields);
      const row = await this.provider.getItemById<UserRow>(this.listTitle, Number(id), { select });
      if (!row) return null;

      const user = this.joiner.toDomain(row, params.selectMode || 'core', fields);

      if (params.selectMode === 'detail' || params.selectMode === 'full') {
        return await this.enrichUser(user);
      }

      return user;
    } catch (error) {
      auditLog.error('users', 'DataProviderUserRepository.getById_failed', { id, error: String(error) });
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    this.audit?.({ 
      action: 'CREATE', 
      entity: 'users', 
      after: payload as unknown as Record<string, unknown>,
      actor: 'system',
      channel: 'SPO'
    });
    
    const result = await this.payloadBuilder.writeToMainList(this.listTitle, payload, 'create');
    const newId = Number(result.Id);

    await this.syncAccessories(payload.UserID || '', payload);

    const created = await this.getById(newId, { selectMode: 'detail' });
    if (!created) throw new Error('Failed to reload after create');
    return created;
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    this.audit?.({ 
      action: 'UPDATE', 
      entity: 'users', 
      entity_id: String(id),
      after: payload as unknown as Record<string, unknown>,
      actor: 'system',
      channel: 'SPO'
    });
    
    const user = await this.getById(id, { selectMode: 'core' });
    if (!user) throw new Error(`User not found: ${id}`);
    if (!canEditUser(user)) throw new Error('Cannot edit finished contract user');

    await this.payloadBuilder.writeToMainList(this.listTitle, payload, 'update', Number(id));
    
    await this.syncAccessories(user.UserID, payload);

    const updated = await this.getById(id, { selectMode: 'detail' });
    if (!updated) throw new Error('Failed to reload after update');
    return updated;
  }

  public async terminate(id: number | string): Promise<IUserMaster> {
    const user = await this.getById(id, { selectMode: 'core' });
    if (!user) throw new Error('Not found');
    if (resolveUserLifecycleStatus(user) === 'terminated') return user;

    return await this.update(id, {
      UsageStatus: USAGE_STATUS_VALUES.TERMINATED,
      ServiceEndDate: user.ServiceEndDate ?? getTodayIsoDate(),
      IsActive: false,
    });
  }

  public async remove(id: number | string): Promise<void> {
    await this.provider.deleteItem(this.listTitle, Number(id));
    this.audit?.({ 
      action: 'DELETE', 
      entity: 'users', 
      entity_id: String(id),
      actor: 'system',
      channel: 'SPO'
    });
  }

  private async enrichUser(user: IUserMaster): Promise<IUserMaster> {
    const userId = user.UserID;
    if (!userId) return user;
    
    try {
      const [transportRes, benefitRes, benefitExtRes] = await Promise.all([
        this.resolver.resolveAccessoryFields(this.transportListTitle, USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>, USER_TRANSPORT_SETTINGS_ESSENTIALS as unknown as string[]),
        this.resolver.resolveAccessoryFields(this.benefitListTitle, this.resolver.getBenefitCandidates(), this.resolver.getBenefitEssentials()),
        this.resolver.resolveAccessoryFields(this.benefitExtListTitle, USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>, USER_BENEFIT_PROFILE_EXT_ESSENTIALS as unknown as string[])
      ]);

      const transportJoinField = transportRes.resolvedFields.userId || 'UserID';
      const benefitJoinField = benefitRes.resolvedFields.userId || 'UserID';
      const benefitExtJoinField = benefitExtRes.resolvedFields.userId || 'UserID';

      const [transportRows, benefitRows, benefitExtRows] = await Promise.all([
        this.provider.listItems<Record<string, unknown>>(this.transportListTitle, {
          filter: buildEq(transportJoinField, userId),
          top: 1,
        }),
        this.provider.listItems<Record<string, unknown>>(this.benefitListTitle, {
          filter: buildEq(benefitJoinField, userId),
          top: 1,
        }),
        this.provider.listItems<Record<string, unknown>>(this.benefitExtListTitle, {
          filter: buildEq(benefitExtJoinField, userId),
          top: 1,
        })
      ]);

      const transportRaw = transportRows[0];
      const benefitRaw = benefitRows[0];
      const benefitExtRaw = benefitExtRows[0];

      // 分離先リストのレコードを正規化（washRow）
      const transport = transportRaw ? washRow(transportRaw, USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>, transportRes.resolvedFields) : undefined;
      let benefit = benefitRaw ? washRow(benefitRaw, this.resolver.getBenefitCandidates(), benefitRes.resolvedFields) : undefined;
      const benefitExt = benefitExtRaw ? washRow(benefitExtRaw, USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>, benefitExtRes.resolvedFields) : undefined;

      // Benefit Cutover の読み込み時オーバーレイ適用（RAW 行を必要とするため benefitRaw を渡す）
      if (benefit && benefitRaw) {
        benefit = applyBenefitCutoverRead(benefit, benefitRaw, this.resolver.getBenefitCutoverStage());
      }

      const sanitized = this.joiner.sanitizeDomainRecord(user, !!transport, !!benefit, !!benefitExt);
      const next = this.joiner.mergeExtraData(sanitized, transport as Record<string, unknown>, benefit as Record<string, unknown>, benefitExt as Record<string, unknown>);
      return next;
    } catch (error) {
      // 429 / Failed to fetch 等が発生しても、基本一覧情報の表示を優先するため
      // ログ出力のみ行い、未付随のユーザー情報をそのまま返す。
      auditLog.warn('users', 'enrichUser_failed', { userId, error: String(error) });
      return user;
    }
  }

  private async enrichUsers(users: IUserMaster[]): Promise<IUserMaster[]> {
    if (users.length === 0) return users;

    const startedAt = performance.now();
    const metricsRef: { current: BulkEnrichMetrics | null } = { current: null };
    let fallbackUsed = false;
    try {
      return await this.bulkEnrichUsers(users, metricsRef);
    } catch (error) {
      fallbackUsed = true;
      auditLog.warn('users', 'bulkEnrichUsers_failed_falling_back_chunked', { error: String(error) });
      return await this.chunkedEnrichUsers(users);
    } finally {
      if (getAppConfig().isDev || isAuditDebugEnabled()) {
        const elapsedMs = Math.round(performance.now() - startedAt);
        const m = metricsRef.current;
        auditLog.debug('users', 'enrichUsers_metrics', {
          users: users.length,
          transportRows: m?.transportRows ?? null,
          benefitRows: m?.benefitRows ?? null,
          benefitExtRows: m?.benefitExtRows ?? null,
          failedLists: m?.failedLists ?? (fallbackUsed ? (['transport', 'benefit', 'benefitExt'] as AccessoryListKey[]) : []),
          fallbackUsed,
          elapsedMs,
        });
      }
    }
  }

  /**
   * Bulk fetch & in-memory join path.
   *
   * Issues at most 3 list reads (one per accessory list) regardless of N users,
   * replacing the N×3 filtered fetches of the chunked path. Falls back to the
   * chunked path on total failure of all 3 list reads.
   */
  private async bulkEnrichUsers(
    users: IUserMaster[],
    metricsRef?: { current: BulkEnrichMetrics | null },
  ): Promise<IUserMaster[]> {
    const [transportRes, benefitRes, benefitExtRes] = await Promise.all([
      this.resolver.resolveAccessoryFields(this.transportListTitle, USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>, USER_TRANSPORT_SETTINGS_ESSENTIALS as unknown as string[]),
      this.resolver.resolveAccessoryFields(this.benefitListTitle, this.resolver.getBenefitCandidates(), this.resolver.getBenefitEssentials()),
      this.resolver.resolveAccessoryFields(this.benefitExtListTitle, USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>, USER_BENEFIT_PROFILE_EXT_ESSENTIALS as unknown as string[]),
    ]);

    const transportJoinField = transportRes.resolvedFields.userId || 'UserID';
    const benefitJoinField = benefitRes.resolvedFields.userId || 'UserID';
    const benefitExtJoinField = benefitExtRes.resolvedFields.userId || 'UserID';

    // Top per page is the SP API maximum; pageCap is left undefined so the
    // provider follows @odata.nextLink to fetch every row.
    const PAGE_TOP = 4999;

    const results = await Promise.allSettled([
      this.provider.listItems<Record<string, unknown>>(this.transportListTitle, {
        select: buildAccessorySelect(transportRes.resolvedFields),
        top: PAGE_TOP,
      }),
      this.provider.listItems<Record<string, unknown>>(this.benefitListTitle, {
        select: buildAccessorySelect(benefitRes.resolvedFields),
        top: PAGE_TOP,
      }),
      this.provider.listItems<Record<string, unknown>>(this.benefitExtListTitle, {
        select: buildAccessorySelect(benefitExtRes.resolvedFields),
        top: PAGE_TOP,
      }),
    ]);

    const listKeys: ReadonlyArray<readonly [number, AccessoryListKey]> = [
      [0, 'transport'],
      [1, 'benefit'],
      [2, 'benefitExt'],
    ];
    const failedLists: AccessoryListKey[] = listKeys
      .filter(([idx]) => results[idx].status === 'rejected')
      .map(([, key]) => key);

    const allRejected = failedLists.length === results.length;
    if (allRejected) {
      if (metricsRef) {
        metricsRef.current = {
          transportRows: null,
          benefitRows: null,
          benefitExtRows: null,
          failedLists,
        };
      }
      const reason = (results[0] as PromiseRejectedResult).reason;
      throw reason instanceof Error ? reason : new Error(String(reason));
    }

    const emptyMap: AccessoryRowMap = new Map();
    const transportRowsArr = results[0].status === 'fulfilled' ? results[0].value : null;
    const benefitRowsArr = results[1].status === 'fulfilled' ? results[1].value : null;
    const benefitExtRowsArr = results[2].status === 'fulfilled' ? results[2].value : null;

    const transportMap = transportRowsArr ? groupRowsByUserId(transportRowsArr, transportJoinField) : emptyMap;
    const benefitMap = benefitRowsArr ? groupRowsByUserId(benefitRowsArr, benefitJoinField) : emptyMap;
    const benefitExtMap = benefitExtRowsArr ? groupRowsByUserId(benefitExtRowsArr, benefitExtJoinField) : emptyMap;

    for (const [idx, name] of listKeys) {
      if (results[idx].status === 'rejected') {
        auditLog.warn('users', `bulkEnrichUsers_partial_${name}_failed`, {
          error: String((results[idx] as PromiseRejectedResult).reason),
        });
      }
    }

    if (metricsRef) {
      metricsRef.current = {
        transportRows: transportRowsArr ? transportRowsArr.length : null,
        benefitRows: benefitRowsArr ? benefitRowsArr.length : null,
        benefitExtRows: benefitExtRowsArr ? benefitExtRowsArr.length : null,
        failedLists,
      };
    }

    const transport: AccessoryListContext = {
      map: transportMap,
      candidates: USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>,
      resolved: transportRes.resolvedFields,
    };
    const benefit: AccessoryListContext = {
      map: benefitMap,
      candidates: this.resolver.getBenefitCandidates(),
      resolved: benefitRes.resolvedFields,
    };
    const benefitExt: AccessoryListContext = {
      map: benefitExtMap,
      candidates: USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>,
      resolved: benefitExtRes.resolvedFields,
    };

    return joinUsersWithAccessoryMaps(users, {
      transport,
      benefit,
      benefitExt,
      joiner: this.joiner,
      benefitCutoverStage: this.resolver.getBenefitCutoverStage(),
    });
  }

  /**
   * Legacy fallback: per-user filtered fetch with a small concurrency cap.
   * Kept as a safety net when the bulk path's three list reads all fail.
   */
  private async chunkedEnrichUsers(users: IUserMaster[]): Promise<IUserMaster[]> {
    const concurrency = 3;
    const results: IUserMaster[] = [];

    for (let i = 0; i < users.length; i += concurrency) {
      const chunk = users.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(u => this.enrichUser(u)));
      results.push(...chunkResults);
    }

    return results;
  }

  private async syncAccessories(userId: string, payload: Partial<IUserMasterCreateDto>): Promise<void> {
    const [transportMapping, benefitMapping, benefitExtMapping] = await Promise.all([
      this.resolver.resolveAccessoryFields(this.transportListTitle, USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>, USER_TRANSPORT_SETTINGS_ESSENTIALS as unknown as string[]),
      this.resolver.resolveAccessoryFields(this.benefitListTitle, this.resolver.getBenefitCandidates(), this.resolver.getBenefitEssentials()),
      this.resolver.resolveAccessoryFields(this.benefitExtListTitle, USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>, USER_BENEFIT_PROFILE_EXT_ESSENTIALS as unknown as string[])
    ]);

    await Promise.all([
      this.payloadBuilder.syncAccessoryList(this.transportListTitle, userId, payload, 'transport', transportMapping.resolvedFields),
      this.payloadBuilder.syncAccessoryList(this.benefitListTitle, userId, payload, 'benefit', benefitMapping.resolvedFields),
      this.payloadBuilder.syncAccessoryList(this.benefitExtListTitle, userId, payload, 'benefit_ext', benefitExtMapping.resolvedFields)
    ]);
  }

  private async getSelectFieldsForMainList(fields: Record<string, string | undefined>): Promise<string[]> {
    const [transportMapping, benefitMapping, benefitExtMapping] = await Promise.all([
      this.resolver.resolveAccessoryFields(this.transportListTitle, USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>, USER_TRANSPORT_SETTINGS_ESSENTIALS as unknown as string[]),
      this.resolver.resolveAccessoryFields(this.benefitListTitle, this.resolver.getBenefitCandidates(), this.resolver.getBenefitEssentials()),
      this.resolver.resolveAccessoryFields(this.benefitExtListTitle, USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>, USER_BENEFIT_PROFILE_EXT_ESSENTIALS as unknown as string[])
    ]);
    
    const accessoryPhysicalFields = new Set([
      ...Object.values(transportMapping.resolvedFields).filter((v): v is string => !!v),
      ...Object.values(benefitMapping.resolvedFields).filter((v): v is string => !!v),
      ...Object.values(benefitExtMapping.resolvedFields).filter((v): v is string => !!v)
    ]);

    const status = this.resolver.getMainFieldStatus();

    const mainSelectableFields = Object.entries(fields)
      .filter(([logicalKey, physicalName]) => {
        if (!physicalName) return false;

        const fieldStatus = status?.[logicalKey];
        const isEssential = fieldStatus?.isEssential || logicalKey === 'userId' || logicalKey === 'fullName';
        const isResolved = !!fieldStatus?.resolvedName;

        if (!isEssential && !isResolved) {
          return false;
        }

        if (isEssential) return true;

        return !accessoryPhysicalFields.has(physicalName);
      })
      .map(([, physicalName]) => physicalName)
      .filter((physicalName): physicalName is string => typeof physicalName === 'string');

    return [
      'Id', 'Title', 'Modified', 'Created',
      ...mainSelectableFields,
    ].filter((v, i, a) => a.indexOf(v) === i);
  }

  /** @internal Test only */
  public __setBenefitCutoverStageForTest(stage: CutoverStageValue): void {
    this.resolver.__setBenefitCutoverStageForTest(stage);
  }
}
