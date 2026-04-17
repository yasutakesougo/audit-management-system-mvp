import { spfi, SPFx, type ISPFXContext, type SPFI } from '@pnp/sp';
import '@pnp/sp/items';
import '@pnp/sp/lists';
import '@pnp/sp/webs';

import type { AuditEvent } from '@/lib/audit';

import { getAppConfig } from '@/lib/env';
import {
    FIELD_MAP,
    LIST_CONFIG,
    ListKeys,
    resolveUserSelectFields,
    USERS_MASTER_CANDIDATES,
    type UserRow,
    type UserSelectMode,
} from '@/sharepoint/fields';

import { normalizeAttendanceDays } from '../attendance';
import { canEditUser, resolveUserLifecycleStatus, toDomainUser } from '../domain/userLifecycle';
import type { UserRepository, UserRepositoryGetParams, UserRepositoryListParams, UserRepositoryUpdateDto } from '../domain/UserRepository';
import { userMasterCreateSchema, userMasterSchema } from '../schema';
import { USAGE_STATUS_VALUES } from '../typesExtended';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';
import { buildEq } from '@/sharepoint/query/builders';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';

type SpContextCarrier = {
  __SPFX_CONTEXT__?: ISPFXContext;
};

export type SharePointUserRepositoryOptions = {
  sp?: SPFI;
  spfxContext?: ISPFXContext;
  defaultTop?: number;
  /** Audit logger — called after successful create/update/terminate/remove */
  audit?: (event: Omit<AuditEvent, 'ts'>) => void;
};

// ---------------------------------------------------------------------------
// SharePoint 400 判定ヘルパー
// ---------------------------------------------------------------------------
function isSharePointSelect400(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const maybeStatus = (error as { status?: unknown }).status;
    if (typeof maybeStatus === 'number' && maybeStatus === 400) {
      return true;
    }
  }
  if (error instanceof Error) {
    const msg = (error.message ?? '').toLowerCase();
    // PnPJS wraps SP REST 400 errors with status info
    return (
      msg.includes('400') ||
      msg.includes("does not exist") ||
      msg.includes('property') ||
      msg.includes("column") ||
      msg.includes("field") ||
      msg.includes('存在しません') ||
      msg.includes('フィールド') ||
      msg.includes('プロパティ')
    );
  }
  return false;
}

const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

type UserFieldMapping = Record<keyof typeof USERS_MASTER_CANDIDATES, string>;

/** Guard for dynamic field resolution with fallback */
function asField(physical: string | undefined, fallback: string): string {
  // Graceful fallback to provided default if mapping is missing
  return physical || fallback;
}

export class SharePointUserRepository implements UserRepository {
  private readonly sp: SPFI;
  private readonly listTitle = LIST_CONFIG[ListKeys.UsersMaster].title;
  private readonly defaultTop: number;
  private readonly audit?: (event: Omit<AuditEvent, 'ts'>) => void;
  private resolvedFields: UserFieldMapping | null = null;

  constructor(options: SharePointUserRepositoryOptions = {}) {
    this.ensureSharePointConfig();
    this.defaultTop = options.defaultTop ?? SP_QUERY_LIMITS.default;
    this.audit = options.audit;
    this.sp = options.sp ?? this.createSpInstance(options.spfxContext);
  }

  private async ensureResolved(): Promise<UserFieldMapping> {
    if (this.resolvedFields) return this.resolvedFields;

    // Use unknown cast to bypass IList type discrepancies in v3/v4
    const listObj = this.list as unknown as { fields: () => Promise<Array<{ InternalName: string }>> };
    const fields = await listObj.fields();
    const available = new Set(fields.map(f => f.InternalName));
    
    const { resolved } = resolveInternalNamesDetailed(
      available,
      USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>
    );
    this.resolvedFields = resolved as UserFieldMapping;
    return this.resolvedFields;
  }

