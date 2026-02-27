import { spfi, SPFx, type ISPFXContext, type SPFI } from '@pnp/sp';
import '@pnp/sp/items';
import '@pnp/sp/lists';
import '@pnp/sp/webs';

import { getAppConfig } from '@/lib/env';
import {
    FIELD_MAP,
    LIST_CONFIG,
    ListKeys,
    resolveUserSelectFields,
    type UserRow,
    type UserSelectMode,
} from '@/sharepoint/fields';

import { normalizeAttendanceDays } from '../attendance';
import type { UserRepository, UserRepositoryGetParams, UserRepositoryListParams, UserRepositoryUpdateDto } from '../domain/UserRepository';
import { userMasterCreateSchema, userMasterSchema } from '../schema';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

const DEFAULT_TOP = 500;

type SpContextCarrier = {
  __SPFX_CONTEXT__?: ISPFXContext;
};

export type SharePointUserRepositoryOptions = {
  sp?: SPFI;
  spfxContext?: ISPFXContext;
  defaultTop?: number;
};

// ---------------------------------------------------------------------------
// SharePoint 400 判定ヘルパー
// ---------------------------------------------------------------------------
function isSharePointSelect400(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message ?? '';
    // PnPJS wraps SP REST 400 errors with status info
    return (
      msg.includes('400') ||
      msg.includes("does not exist") ||
      msg.includes("column") ||
      msg.includes("field")
    );
  }
  return false;
}

export class SharePointUserRepository implements UserRepository {
  private readonly sp: SPFI;
  private readonly listTitle = LIST_CONFIG[ListKeys.UsersMaster].title;
  private readonly defaultTop: number;

  constructor(options: SharePointUserRepositoryOptions = {}) {
    this.ensureSharePointConfig();
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.sp = options.sp ?? this.createSpInstance(options.spfxContext);
  }

  // ── Public CRUD ──────────────────────────────────────────────

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) {
      return [];
    }

    const filters = params?.filters;
    const top = params?.top ?? this.defaultTop;
    const requestedMode = params?.selectMode ?? 'core';

    const items = await this.runWithSelectFallback(requestedMode, async (selectFields, mode) => {
      let query = this.list.items.select(...selectFields).top(top);

      if (filters?.isActive !== undefined) {
        const fieldName = FIELD_MAP.Users_Master.isActive;
        query = query.filter(`${fieldName} eq ${filters.isActive ? 1 : 0}`);
      }

      const rawItems = await query();
      return rawItems.map((item) => this.toDomain(item as UserRow, mode));
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
    const requestedMode = params?.selectMode ?? 'detail';
    try {
      return await this.runWithSelectFallback(requestedMode, async (selectFields, mode) => {
        const item = await this.list.items.getById(numericId).select(...selectFields)();
        return item ? this.toDomain(item as UserRow, mode) : null;
      });
    } catch (error) {
      console.error('SharePointUserRepository.getById failed', error);
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    // Validate request payload
    userMasterCreateSchema.parse(payload);

    const request = this.toRequest(payload);
    const result = await this.list.items.add(request);
    return this.toDomain(result.data as UserRow, 'full');
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.update: ${String(id)}`);
    }
    const request = this.toRequest(payload);
    await this.list.items.getById(numericId).update(request);
    const updated = await this.getById(numericId, { selectMode: 'detail' });
    if (!updated) {
      throw new Error(`Unable to load updated record for id ${numericId}`);
    }
    return updated;
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.remove: ${String(id)}`);
    }
    await this.list.items.getById(numericId).recycle();
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
   * SharePoint 生データ → ドメインオブジェクト変換。
   * effectiveMode を __selectMode としてマーキングし、
   * 上位レイヤーで「どのレベルまで取得済みか」を判別可能にする。
   */
  private toDomain(raw: UserRow, effectiveMode: UserSelectMode = 'core'): IUserMaster {
    const fields = FIELD_MAP.Users_Master;
    const record = raw as Record<string, unknown>;
    const get = <T = unknown>(field: string): T | undefined => record[field] as T | undefined;
    const attendance = normalizeAttendanceDays(get(fields.attendanceDays));
    const transportTo = normalizeAttendanceDays(get(fields.transportToDays));
    const transportFrom = normalizeAttendanceDays(get(fields.transportFromDays));

    const domain: IUserMaster = {
      Id: Number(get<number>(fields.id) ?? raw.Id),
      Title: get<string | null>(fields.title) ?? raw.Title ?? null,
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
      severeFlag: get<boolean | null>(fields.severeFlag) ?? null,
      IsActive: get<boolean | null>(fields.isActive) ?? raw.IsActive ?? null,
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      AttendanceDays: attendance,
      RecipientCertNumber: get<string | null>(fields.recipientCertNumber) ?? raw.RecipientCertNumber ?? null,
      RecipientCertExpiry: get<string | null>(fields.recipientCertExpiry) ?? raw.RecipientCertExpiry ?? null,
      Modified: get<string | null>(fields.modified) ?? raw.Modified ?? null,
      Created: get<string | null>(fields.created) ?? raw.Created ?? null,
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

    // Validate domain object structure (best-effort, might warn instead of throw if legacy data)
    try {
      userMasterSchema.parse(domain);
    } catch (error) {
      console.warn('[SharePointUserRepository] Domain object validation failed', error, domain);
    }

    return domain;
  }

  private toRequest(dto: Partial<IUserMasterCreateDto>): Record<string, unknown> {
    const fields = FIELD_MAP.Users_Master;
    const payload: Record<string, unknown> = {};

    const assign = (key: keyof typeof fields, value: unknown): void => {
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
    if (dto.severeFlag !== undefined) assign('severeFlag', dto.severeFlag);
    if (dto.IsActive !== undefined) assign('isActive', dto.IsActive);
    if (dto.AttendanceDays !== undefined) assign('attendanceDays', normalizeAttendanceDays(dto.AttendanceDays));
    if (dto.TransportToDays !== undefined) assign('transportToDays', normalizeAttendanceDays(dto.TransportToDays));
    if (dto.TransportFromDays !== undefined) assign('transportFromDays', normalizeAttendanceDays(dto.TransportFromDays));
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
