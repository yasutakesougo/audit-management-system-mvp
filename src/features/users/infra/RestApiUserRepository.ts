/**
 * RestApiUserRepository
 *
 * MSAL acquireToken + SharePoint REST API ベースの UserRepository 実装。
 * PnPJS (SPFx 依存) を使わず、spClient の spFetch 相当の
 * 認証付き fetch で Users_Master を操作する。
 *
 * ローカル開発（SPFx コンテキストなし）でも動作する。
 */
import type { AuditEvent } from '@/lib/audit';
import { readEnv } from '@/lib/env';
import {
  DEFAULT_USERS_LIST_TITLE,
  sanitizeEnvValue,
} from '@/lib/sp/helpers';
import { ensureConfig } from '@/lib/sp/config';
import {
  FIELD_MAP,
  resolveUserSelectFields,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';

import { normalizeAttendanceDays } from '../attendance';
import type {
  UserRepository,
  UserRepositoryGetParams,
  UserRepositoryListParams,
  UserRepositoryUpdateDto,
} from '../domain/UserRepository';
import { userMasterCreateSchema, userMasterSchema } from '../schema';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

const DEFAULT_TOP = 500;

export type RestApiUserRepositoryOptions = {
  acquireToken: () => Promise<string | null>;
  defaultTop?: number;
  audit?: (event: Omit<AuditEvent, 'ts'>) => void;
};

// ---------------------------------------------------------------------------
// JSON response types
// ---------------------------------------------------------------------------
type SpListItemsResponse = {
  value?: UserRow[];
};

type SpItemResponse = UserRow & {
  'd'?: UserRow;
};

export class RestApiUserRepository implements UserRepository {
  private readonly acquireToken: () => Promise<string | null>;
  private readonly baseUrl: string;
  private readonly listTitle: string;
  private readonly defaultTop: number;
  private readonly audit?: (event: Omit<AuditEvent, 'ts'>) => void;

  constructor(options: RestApiUserRepositoryOptions) {
    this.acquireToken = options.acquireToken;
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.audit = options.audit;

    const cfg = ensureConfig();
    this.baseUrl = cfg.baseUrl;

    this.listTitle =
      sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) ||
      DEFAULT_USERS_LIST_TITLE;
  }

  // ── Public CRUD ──────────────────────────────────────────────

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) return [];

    const filters = params?.filters;
    const top = params?.top ?? this.defaultTop;
    const selectMode = params?.selectMode ?? 'core';
    const selectFields = [...resolveUserSelectFields(selectMode)];

    const filterParts: string[] = [];
    if (filters?.isActive !== undefined) {
      const fieldName = FIELD_MAP.Users_Master.isActive;
      filterParts.push(`${fieldName} eq ${filters.isActive ? 1 : 0}`);
    }

    const queryParts: string[] = [];
    if (selectFields.length) queryParts.push(`$select=${selectFields.join(',')}`);
    if (top > 0) queryParts.push(`$top=${top}`);
    if (filterParts.length) queryParts.push(`$filter=${filterParts.join(' and ')}`);

    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items${queryParts.length ? '?' + queryParts.join('&') : ''}`;

    let items: IUserMaster[];
    try {
      items = await this.fetchItems(path, selectMode);
    } catch (e) {
      if (this.isSelectError(e)) {
        // Fallback: $select を外して全列取得（存在しないフィールドを含んでいても安全）
        console.warn('[RestApiUserRepository] $select error, retrying without $select', e);
        const fallbackParts: string[] = [];
        if (top > 0) fallbackParts.push(`$top=${top}`);
        if (filterParts.length) fallbackParts.push(`$filter=${filterParts.join(' and ')}`);
        const fallbackPath = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items${fallbackParts.length ? '?' + fallbackParts.join('&') : ''}`;
        items = await this.fetchItems(fallbackPath, selectMode);
      } else {
        throw e;
      }
    }

    if (filters?.keyword) {
      const keyword = filters.keyword.trim().toLowerCase();
      if (keyword) {
        return items.filter((row) => this.matchesKeyword(row, keyword));
      }
    }

    return items;
  }

  public async getById(
    id: number | string,
    params?: UserRepositoryGetParams,
  ): Promise<IUserMaster | null> {
    if (params?.signal?.aborted) return null;

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(
        `Invalid id passed to RestApiUserRepository.getById: ${String(id)}`,
      );
    }

    const selectMode = params?.selectMode ?? 'detail';
    const selectFields = [...resolveUserSelectFields(selectMode)];
    const queryParts: string[] = [];
    if (selectFields.length) queryParts.push(`$select=${selectFields.join(',')}`);

    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})${queryParts.length ? '?' + queryParts.join('&') : ''}`;

    try {
      let res = await this.spFetch(path);
      if (!res.ok) {
        if (res.status === 404) return null;
        // $select フィールド不在の 400 → $select なしでリトライ
        if (this.isSelectError(new Error(`HTTP ${res.status}`))) {
          console.warn('[RestApiUserRepository] $select error on getById, retrying without $select');
          const fallbackPath = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})`;
          res = await this.spFetch(fallbackPath);
          if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`HTTP ${res.status}`);
          }
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      }
      const raw = (await res.json()) as SpItemResponse;
      const row = raw.d ?? raw;
      return this.toDomain(row as UserRow, selectMode);
    } catch (error) {
      console.error('RestApiUserRepository.getById failed', error);
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    userMasterCreateSchema.parse(payload);

    const request = this.toRequest(payload);
    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items`;

    const res = await this.spFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;odata=verbose' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Create failed: HTTP ${res.status} - ${text}`);
    }

    const data = (await res.json()) as SpItemResponse;
    const row = data.d ?? data;
    const created = this.toDomain(row as UserRow, 'full');

    this.audit?.({
      actor: 'user',
      entity: 'Users_Master',
      action: 'create',
      entity_id: String(created.Id),
      channel: 'UI',
      after: { item: created },
    });

    return created;
  }

  public async update(
    id: number | string,
    payload: UserRepositoryUpdateDto,
  ): Promise<IUserMaster> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(
        `Invalid id passed to RestApiUserRepository.update: ${String(id)}`,
      );
    }

    const request = this.toRequest(payload);

    // Get the current ETag
    const itemUrl = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})`;
    const currentRes = await this.spFetch(itemUrl);
    if (!currentRes.ok) {
      throw new Error(`Failed to get current item for update: HTTP ${currentRes.status}`);
    }

    const updateRes = await this.spFetch(itemUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*',
      },
      body: JSON.stringify(request),
    });

    if (!updateRes.ok && updateRes.status !== 204) {
      const text = await updateRes.text().catch(() => '');
      throw new Error(`Update failed: HTTP ${updateRes.status} - ${text}`);
    }

    const updated = await this.getById(numericId, { selectMode: 'detail' });
    if (!updated) {
      throw new Error(`Unable to load updated record for id ${numericId}`);
    }

    this.audit?.({
      actor: 'user',
      entity: 'Users_Master',
      action: 'update',
      entity_id: String(numericId),
      channel: 'UI',
      after: { patch: payload },
    });

    return updated;
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(
        `Invalid id passed to RestApiUserRepository.remove: ${String(id)}`,
      );
    }

    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})/recycle()`;
    const res = await this.spFetch(path, {
      method: 'POST',
      headers: { 'X-HTTP-Method': 'DELETE', 'If-Match': '*' },
    });

    if (!res.ok && res.status !== 200) {
      const text = await res.text().catch(() => '');
      throw new Error(`Delete failed: HTTP ${res.status} - ${text}`);
    }

    this.audit?.({
      actor: 'user',
      entity: 'Users_Master',
      action: 'delete',
      entity_id: String(numericId),
      channel: 'UI',
    });
  }

  // ── Private helpers ──────────────────────────────────────────

  private async spFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.acquireToken();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Accept: 'application/json;odata=nometadata',
      ...(init.headers as Record<string, string> ?? {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // eslint-disable-next-line no-restricted-globals -- RestApiUserRepository 内の spFetch 最下層
    return fetch(url, {
      ...init,
      headers,
    });
  }

  private async fetchItems(
    path: string,
    selectMode: UserSelectMode,
  ): Promise<IUserMaster[]> {
    const res = await this.spFetch(path);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const json = (await res.json()) as SpListItemsResponse;
    return (json.value ?? []).map((item) =>
      this.toDomain(item as UserRow, selectMode),
    );
  }

  private isSelectError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message ?? '';
      return (
        msg.includes('400') ||
        msg.includes('does not exist') ||
        msg.includes('column') ||
        msg.includes('field')
      );
    }
    return false;
  }

  private matchesKeyword(row: IUserMaster, keyword: string): boolean {
    const candidates = [row.FullName, row.FullNameKana, row.Furigana, row.UserID]
      .filter(Boolean)
      .map((value) => (value as string).toLowerCase());
    return candidates.some((value) => value.includes(keyword));
  }

  private toDomain(
    raw: UserRow,
    effectiveMode: UserSelectMode = 'core',
  ): IUserMaster {
    const fields = FIELD_MAP.Users_Master;
    const record = raw as Record<string, unknown>;
    const get = <T = unknown>(field: string): T | undefined =>
      record[field] as T | undefined;
    const attendance = normalizeAttendanceDays(get(fields.attendanceDays));
    const transportTo = normalizeAttendanceDays(get(fields.transportToDays));
    const transportFrom = normalizeAttendanceDays(get(fields.transportFromDays));

    const domain: IUserMaster = {
      Id: Number(get<number>(fields.id) ?? raw.Id),
      Title: get<string | null>(fields.title) ?? raw.Title ?? null,
      UserID: (get<string>(fields.userId) ?? raw.UserID) ?? '',
      FullName: (get<string>(fields.fullName) ?? raw.FullName) ?? '',
      Furigana: get<string | null>(fields.furigana) ?? raw.Furigana ?? null,
      FullNameKana:
        get<string | null>(fields.fullNameKana) ?? raw.FullNameKana ?? null,
      ContractDate:
        get<string | null>(fields.contractDate) ?? raw.ContractDate ?? null,
      ServiceStartDate:
        get<string | null>(fields.serviceStartDate) ??
        raw.ServiceStartDate ??
        null,
      ServiceEndDate:
        get<string | null>(fields.serviceEndDate) ?? raw.ServiceEndDate ?? null,
      IsHighIntensitySupportTarget:
        get<boolean | null>(fields.isHighIntensitySupportTarget) ?? null,
      IsSupportProcedureTarget:
        get<boolean | null>(fields.isSupportProcedureTarget) ?? null,
      severeFlag: get<boolean | null>(fields.severeFlag) ?? null,
      IsActive: get<boolean | null>(fields.isActive) ?? raw.IsActive ?? null,
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      AttendanceDays: attendance,
      RecipientCertNumber:
        get<string | null>(fields.recipientCertNumber) ??
        raw.RecipientCertNumber ??
        null,
      RecipientCertExpiry:
        get<string | null>(fields.recipientCertExpiry) ??
        raw.RecipientCertExpiry ??
        null,
      Modified: get<string | null>(fields.modified) ?? raw.Modified ?? null,
      Created: get<string | null>(fields.created) ?? raw.Created ?? null,
      // ── 支給決定・請求加算 (DETAIL/FULL only) ──
      UsageStatus: get<string | null>(fields.usageStatus) ?? null,
      GrantMunicipality:
        get<string | null>(fields.grantMunicipality) ?? null,
      GrantPeriodStart:
        get<string | null>(fields.grantPeriodStart) ?? null,
      GrantPeriodEnd: get<string | null>(fields.grantPeriodEnd) ?? null,
      DisabilitySupportLevel:
        get<string | null>(fields.disabilitySupportLevel) ?? null,
      GrantedDaysPerMonth:
        get<string | null>(fields.grantedDaysPerMonth) ?? null,
      UserCopayLimit:
        get<string | null>(fields.userCopayLimit) ?? null,
      TransportAdditionType:
        get<string | null>(fields.transportAdditionType) ?? null,
      MealAddition: get<string | null>(fields.mealAddition) ?? null,
      CopayPaymentMethod:
        get<string | null>(fields.copayPaymentMethod) ?? null,
      // ── select mode marker ──
      __selectMode: effectiveMode,
    };

    try {
      userMasterSchema.parse(domain);
    } catch (error) {
      console.warn(
        '[RestApiUserRepository] Domain object validation failed',
        error,
        domain,
      );
    }

    return domain;
  }

  private toRequest(
    dto: Partial<IUserMasterCreateDto>,
  ): Record<string, unknown> {
    const fields = FIELD_MAP.Users_Master;
    const payload: Record<string, unknown> = {};

    const assign = (key: keyof typeof fields, value: unknown): void => {
      payload[fields[key]] = value;
    };

    if (dto.UserID !== undefined) assign('userId', dto.UserID);
    if (dto.FullName !== undefined) assign('fullName', dto.FullName);
    if (dto.Furigana !== undefined) assign('furigana', dto.Furigana);
    if (dto.FullNameKana !== undefined) assign('fullNameKana', dto.FullNameKana);
    if (dto.ContractDate !== undefined)
      assign('contractDate', dto.ContractDate ?? null);
    if (dto.ServiceStartDate !== undefined)
      assign('serviceStartDate', dto.ServiceStartDate ?? null);
    if (dto.ServiceEndDate !== undefined)
      assign('serviceEndDate', dto.ServiceEndDate ?? null);
    if (dto.IsHighIntensitySupportTarget !== undefined) {
      assign('isHighIntensitySupportTarget', dto.IsHighIntensitySupportTarget);
    }
    if (dto.IsSupportProcedureTarget !== undefined) {
      assign('isSupportProcedureTarget', dto.IsSupportProcedureTarget);
    }
    if (dto.severeFlag !== undefined) assign('severeFlag', dto.severeFlag);
    if (dto.IsActive !== undefined) assign('isActive', dto.IsActive);
    if (dto.AttendanceDays !== undefined)
      assign('attendanceDays', normalizeAttendanceDays(dto.AttendanceDays));
    if (dto.TransportToDays !== undefined)
      assign('transportToDays', normalizeAttendanceDays(dto.TransportToDays));
    if (dto.TransportFromDays !== undefined)
      assign(
        'transportFromDays',
        normalizeAttendanceDays(dto.TransportFromDays),
      );
    if (dto.RecipientCertNumber !== undefined)
      assign('recipientCertNumber', dto.RecipientCertNumber);
    if (dto.RecipientCertExpiry !== undefined)
      assign('recipientCertExpiry', dto.RecipientCertExpiry);
    // ── 支給決定・請求加算 ──
    if (dto.UsageStatus !== undefined)
      assign('usageStatus', dto.UsageStatus);
    if (dto.GrantMunicipality !== undefined)
      assign('grantMunicipality', dto.GrantMunicipality);
    if (dto.GrantPeriodStart !== undefined)
      assign('grantPeriodStart', dto.GrantPeriodStart ?? null);
    if (dto.GrantPeriodEnd !== undefined)
      assign('grantPeriodEnd', dto.GrantPeriodEnd ?? null);
    if (dto.DisabilitySupportLevel !== undefined)
      assign('disabilitySupportLevel', dto.DisabilitySupportLevel);
    if (dto.GrantedDaysPerMonth !== undefined)
      assign('grantedDaysPerMonth', dto.GrantedDaysPerMonth);
    if (dto.UserCopayLimit !== undefined)
      assign('userCopayLimit', dto.UserCopayLimit);
    if (dto.TransportAdditionType !== undefined)
      assign('transportAdditionType', dto.TransportAdditionType);
    if (dto.MealAddition !== undefined)
      assign('mealAddition', dto.MealAddition);
    if (dto.CopayPaymentMethod !== undefined)
      assign('copayPaymentMethod', dto.CopayPaymentMethod);

    return payload;
  }
}