  // ── Public CRUD ──────────────────────────────────────────────

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) {
      return [];
    }

    const mapping = await this.ensureResolved();
    const filters = params?.filters;
    const top = params?.top ?? this.defaultTop;
    const requestedMode = params?.selectMode ?? 'detail';
    const safeTop = Math.min(Math.max(1, top), SP_QUERY_LIMITS.hardMax);

    const items = await this.runWithSelectFallback(requestedMode, async (selectFields, mode) => {
      // mapping を使って selectFields を物理名に置換
      const physicalSelects = this.resolvePhysicalSelects(selectFields, mapping);
      let query = this.list.items.select(...physicalSelects).top(safeTop);

      if (filters?.isActive !== undefined) {
        const fieldName = asField(mapping.isActive, 'IsActive');
        query = query.filter(buildEq(fieldName, filters.isActive ? 1 : 0));
      }

      const rawItems = await query();
      return rawItems.map((item) => this.toDomain(item as UserRow, mode, mapping));
    });

    if (filters?.keyword) {
      const keyword = filters.keyword.trim().toLowerCase();
      if (keyword) {
        return items.filter((row) => this.matchesKeyword(row, keyword));
      }
    }

    return items;
  }

  public async getById(id: number | string, params?: UserRepositoryGetParams): Promise<IUserMaster | null> {
    if (params?.signal?.aborted) {
      return null;
    }
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.getById: ${String(id)}`);
    }
    const mapping = await this.ensureResolved();
    const requestedMode = params?.selectMode ?? 'detail';
    try {
      return await this.runWithSelectFallback(requestedMode, async (selectFields, mode) => {
        const physicalSelects = this.resolvePhysicalSelects(selectFields, mapping);
        const item = await this.list.items.getById(numericId).select(...physicalSelects)();
        return item ? this.toDomain(item as UserRow, mode, mapping) : null;
      });
    } catch (error) {
      console.error('SharePointUserRepository.getById failed', error);
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    // Validate request payload
    userMasterCreateSchema.parse(payload);

    const mapping = await this.ensureResolved();
    const request = this.toRequest(payload, mapping);
    const result = await this.list.items.add(request);
    const created = this.toDomain(result.data as UserRow, 'full', mapping);
    this.audit?.({
      actor: 'user', entity: 'Users_Master', action: 'create',
      entity_id: String(created.Id), channel: 'UI',
      after: { item: created },
    });
    return created;
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.update: ${String(id)}`);
    }
    const mapping = await this.ensureResolved();
    const current = await this.getById(numericId, { selectMode: 'detail' });
    if (!current) {
      throw new Error(`Unable to load record for id ${numericId}`);
    }
    if (!canEditUser(current)) {
      throw new Error('契約終了の利用者は編集できません。');
    }
    const request = this.toRequest(payload, mapping);
    await this.list.items.getById(numericId).update(request);
    const updated = await this.getById(numericId, { selectMode: 'detail' });
    if (!updated) {
      throw new Error(`Unable to load updated record for id ${numericId}`);
    }
    this.audit?.({
      actor: 'user', entity: 'Users_Master', action: 'update',
      entity_id: String(numericId), channel: 'UI',
      after: { patch: payload },
    });
    return updated;
  }

  public async terminate(id: number | string): Promise<IUserMaster> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.terminate: ${String(id)}`);
    }

    const mapping = await this.ensureResolved();
    const current = await this.getById(numericId, { selectMode: 'detail' });
    if (!current) {
      throw new Error(`Unable to load record for id ${numericId}`);
    }

    if (resolveUserLifecycleStatus(current) === 'terminated') {
      return current;
    }

    const patch: UserRepositoryUpdateDto = {
      UsageStatus: USAGE_STATUS_VALUES.TERMINATED,
      ServiceEndDate: current.ServiceEndDate ?? getTodayIsoDate(),
      IsActive: false,
    };

    await this.list.items.getById(numericId).update(this.toRequest(patch, mapping));

    const updated = await this.getById(numericId, { selectMode: 'detail' });
    if (!updated) {
      throw new Error(`Unable to load updated record for id ${numericId}`);
    }

    this.audit?.({
      actor: 'user',
      entity: 'Users_Master',
      action: 'terminate',
      entity_id: String(numericId),
      channel: 'UI',
      before: {
        UsageStatus: current.UsageStatus ?? null,
        IsActive: current.IsActive ?? null,
        ServiceEndDate: current.ServiceEndDate ?? null,
      },
      after: {
        UsageStatus: updated.UsageStatus ?? null,
        IsActive: updated.IsActive ?? null,
        ServiceEndDate: updated.ServiceEndDate ?? null,
      },
    });

    return updated;
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.remove: ${String(id)}`);
    }
    await this.list.items.getById(numericId).recycle();
    this.audit?.({
      actor: 'user', entity: 'Users_Master', action: 'delete',
      entity_id: String(numericId), channel: 'UI',
    });
  }

  // ── Select fallback ──────────────────────────────────────────

  /**
   * $select で 400 が返った場合、上位モードから下位モードへ自動フォールバック。
   * full → detail → core の順に再試行する。
   * 400 以外のエラーはそのまま throw する。
   */
  private async runWithSelectFallback<T>(
    mode: UserSelectMode,
    run: (fields: string[], effectiveMode: UserSelectMode) => Promise<T>,
  ): Promise<T> {
    const tiers: UserSelectMode[] =
      mode === 'full'   ? ['full', 'detail', 'core'] :
      mode === 'detail' ? ['detail', 'core'] :
      ['core'];

    let lastErr: unknown;
    for (const tier of tiers) {
      try {
        const fields = [...resolveUserSelectFields(tier)];
        return await run(fields, tier);
      } catch (e) {
        lastErr = e;
        if (!isSharePointSelect400(e)) {
          throw e;
        }
        // 400 → フォールバック警告
        console.warn(
          `[SharePointUserRepository] $select failed for mode="${tier}", falling back.`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    throw lastErr;
  }

  // ── Private helpers ──────────────────────────────────────────

  private get list() {
    return this.sp.web.lists.getByTitle(this.listTitle);
  }

  private ensureSharePointConfig(): void {
    const config = getAppConfig();
    if (!config.VITE_SP_RESOURCE || !config.VITE_SP_SITE_RELATIVE) {
      console.warn('[SharePointUserRepository] SharePoint environment variables are missing.');
    }
  }

  private createSpInstance(context?: ISPFXContext): SPFI {
    const resolvedContext = context ?? SharePointUserRepository.resolveGlobalSpfxContext();
    if (!resolvedContext) {
      throw new Error('[SharePointUserRepository] SPFx context is not available. Supply one via constructor options.');
    }
    return spfi().using(SPFx(resolvedContext));
  }

  private static resolveGlobalSpfxContext(): ISPFXContext | undefined {
    const carrier = globalThis as SpContextCarrier;
    return carrier.__SPFX_CONTEXT__;
  }

  private matchesKeyword(row: IUserMaster, keyword: string): boolean {
    const candidates = [
      row.FullName,
      row.FullNameKana,
      row.Furigana,
      row.UserID,
    ]
      .filter(Boolean)
      .map((value) => (value as string).toLowerCase());
    return candidates.some((value) => value.includes(keyword));
  }

  /**
   * resolveUserSelectFields が返す論理名を、mapping を使って物理名に置換する。
   * mapping に存在しないものはそのまま返す（Id 等）。
   */
  private resolvePhysicalSelects(selects: string[], mapping: UserFieldMapping): string[] {
    // 逆引き用の FIELD_MAP キー特定（ちょっと面倒）
    // 本来は resolveUserSelectFields がキーを返すべきだが、一旦 FIELD_MAP の値と candidiates の基準名を一致させている前提。
    const result: string[] = [];
    const fieldMapValues = Object.entries(FIELD_MAP.Users_Master);
    
    for (const s of selects) {
      // s が FIELD_MAP.Users_Master のどれかの値である場合、そのキーを mapping で引く
      const entry = fieldMapValues.find(([_, val]) => val === s);
      if (entry) {
        const key = entry[0] as keyof UserFieldMapping;
        result.push(asField(mapping[key], s));
      } else {
        result.push(s);
      }
    }
    return [...new Set(result)];
  }

  /**
   * SharePoint 生データ → ドメインオブジェクト変換。
   * effectiveMode を __selectMode としてマーキングし、
   * 上位レイヤーで「どのレベルまで取得済みか」を判別可能にする。
   */
  private toDomain(raw: UserRow, effectiveMode: UserSelectMode = 'core', mapping: UserFieldMapping): IUserMaster {
    const fields = mapping;
    const record = raw as Record<string, unknown>;
    const get = <T = unknown>(field: string): T | undefined => record[field] as T | undefined;
    const attendance = normalizeAttendanceDays(get(fields.attendanceDays));
    const transportTo = normalizeAttendanceDays(get(fields.transportToDays));
    const transportFrom = normalizeAttendanceDays(get(fields.transportFromDays));

    const domain: IUserMaster = {
      Id: Number(get<number>('Id') ?? get<number>('ID') ?? raw.Id),
      Title: get<string | null>('Title') ?? get<string | null>('title') ?? raw.Title ?? null,
      UserID: (get<string>(fields.userId) ?? raw.UserID) ?? '',
      FullName: (get<string>(fields.fullName) ?? raw.FullName) ?? '',
      Furigana: get<string | null>(fields.furigana) ?? raw.Furigana ?? null,
      FullNameKana: get<string | null>(fields.fullNameKana) ?? raw.FullNameKana ?? null,
      ContractDate: get<string | null>(fields.contractDate) ?? raw.ContractDate ?? null,
      ServiceStartDate: get<string | null>(fields.serviceStartDate) ?? raw.ServiceStartDate ?? null,
      ServiceEndDate: get<string | null>(fields.serviceEndDate) ?? raw.ServiceEndDate ?? null,
      IsHighIntensitySupportTarget:
        get<boolean | null>(fields.isHighIntensitySupportTarget) ?? null,
      IsSupportProcedureTarget:
        get<boolean | null>(fields.isSupportProcedureTarget) ?? null,
      severeFlag: get<boolean | null>('SevereFlag') ?? get<boolean | null>('severeFlag') ?? null,
      IsActive: get<boolean | null>(fields.isActive) ?? raw.IsActive ?? null,
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      TransportCourse: get<string | null>(fields.transportCourse) ?? null,
      TransportSchedule: get<string | null>(fields.transportSchedule) ?? null,
      AttendanceDays: attendance,
      RecipientCertNumber: get<string | null>(fields.recipientCertNumber) ?? raw.RecipientCertNumber ?? null,
      RecipientCertExpiry: get<string | null>(fields.recipientCertExpiry) ?? raw.RecipientCertExpiry ?? null,
      Modified: get<string | null>('Modified') ?? get<string | null>('modified') ?? raw.Modified ?? null,
      Created: get<string | null>('Created') ?? get<string | null>('created') ?? raw.Created ?? null,
      // ── 支給決定・請求加算（DETAIL/FULL モード時のみ値あり） ──
      UsageStatus: get<string | null>(fields.usageStatus) ?? null,
      GrantMunicipality: get<string | null>(fields.grantMunicipality) ?? null,
      GrantPeriodStart: get<string | null>(fields.grantPeriodStart) ?? null,
      GrantPeriodEnd: get<string | null>(fields.grantPeriodEnd) ?? null,
      DisabilitySupportLevel: get<string | null>(fields.disabilitySupportLevel) ?? null,
      GrantedDaysPerMonth: get<string | null>(fields.grantedDaysPerMonth) ?? null,
      UserCopayLimit: get<string | null>(fields.userCopayLimit) ?? null,
      TransportAdditionType: get<string | null>(fields.transportAdditionType) ?? null,
      MealAddition: get<string | null>(fields.mealAddition) ?? null,
      CopayPaymentMethod: get<string | null>(fields.copayPaymentMethod) ?? null,
      // ── 取得レベルマーカー ──
      __selectMode: effectiveMode,
    };

    const normalized = toDomainUser(domain);

    // Validate domain object structure (best-effort, might warn instead of throw if legacy data)
    try {
      userMasterSchema.parse(normalized);
    } catch (error) {
      console.warn('[SharePointUserRepository] Domain object validation failed', error, normalized);
    }

    return normalized;
  }

  private toRequest(dto: Partial<IUserMasterCreateDto>, mapping: UserFieldMapping): Record<string, unknown> {
    const fields = mapping;
    const payload: Record<string, unknown> = {};

    const assign = (key: keyof UserFieldMapping, value: unknown): void => {
      payload[fields[key]] = value;
    };

    if (dto.UserID !== undefined) assign('userId', dto.UserID);
    if (dto.FullName !== undefined) assign('fullName', dto.FullName);
    if (dto.Furigana !== undefined) assign('furigana', dto.Furigana);
    if (dto.FullNameKana !== undefined) assign('fullNameKana', dto.FullNameKana);
    if (dto.ContractDate !== undefined) assign('contractDate', dto.ContractDate ?? null);
    if (dto.ServiceStartDate !== undefined) assign('serviceStartDate', dto.ServiceStartDate ?? null);
    if (dto.ServiceEndDate !== undefined) assign('serviceEndDate', dto.ServiceEndDate ?? null);
    if (dto.IsHighIntensitySupportTarget !== undefined) {
      assign('isHighIntensitySupportTarget', dto.IsHighIntensitySupportTarget);
    }
    if (dto.IsSupportProcedureTarget !== undefined) {
      assign('isSupportProcedureTarget', dto.IsSupportProcedureTarget);
    }
    if (dto.IsActive !== undefined) assign('isActive', dto.IsActive);
    if (dto.AttendanceDays !== undefined) assign('attendanceDays', normalizeAttendanceDays(dto.AttendanceDays));
    if (dto.TransportToDays !== undefined) assign('transportToDays', normalizeAttendanceDays(dto.TransportToDays));
    if (dto.TransportFromDays !== undefined) assign('transportFromDays', normalizeAttendanceDays(dto.TransportFromDays));
    if (dto.TransportCourse !== undefined) assign('transportCourse', dto.TransportCourse);
    if (dto.TransportSchedule !== undefined) assign('transportSchedule', dto.TransportSchedule);
    if (dto.RecipientCertNumber !== undefined) assign('recipientCertNumber', dto.RecipientCertNumber);
    if (dto.RecipientCertExpiry !== undefined) assign('recipientCertExpiry', dto.RecipientCertExpiry);
    // ── 支給決定・請求加算 ──
    if (dto.UsageStatus !== undefined) assign('usageStatus', dto.UsageStatus);
    if (dto.GrantMunicipality !== undefined) assign('grantMunicipality', dto.GrantMunicipality);
    if (dto.GrantPeriodStart !== undefined) assign('grantPeriodStart', dto.GrantPeriodStart ?? null);
    if (dto.GrantPeriodEnd !== undefined) assign('grantPeriodEnd', dto.GrantPeriodEnd ?? null);
    if (dto.DisabilitySupportLevel !== undefined) assign('disabilitySupportLevel', dto.DisabilitySupportLevel);
    if (dto.GrantedDaysPerMonth !== undefined) assign('grantedDaysPerMonth', dto.GrantedDaysPerMonth);
    if (dto.UserCopayLimit !== undefined) assign('userCopayLimit', dto.UserCopayLimit);
    if (dto.TransportAdditionType !== undefined) assign('transportAdditionType', dto.TransportAdditionType);
    if (dto.MealAddition !== undefined) assign('mealAddition', dto.MealAddition);
    if (dto.CopayPaymentMethod !== undefined) assign('copayPaymentMethod', dto.CopayPaymentMethod);

    return payload;
  }
}
