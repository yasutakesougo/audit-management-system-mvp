import { spfi, SPFx, type ISPFXContext, type SPFI } from '@pnp/sp';
import '@pnp/sp/items';
import '@pnp/sp/lists';
import '@pnp/sp/webs';

import { getAppConfig } from '@/lib/env';
import {
    FIELD_MAP,
    LIST_CONFIG,
    ListKeys,
    USERS_SELECT_FIELDS_SAFE,
    type UserRow,
} from '@/sharepoint/fields';

import { normalizeAttendanceDays } from '../attendance';
import type { UserRepository, UserRepositoryGetParams, UserRepositoryListParams, UserRepositoryUpdateDto } from '../domain/UserRepository';
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

export class SharePointUserRepository implements UserRepository {
  private readonly sp: SPFI;
  private readonly listTitle = LIST_CONFIG[ListKeys.UsersMaster].title;
  private readonly selectFields = [...USERS_SELECT_FIELDS_SAFE];
  private readonly defaultTop: number;

  constructor(options: SharePointUserRepositoryOptions = {}) {
    this.ensureSharePointConfig();
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.sp = options.sp ?? this.createSpInstance(options.spfxContext);
  }

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) {
      return [];
    }

    const filters = params?.filters;
    const top = params?.top ?? this.defaultTop;

    let query = this.list.items.select(...this.selectFields).top(top);

    if (filters?.isActive !== undefined) {
      const fieldName = FIELD_MAP.Users_Master.isActive;
      query = query.filter(`${fieldName} eq ${filters.isActive ? 1 : 0}`);
    }

    const items = await query();
    let mapped = items.map((item) => this.toDomain(item as UserRow));

    if (filters?.keyword) {
      const keyword = filters.keyword.trim().toLowerCase();
      if (keyword) {
        mapped = mapped.filter((row) => this.matchesKeyword(row, keyword));
      }
    }

    return mapped;
  }

  public async getById(id: number | string, params?: UserRepositoryGetParams): Promise<IUserMaster | null> {
    if (params?.signal?.aborted) {
      return null;
    }
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.getById: ${String(id)}`);
    }
    try {
      const item = await this.list.items.getById(numericId).select(...this.selectFields)();
      return item ? this.toDomain(item as UserRow) : null;
    } catch (error) {
      console.error('SharePointUserRepository.getById failed', error);
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    const request = this.toRequest(payload);
    const result = await this.list.items.add(request);
    return this.toDomain(result.data as UserRow);
  }

  public async update(id: number | string, payload: UserRepositoryUpdateDto): Promise<IUserMaster> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid id passed to SharePointUserRepository.update: ${String(id)}`);
    }
    const request = this.toRequest(payload);
    await this.list.items.getById(numericId).update(request);
    const updated = await this.getById(numericId);
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

  private toDomain(raw: UserRow): IUserMaster {
    const fields = FIELD_MAP.Users_Master;
    const record = raw as Record<string, unknown>;
    const get = <T = unknown>(field: string): T | undefined => record[field] as T | undefined;
    const attendance = normalizeAttendanceDays(get(fields.attendanceDays));
    const transportTo = normalizeAttendanceDays(get(fields.transportToDays));
    const transportFrom = normalizeAttendanceDays(get(fields.transportFromDays));

    return {
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
    };
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

    return payload;
  }
}
