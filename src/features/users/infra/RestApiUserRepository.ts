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
import {
  FIELD_MAP,
  resolveUserSelectFields,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';
import { buildEq } from '@/sharepoint/query/builders';

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
const usersSelectDisabledByEnv = readEnv('VITE_USERS_DISABLE_SELECT', '0') === '1';
let usersSelectSupported = !usersSelectDisabledByEnv;
const USERS_SELECT_DISABLE_CACHE_KEY_PREFIX = 'users:select-disabled:v1:';
const usersUnsupportedWriteFields = new Set<string>();
let usersWritableFieldSet: Set<string> | null = null;
let usersWritableFieldSetLoaded = false;
const MAX_WRITE_RETRY = 8;
const TRANSPORT_SCHEDULE_FIELD = FIELD_MAP.Users_Master.transportSchedule;
const MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR =
  'Users_Master に TransportSchedule 列がないため、送迎手段を保存できません。管理者に列追加を依頼してください。';
const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export type RestApiUserRepositoryOptions = {
  spFetch: (path: string, init?: RequestInit) => Promise<Response>;
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

type SpFieldsResponse = {
  value?: Array<{
    InternalName?: string;
    ReadOnlyField?: boolean;
    Hidden?: boolean;
  }>;
  d?: {
    results?: Array<{
      InternalName?: string;
      ReadOnlyField?: boolean;
      Hidden?: boolean;
    }>;
  };
};

export class RestApiUserRepository implements UserRepository {
  private readonly spFetchInternal: (path: string, init?: RequestInit) => Promise<Response>;
  private readonly listTitle: string;
  private readonly defaultTop: number;
  private readonly audit?: (event: Omit<AuditEvent, 'ts'>) => void;

  constructor(options: RestApiUserRepositoryOptions) {
    this.spFetchInternal = options.spFetch;
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.audit = options.audit;

    this.listTitle =
      sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) ||
      DEFAULT_USERS_LIST_TITLE;

    if (!usersSelectDisabledByEnv && this.isSelectDisabledByCache()) {
      usersSelectSupported = false;
    }
  }

  // ── Public CRUD ──────────────────────────────────────────────

  public async getAll(params?: UserRepositoryListParams): Promise<IUserMaster[]> {
    if (params?.signal?.aborted) return [];

    const filters = params?.filters;
    const top = params?.top ?? this.defaultTop;
    const requestedMode = params?.selectMode ?? 'detail';
    const selectMode: UserSelectMode = usersSelectSupported ? requestedMode : 'core';
    const selectFields = [...resolveUserSelectFields(selectMode)];

    const filterParts: string[] = [];
    if (filters?.isActive !== undefined) {
      const fieldName = FIELD_MAP.Users_Master.isActive;
      filterParts.push(buildEq(fieldName, filters.isActive ? 1 : 0));
    }

    const queryParts: string[] = [];
    if (usersSelectSupported && selectFields.length) queryParts.push(`$select=${selectFields.join(',')}`);
    if (top > 0) queryParts.push(`$top=${top}`);
    if (filterParts.length) queryParts.push(`$filter=${filterParts.join(' and ')}`);

    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items${queryParts.length ? '?' + queryParts.join('&') : ''}`;

    let items: IUserMaster[];
    try {
      items = await this.fetchItems(path, selectMode);
    } catch (e) {
      const shouldRetryWithoutSelect = path.includes('$select=');
      if (this.isSelectError(e) || this.isLikelySelectQueryFailure(e, path) || shouldRetryWithoutSelect) {
        this.disableSelectOptimization();
        // Fallback: $select を外して全列取得（存在しないフィールドを含んでいても安全）
        auditLog.warn('users', 'rest_api_repo.select_error_retry', { error: String(e) });
        const fallbackParts: string[] = [];
        if (top > 0) fallbackParts.push(`$top=${top}`);
        if (filterParts.length) fallbackParts.push(`$filter=${filterParts.join(' and ')}`);
        const fallbackPath = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items${fallbackParts.length ? '?' + fallbackParts.join('&') : ''}`;
        items = await this.fetchItems(fallbackPath, 'core');
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

    const requestedMode = params?.selectMode ?? 'detail';
    const selectMode: UserSelectMode = usersSelectSupported ? requestedMode : 'core';
    const selectFields = [...resolveUserSelectFields(selectMode)];
    const queryParts: string[] = [];
    if (usersSelectSupported && selectFields.length) queryParts.push(`$select=${selectFields.join(',')}`);

    const baseItemPath = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})`;
    const path = `${baseItemPath}${queryParts.length ? `?${queryParts.join('&')}` : ''}`;

    try {
      const res = await this.spFetch(path);
      const raw = (await res.json()) as SpItemResponse;
      const row = raw.d ?? raw;
      return this.toDomain(row as UserRow, selectMode);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      const shouldRetryWithoutSelect = path.includes('$select=');
      if (this.isSelectError(error) || this.isLikelySelectQueryFailure(error, path) || shouldRetryWithoutSelect) {
        this.disableSelectOptimization();
        auditLog.warn('users', 'rest_api_repo.select_error_getbyid_retry', { error: String(error) });
        try {
          const fallbackRes = await this.spFetch(baseItemPath);
          const fallbackRaw = (await fallbackRes.json()) as SpItemResponse;
          const fallbackRow = fallbackRaw.d ?? fallbackRaw;
          return this.toDomain(fallbackRow as UserRow, 'core');
        } catch (fallbackError) {
          if (this.isNotFoundError(fallbackError)) {
            return null;
          }
          auditLog.error('users', 'rest_api_repo.get_by_id_fallback_failed', { error: String(fallbackError) });
          return null;
        }
      }
      auditLog.error('users', 'rest_api_repo.get_by_id_failed', { error: String(error) });
      return null;
    }
  }

  public async create(payload: IUserMasterCreateDto): Promise<IUserMaster> {
    userMasterCreateSchema.parse(payload);

    let request = await this.buildWriteRequest(payload);
    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items`;

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt += 1) {
      try {
        const res = await this.spFetch(path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=nometadata',
            'Accept': 'application/json;odata=nometadata',
          },
          body: JSON.stringify(request),
        });
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
      } catch (error) {
        if (this.isTransportScheduleMissingError(error)) {
          throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
        }
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) {
          throw error;
        }
        if (retryField === TRANSPORT_SCHEDULE_FIELD) {
          throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
        }
        usersUnsupportedWriteFields.add(retryField);
        request = this.removeField(request, retryField);
        auditLog.warn('users', 'rest_api_repo.create_retry_without_field', {
          field: retryField,
          attempt: attempt + 1,
          error: String(error),
        });
        if (!Object.keys(request).length) {
          throw new Error('Create payload became empty after removing unsupported fields.');
        }
      }
    }

    throw new Error('Create failed after retrying unsupported SharePoint fields.');
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

    const current = await this.getById(numericId, { selectMode: 'detail' });
    if (!current) {
      throw new Error(`Unable to load record for id ${numericId}`);
    }
    if (!canEditUser(current)) {
      throw new Error('契約終了の利用者は編集できません。');
    }

    let request = await this.buildWriteRequest(payload);

    const itemUrl = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})`;
    await this.spFetch(itemUrl);
    if (!Object.keys(request).length) {
      const current = await this.getById(numericId, { selectMode: 'detail' });
      if (!current) {
        throw new Error(`Unable to load record for id ${numericId}`);
      }
      return current;
    }

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt += 1) {
      try {
        await this.spFetch(itemUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=nometadata',
            'Accept': 'application/json;odata=nometadata',
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*',
          },
          body: JSON.stringify(request),
        });
        break;
      } catch (error) {
        if (this.isTransportScheduleMissingError(error)) {
          throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
        }
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) {
          throw error;
        }
        if (retryField === TRANSPORT_SCHEDULE_FIELD) {
          throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
        }
        usersUnsupportedWriteFields.add(retryField);
        request = this.removeField(request, retryField);
        auditLog.warn('users', 'rest_api_repo.update_retry_without_field', {
          field: retryField,
          id: numericId,
          attempt: attempt + 1,
          error: String(error),
        });
        if (!Object.keys(request).length) {
          break;
        }
        if (attempt === MAX_WRITE_RETRY - 1) {
          throw error;
        }
      }
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

  public async terminate(id: number | string): Promise<IUserMaster> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(
        `Invalid id passed to RestApiUserRepository.terminate: ${String(id)}`,
      );
    }

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

    const itemUrl = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${numericId})`;
    let request = await this.buildWriteRequest(patch);

    await this.spFetch(itemUrl);
    if (!Object.keys(request).length) {
      const unchanged = await this.getById(numericId, { selectMode: 'detail' });
      if (!unchanged) {
        throw new Error(`Unable to load record for id ${numericId}`);
      }
      return unchanged;
    }

    for (let attempt = 0; attempt < MAX_WRITE_RETRY; attempt += 1) {
      try {
        await this.spFetch(itemUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=nometadata',
            'Accept': 'application/json;odata=nometadata',
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*',
          },
          body: JSON.stringify(request),
        });
        break;
      } catch (error) {
        const retryField = this.resolveRetryField(error, request);
        if (!retryField) {
          throw error;
        }
        usersUnsupportedWriteFields.add(retryField);
        request = this.removeField(request, retryField);
        auditLog.warn('users', 'rest_api_repo.terminate_retry_without_field', {
          field: retryField,
          id: numericId,
          attempt: attempt + 1,
          error: String(error),
        });
        if (!Object.keys(request).length) {
          break;
        }
        if (attempt === MAX_WRITE_RETRY - 1) {
          throw error;
        }
      }
    }

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
    return this.spFetchInternal(path, init);
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
      const msg = (error.message ?? '').toLowerCase();
      return (
        msg.includes('does not exist') ||
        msg.includes('property') ||
        msg.includes('column') ||
        msg.includes('field') ||
        msg.includes('invalidclientqueryexception') ||
        msg.includes('$select') ||
        (msg.includes('query') && msg.includes('invalid')) ||
        (msg.includes('expression') && msg.includes('not valid')) ||
        msg.includes('存在しません') ||
        msg.includes('フィールド') ||
        msg.includes('プロパティ') ||
        (msg.includes('クエリ') && msg.includes('無効')) ||
        (msg.includes('式') && msg.includes('無効'))
      );
    }
    return false;
  }

  private isLikelySelectQueryFailure(error: unknown, path: string): boolean {
    if (!path.includes('$select=')) {
      return false;
    }
    const status = this.extractErrorStatus(error);
    return status === 400;
  }

  private extractErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') {
      return null;
    }
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && Number.isFinite(status)) {
      return status;
    }
    return null;
  }

  private isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = (error.message ?? '').toLowerCase();
    return msg.includes('404') || msg.includes('not found');
  }

  private async buildWriteRequest(
    dto: Partial<IUserMasterCreateDto>,
  ): Promise<Record<string, unknown>> {
    const requiresTransportSchedule = dto.TransportSchedule !== undefined;
    const filtered = this.filterUnsupportedWriteFields(this.toRequest(dto));
    if (requiresTransportSchedule && !(TRANSPORT_SCHEDULE_FIELD in filtered)) {
      throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
    }
    const writableFields = await this.getWritableFieldSet();
    if (!writableFields) {
      return filtered;
    }
    if (requiresTransportSchedule && !writableFields.has(TRANSPORT_SCHEDULE_FIELD)) {
      throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
    }
    const removed: string[] = [];
    const request: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filtered)) {
      if (writableFields.has(key)) {
        request[key] = value;
      } else {
        removed.push(key);
        usersUnsupportedWriteFields.add(key);
      }
    }
    if (removed.length) {
      auditLog.warn('users', 'rest_api_repo.drop_nonexistent_fields', {
        fields: removed,
      });
    }
    if (requiresTransportSchedule && !(TRANSPORT_SCHEDULE_FIELD in request)) {
      throw new Error(MISSING_TRANSPORT_SCHEDULE_COLUMN_ERROR);
    }
    return request;
  }

  private async getWritableFieldSet(): Promise<Set<string> | null> {
    if (usersWritableFieldSet) {
      return usersWritableFieldSet;
    }
    if (usersWritableFieldSetLoaded) {
      return null;
    }
    usersWritableFieldSetLoaded = true;
    const path = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/fields?$select=InternalName,ReadOnlyField,Hidden`;
    try {
      const res = await this.spFetch(path);
      const json = (await res.json()) as SpFieldsResponse;
      const rows = json.value ?? json.d?.results ?? [];
      const next = new Set<string>();
      for (const row of rows) {
        const name = row.InternalName?.trim();
        if (!name) continue;
        const isReadOnly = row.ReadOnlyField === true;
        const isHidden = row.Hidden === true;
        if (!isReadOnly && !isHidden) {
          next.add(name);
        }
      }
      if (next.size) {
        usersWritableFieldSet = next;
      }
      return usersWritableFieldSet;
    } catch (error) {
      auditLog.warn('users', 'rest_api_repo.load_writable_fields_failed', {
        error: String(error),
      });
      return null;
    }
  }

  private selectDisableCacheKey(): string {
    return `${USERS_SELECT_DISABLE_CACHE_KEY_PREFIX}${this.listTitle}`;
  }

  private isSelectDisabledByCache(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      return window.localStorage.getItem(this.selectDisableCacheKey()) === '1';
    } catch {
      return false;
    }
  }

  private persistSelectDisabled(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(this.selectDisableCacheKey(), '1');
    } catch {
      // ignore cache write errors
    }
  }

  private disableSelectOptimization(): void {
    usersSelectSupported = false;
    this.persistSelectDisabled();
  }

  private filterUnsupportedWriteFields(
    request: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!usersUnsupportedWriteFields.size) {
      return request;
    }
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request)) {
      if (!usersUnsupportedWriteFields.has(key)) {
        next[key] = value;
      }
    }
    return next;
  }

  private removeField(
    request: Record<string, unknown>,
    field: string,
  ): Record<string, unknown> {
    if (!field) {
      return request;
    }
    if (!(field in request)) {
      return request;
    }
    const next = { ...request };
    delete next[field];
    return next;
  }

  private extractUnsupportedWriteField(error: unknown): string | null {
    if (!this.isSelectError(error)) {
      return null;
    }
    if (!(error instanceof Error)) {
      return null;
    }
    const message = error.message ?? '';
    const match = message.match(/'([^']+)'/);
    const field = match?.[1]?.trim();
    return field || null;
  }

  private resolveRetryField(
    error: unknown,
    request: Record<string, unknown>,
  ): string | null {
    if (!this.isSelectError(error)) {
      return null;
    }
    const fromMessage = this.extractUnsupportedWriteField(error);
    if (fromMessage && fromMessage in request) {
      return fromMessage;
    }
    return null;
  }

  private isTransportScheduleMissingError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const msg = (error.message ?? '').toLowerCase();
    return msg.includes('transportschedule') && this.isSelectError(error);
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
      TransportCourse: get<string | null>(fields.transportCourse) ?? null,
      TransportSchedule: get<string | null>(fields.transportSchedule) ?? null,
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

    const normalized = toDomainUser(domain);

    try {
      userMasterSchema.parse(normalized);
    } catch (error) {
      auditLog.warn('users', 'rest_api_repo.domain_validation_failed', { 
        error: String(error), 
        domainId: normalized.Id 
      });
    }

    return normalized;
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
    if (dto.TransportCourse !== undefined)
      assign('transportCourse', dto.TransportCourse);
    if (dto.TransportSchedule !== undefined)
      assign('transportSchedule', dto.TransportSchedule);
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
