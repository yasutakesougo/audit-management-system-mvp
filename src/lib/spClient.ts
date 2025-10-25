// --- baseUrl/resource/siteRel の一貫性チェック ---
function assertUrlConsistency({ baseUrl, resource, siteRel }: { baseUrl: string; resource?: string; siteRel?: string }) {
  try {
    const b = new URL(baseUrl);
    if (resource) {
      const r = new URL(resource);
      if (b.origin !== r.origin) {
        throw new Error(`SP origin mismatch: baseUrl=${b.origin} resource=${r.origin}`);
      }
    }
    if (siteRel && !b.pathname.startsWith(siteRel.replace(/\/+$/, ''))) {
      throw new Error(`SP siteRel mismatch: baseUrl.path=${b.pathname} siteRel=${siteRel}`);
    }
  } catch (err) {
    // 入力値を一部マスクしてロギング
    const mask = (s?: string) => s ? s.replace(/([\w-]{4})[\w-]+/, '$1***') : '';
    // eslint-disable-next-line no-console
    console.error('[spClient.assertUrlConsistency] failed:', { baseUrl: mask(baseUrl), resource: mask(resource), siteRel });
    throw err;
  }
}
// --- SharePoint baseUrl 正規化ユーティリティ ---
export function normalizeBaseUrl(input: {
  baseUrl?: string;
  resource?: string;
  siteRel?: string;
}): string {
  let { baseUrl, resource, siteRel } = input;
  const trim = (s?: string) => (s ?? '').trim();

  baseUrl = trim(baseUrl);
  resource = trim(resource).replace(/\/+$/, ''); // 末尾スラッシュ除去
  siteRel = trim(siteRel);
  if (siteRel && !siteRel.startsWith('/')) siteRel = '/' + siteRel;

  // 1) baseUrl が不正（空 or /_api/web など相対）なら組み立て直す
  const isBad = !baseUrl || baseUrl === '/_api/web' || baseUrl.startsWith('/');

  if (isBad) {
    if (resource) {
      baseUrl = resource + (siteRel || '');
    } else if (typeof window !== 'undefined' && window.location?.origin) {
      // SharePoint ページ直下で動く場合の最終フォールバック
      baseUrl = window.location.origin + (siteRel || '');
    }
  }

  // 最終チェック：絶対 URL 必須
  try {
    // ここで throw されなければ絶対URL
    const u = new URL(baseUrl!);
    // 末尾の / を消しておく
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch {
    throw new Error(`Invalid or missing SharePoint baseUrl after normalize: "${baseUrl}"`);
  }
}
// Removed duplicate import
/* eslint-disable @typescript-eslint/no-explicit-any */
// NOTE: Avoid path alias here to keep ts-jest / vitest resolution simple without extra config
import { useMemo } from 'react';
import { useAuth } from '../auth/useAuth';
import { getRuntimeEnv as getRuntimeEnvRoot } from '../env';
import { auditLog } from './debugLogger';
import { getEnv, readBool, readString } from './env';
import { SharePointItemNotFoundError, SharePointMissingEtagError } from './errors';

// (The above code was stray and not inside a function. If this was meant to be a function, please define it below. Otherwise, this block is removed to fix the syntax error.)

const DEFAULT_LIST_TEMPLATE = 100;

type JsonRecord = Record<string, unknown>;

export type SharePointBatchOperation =
  | {
      kind: 'create';
      list: string;
      body: JsonRecord;
      headers?: Record<string, string>;
    }
  | {
      kind: 'update';
      list: string;
      id: number;
      body: JsonRecord;
      etag?: string;
      method?: 'PATCH' | 'MERGE';
      headers?: Record<string, string>;
    }
  | {
      kind: 'delete';
      list: string;
      id: number;
      etag?: string;
      headers?: Record<string, string>;
    };

export type SharePointBatchResult<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T | string;
};

type RetryReason = 'throttle' | 'timeout' | 'server';

export type SharePointRetryMeta = {
  attempt: number;
  status?: number;
  reason: RetryReason;
  delayMs: number;
};

export interface SpClientOptions {
  onRetry?: (response: Response, meta: SharePointRetryMeta) => void;
}

type SpFieldType =
  | 'Text'
  | 'Note'
  | 'Choice'
  | 'MultiChoice'
  | 'Number'
  | 'Boolean'
  | 'Lookup'
  | 'DateTime'
  | 'Currency';

export interface SpFieldDef {
  internalName: string;
  type: SpFieldType;
  displayName?: string;
  description?: string;
  required?: boolean;
  choices?: readonly string[];
  default?: string | number | boolean;
  lookupListId?: string;
  lookupFieldName?: string;
  allowMultiple?: boolean;
  dateTimeFormat?: 'DateOnly' | 'DateTime';
  richText?: boolean;
  addToDefaultView?: boolean;
}

interface EnsureListOptions {
  baseTemplate?: number;
}

interface ExistingFieldShape {
  InternalName: string;
  TypeAsString?: string;
  Required?: boolean;
}

interface EnsureListResult {
  listId: string;
  title: string;
}

interface SharePointListMetadata {
  Id?: string;
  Title?: string;
  d?: {
    Id?: string;
    Title?: string;
  };
}

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const trimGuidBraces = (value: string): string => value.replace(/[{}]/g, '').trim();
const withGuidBraces = (value: string): string => {
  const trimmed = trimGuidBraces(value);
  return trimmed ? `{${trimmed}}` : '';
};

type E2eDebugWindow = Window & {
  __E2E_BATCH_URL__?: string;
  __E2E_BATCH_ATTEMPTS__?: number;
};

const buildFieldSchema = (def: SpFieldDef): string => {
  const attributes: string[] = [];
  const addAttr = (key: string, raw: string | number | boolean | undefined) => {
    if (raw === undefined || raw === null || raw === '') return;
    const value = typeof raw === 'boolean' ? (raw ? 'TRUE' : 'FALSE') : String(raw);
    attributes.push(`${key}="${escapeXml(value)}"`);
  };

  addAttr('Name', def.internalName);
  addAttr('StaticName', def.internalName);
  addAttr('DisplayName', def.displayName ?? def.internalName);
  addAttr('Type', def.type);
  if (def.required) addAttr('Required', 'TRUE');
  if (def.richText) addAttr('RichText', 'TRUE');
  if (def.dateTimeFormat) addAttr('Format', def.dateTimeFormat);
  if (def.type === 'Lookup') {
    if (def.lookupListId) addAttr('List', withGuidBraces(def.lookupListId));
    addAttr('ShowField', def.lookupFieldName ?? 'Title');
    if (def.allowMultiple) addAttr('Mult', 'TRUE');
  } else if (def.allowMultiple) {
    addAttr('Mult', 'TRUE');
  }

  if (def.type === 'Boolean' && typeof def.default === 'boolean') {
    addAttr('Default', def.default ? '1' : '0');
  }

  const inner: string[] = [];
  if (def.description) {
    inner.push(`<Description>${escapeXml(def.description)}</Description>`);
  }
  if ((def.type === 'Choice' || def.type === 'MultiChoice') && def.choices?.length) {
    const choiceXml = def.choices.map((choice) => `<CHOICE>${escapeXml(choice)}</CHOICE>`).join('');
    inner.push(`<CHOICES>${choiceXml}</CHOICES>`);
    if (def.default && typeof def.default === 'string') {
      inner.push(`<Default>${escapeXml(def.default)}</Default>`);
    }
  } else if (def.default !== undefined && def.type !== 'Boolean') {
    inner.push(`<Default>${escapeXml(String(def.default))}</Default>`);
  }

  const attrs = attributes.join(' ');
  const body = inner.join('');
  return `<Field ${attrs}>${body}</Field>`;
};

const sanitizeEnvValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const DEFAULT_STAFF_LIST_TITLE = 'Staff_Master';

const USERS_BASE_FIELDS = ['Id', 'UserID', 'FullName', 'ContractDate', 'IsHighIntensitySupportTarget', 'ServiceStartDate', 'ServiceEndDate'] as const;
const USERS_OPTIONAL_FIELDS = ['FullNameKana', 'Furigana', 'Email', 'Phone', 'BirthDate'] as const;

const STAFF_BASE_FIELDS = ['Id', 'StaffID', 'StaffName', 'Role', 'Phone', 'Email'] as const;
const STAFF_OPTIONAL_FIELDS = ['StaffID', 'AttendanceDays', 'Certifications', 'Department', 'Notes'] as const;

const missingOptionalFieldsCache = new Map<string, Set<string>>();

const getMissingSet = (listTitle: string): Set<string> => {
  let current = missingOptionalFieldsCache.get(listTitle);
  if (!current) {
    current = new Set<string>();
    missingOptionalFieldsCache.set(listTitle, current);
  }
  return current;
};

const markOptionalMissing = (listTitle: string, field: string) => {
  if (!field) return;
  getMissingSet(listTitle).add(field);
};

const extractMissingField = (message: string): string | null => {
  const match = message.match(/'([^']+)'/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

const buildSelectFields = (baseFields: readonly string[], optionalFields: readonly string[], missing: Set<string>): string[] => {
  const base = baseFields.filter((field) => !missing.has(field));
  const optional = optionalFields.filter((field) => !missing.has(field));
  const merged = [...base, ...optional];
  return Array.from(new Set(merged));
};

const buildListItemsPath = (listTitle: string, select: string[], top: number): string => {
  const queryParts: string[] = [];
  if (select.length) queryParts.push(`$select=${select.join(',')}`);
  if (Number.isFinite(top) && top > 0) queryParts.push(`$top=${top}`);
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const guidCandidate = trimGuidBraces(listTitle);
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')/items${query}`;
  }
  return `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items${query}`;
};

const resolveListPath = (identifier: string): string => {
  const raw = (identifier ?? '').trim();
  if (!raw) {
    throw new Error('SharePoint list identifier is required');
  }
  if (/^\//.test(raw)) {
    return raw;
  }
  if (/^(lists|web)\//i.test(raw) || /^lists\(/i.test(raw)) {
    return `/${raw}`;
  }
  const guidCandidate = trimGuidBraces(raw);
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')`;
  }
  return `/lists/getbytitle('${encodeURIComponent(raw)}')`;
};

const buildItemPath = (identifier: string, id?: number, select?: string[]): string => {
  const base = resolveListPath(identifier);
  const suffix = typeof id === 'number' ? `/items(${id})` : '/items';
  const params = new URLSearchParams();
  if (select?.length) {
    params.append('$select', select.join(','));
  }
  const query = params.toString();
  return query ? `${base}${suffix}?${query}` : `${base}${suffix}`;
};

const readErrorPayload = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: { value?: string } };
      'odata.error'?: { message?: { value?: string } };
      message?: { value?: string };
    };
    return (
      data.error?.message?.value ??
      data['odata.error']?.message?.value ??
      data.message?.value ??
      text
    );
  } catch {
    return text;
  }
};

const raiseHttpError = async (res: Response): Promise<never> => {
  const detail = await readErrorPayload(res);
  const base = `APIリクエストに失敗しました (${res.status} ${res.statusText ?? ''})`;
  const error: Error & { status?: number; statusText?: string } = new Error(detail || base);
  error.status = res.status;
  if (res.statusText) {
    error.statusText = res.statusText;
  }
  throw error;
};

const fetchListItemsWithFallback = async <TRow>(
  client: Pick<ReturnType<typeof createSpClient>, 'spFetch'>,
  listTitle: string,
  baseFields: readonly string[],
  optionalFields: readonly string[],
  top: number
): Promise<TRow[]> => {
  const missing = getMissingSet(listTitle);
  let select = buildSelectFields(baseFields, optionalFields, missing);
  const maxAttempts = optionalFields.length + 2;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const path = buildListItemsPath(listTitle, select, top);
      const res = await client.spFetch(path);
      const json = (!res || typeof (res as Response | { json?: unknown }).json !== 'function')
        ? ({ value: [] } as { value?: TRow[] })
        : await (res as Response).json().catch(() => ({ value: [] })) as { value?: TRow[] };
      return (json.value ?? []) as TRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingField = extractMissingField(message);
      if (missingField) {
        markOptionalMissing(listTitle, missingField);
      } else {
        const remaining = optionalFields.filter((field) => !getMissingSet(listTitle).has(field));
        const fallbackField = remaining.pop();
        if (!fallbackField) {
          throw error;
        }
        markOptionalMissing(listTitle, fallbackField);
      }
      select = buildSelectFields(baseFields, optionalFields, getMissingSet(listTitle));
    }
  }
  const finalPath = buildListItemsPath(listTitle, select, top);
  throw new Error(`Failed to fetch list "${listTitle}" after optional field retries. Last query: ${finalPath}`);
};

type StaffIdentifier = { type: 'guid' | 'title'; value: string };

const resolveStaffListIdentifier = (titleOverride: string, guidOverride: string): StaffIdentifier => {
  const normalizedGuid = trimGuidBraces(guidOverride);
  if (normalizedGuid) {
    return { type: 'guid', value: normalizedGuid };
  }
  const trimmedTitle = titleOverride.trim();
  if (/^guid:/i.test(trimmedTitle)) {
    const candidate = trimGuidBraces(trimmedTitle.replace(/^guid:/i, ''));
    if (candidate) return { type: 'guid', value: candidate };
  }
  if (trimmedTitle) {
    return { type: 'title', value: trimmedTitle };
  }
  return { type: 'title', value: DEFAULT_STAFF_LIST_TITLE };
};

/**
 * テスト可能なクライアントファクトリ（React Hook に依存しない）
 * - acquireToken: トークン取得関数（MSAL由来を想定）
 * - baseUrl: 例) https://contoso.sharepoint.com/sites/Audit/_api/web
 */
export function createSpClient(
  acquireToken: () => Promise<string | null>,
  baseUrl: string,
  options: SpClientOptions = {},
  resource?: string,
  siteRel?: string
) {
  // getAppConfig is not used anymore; use getEnv() or readString/readBool directly
  const parsePositiveNumber = (raw: string, fallback: number): number => {
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  };
  // getEnv, readString, readBool are already imported at the top
  const retrySettings = {
    maxAttempts: parsePositiveNumber(readString('VITE_SP_RETRY_MAX', '4'), 4),
    baseDelay: parsePositiveNumber(readString('VITE_SP_RETRY_BASE_MS', '400'), 400),
    capDelay: parsePositiveNumber(readString('VITE_SP_RETRY_MAX_DELAY_MS', '5000'), 5000),
  } as const;
  const debugEnabled = readBool('VITE_AUDIT_DEBUG', false);
  function dbg(...a: unknown[]) { if (debugEnabled) console.debug('[spClient]', ...a); }
  const tokenMetricsCarrier = globalThis as { __TOKEN_METRICS__?: Record<string, unknown> };
  const { onRetry } = options;
  // --- 正規化: baseUrl/resource/siteRel を絶対URLに ---
  const normalizedBase = normalizeBaseUrl({ baseUrl, resource, siteRel });
  assertUrlConsistency({ baseUrl: normalizedBase, resource, siteRel });
  const baseUrlInfo = new URL(normalizedBase);
  const normalizePath = (value: string): string => {
    if (!value) return value;
    if (/^https?:\/\//i.test(value)) {
      try {
        const target = new URL(value);
        if (target.origin === baseUrlInfo.origin) {
          const basePath = baseUrlInfo.pathname.replace(/\/+$|$/u, '');
          const fullPath = `${target.pathname}${target.search}`;
          if (fullPath.startsWith(basePath)) {
            const slice = fullPath.slice(basePath.length);
            return slice.startsWith('/') ? slice : `/${slice}`;
          }
          return `${target.pathname}${target.search}`;
        }
        return value;
      } catch {
        return value;
      }
    }
    return value.startsWith('/') ? value : `/${value}`;
  };
  const classifyRetry = (status: number): RetryReason | null => {
    if (status === 408) return 'timeout';
    if (status === 429) return 'throttle';
    if ([500, 502, 503, 504].includes(status)) return 'server';
    return null;
  };

  type ListItemsOptions = {
    select?: string[];
    filter?: string;
    orderby?: string;
    expand?: string;
    top?: number;
    pageCap?: number;
    signal?: AbortSignal;
  };

  const spFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const resolvedPath = normalizePath(path);

  const isVitest = readBool('VITEST', false);

    // 開発環境でのモック応答
  if (getEnv().NODE_ENV === 'development' && !isVitest) {
      console.info(`[DevMock] SharePoint API モック: ${init.method || 'GET'} ${resolvedPath}`);

      // モックレスポンスを作成
      const mockResponse = (data: any, status = 200) => {
        const response = new Response(JSON.stringify(data), {
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return Promise.resolve(response);
      };

      // パスに応じたモックデータ
      if (resolvedPath.includes('/currentuser')) {
        return mockResponse({ Id: 1, Title: 'Development User' });
      }

      if (resolvedPath.includes('/lists/getbytitle') && resolvedPath.includes('/items')) {
        // スケジュールリストのモック（空データ）
        return mockResponse({ value: [] });
      }

      if (resolvedPath.includes('/lists')) {
        // その他のリストのモック
        return mockResponse({ value: [] });
      }

      // デフォルトの空レスポンス
      return mockResponse({ value: [] });
    }

    const token1 = await acquireToken();
    if (debugEnabled && tokenMetricsCarrier.__TOKEN_METRICS__) {
      dbg('token metrics snapshot', tokenMetricsCarrier.__TOKEN_METRICS__);
    }
    if (!token1) {
      throw new Error([
        'SharePoint のアクセストークン取得に失敗しました。',
        '対処:',
        ' - 右上からサインイン',
        ' - Entra で SharePoint 委任権限 (AllSites.Read/Manage) に管理者同意',
        ' - `.env` の VITE_SP_RESOURCE / VITE_SP_SITE_RELATIVE を確認'
      ].join('\n'));
    }

    const resolveUrl = (targetPath: string) => (/^https?:\/\//i.test(targetPath) ? targetPath : `${baseUrl}${targetPath}`);
    const doFetch = async (token: string) => {
      const url = resolveUrl(resolvedPath);
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json;odata=nometadata');
      if (init.method === 'POST' || init.method === 'PUT' || init.method === 'PATCH' || init.method === 'MERGE') {
        headers.set('Content-Type', 'application/json;odata=nometadata');
      }
      if (import.meta.env.DEV) {
        console.debug('[SPFetch]', init.method || 'GET', url);
      }
      return fetch(url, { ...init, headers });
    };

    let response = await doFetch(token1);

    // Retry transient (throttle/server) BEFORE auth refresh, but only if not 401/403.
    const maxAttempts = retrySettings.maxAttempts;
    const baseDelay = retrySettings.baseDelay;
    const capDelay = retrySettings.capDelay;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const computeDelay = (attempt: number, res: Response): number => {
      const ra = res.headers.get('Retry-After');
      if (ra) {
        const sec = Number(ra);
        if (!Number.isNaN(sec) && sec > 0) {
          return Math.max(0, Math.round(sec * 1000));
        }
        const ts = Date.parse(ra);
        if (!Number.isNaN(ts)) {
          return Math.max(0, ts - Date.now());
        }
      }
      const expo = Math.min(capDelay, baseDelay * Math.pow(2, attempt - 1));
      const jitter = Math.random() * expo;
      return Math.max(0, Math.round(jitter));
    };

    let attempt = 1;
    while (!response.ok && attempt < maxAttempts) {
      const reason = classifyRetry(response.status);
      if (!reason) break;
      const delayMs = computeDelay(attempt, response);
      if (onRetry) {
        try {
          onRetry(response, { attempt, status: response.status, reason, delayMs });
        } catch (error) {
          if (debugEnabled) console.warn('[spClient] onRetry callback failed', error);
        }
      }
      auditLog.debug('sp:retry', { attempt, status: response.status, reason, delayMs });
      if (debugEnabled) {
        console.warn('[spRetry]', JSON.stringify({ phase: 'single', status: response.status, nextAttempt: attempt + 1, waitMs: delayMs }));
      }
      if (delayMs > 0) {
        await sleep(delayMs);
      } else {
        await Promise.resolve();
      }
      attempt += 1;
      response = await doFetch(token1);
    }

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const token2 = await acquireToken();
      if (token2 && token2 !== token1) {
        response = await doFetch(token2);
      }
    }

    if (!response.ok) {
      await raiseHttpError(response);
    }
    return response;
  };

  const getListItemsByTitle = async <T>(
    listTitle: string,
    select?: string[],
    filter?: string,
    orderby?: string,
    top: number = 500,
    signal?: AbortSignal
  ): Promise<T[]> => {
    const params = new URLSearchParams();
    if (select?.length) params.append('$select', select.join(','));
    if (filter) params.append('$filter', filter);
    if (orderby) params.append('$orderby', orderby);
    params.append('$top', String(top));
    const path = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${params.toString()}`;
    const res = await spFetch(path, signal ? { signal } : undefined);
    const data = await res.json();
    return data.value || [];
  };

  const listItems = async <TRow = JsonRecord>(
    listIdentifier: string,
    options: ListItemsOptions = {}
  ): Promise<TRow[]> => {
    const { select, filter, orderby, expand, top = 100, pageCap, signal } = options;
    const params = new URLSearchParams();
    if (select?.length) params.append('$select', select.join(','));
    if (filter) params.append('$filter', filter);
    if (orderby) params.append('$orderby', orderby);
    if (expand) params.append('$expand', expand);
    params.append('$top', String(top));
    const basePath = resolveListPath(listIdentifier);
    const query = params.toString();
    const initialPath = query ? `${basePath}/items?${query}` : `${basePath}/items`;
    const rows: TRow[] = [];
    let nextPath: string | null = initialPath;
    let pages = 0;
    const maxPages = typeof pageCap === 'number' && pageCap > 0 ? Math.floor(pageCap) : Number.POSITIVE_INFINITY;

    while (nextPath && pages < maxPages) {
      const res = await spFetch(nextPath, signal ? { signal } : {});
      const payload = await res.json().catch(() => ({}) as Record<string, unknown>) as {
        value?: unknown[];
        '@odata.nextLink'?: string;
        nextLink?: string;
      };
      const batch = (Array.isArray(payload.value) ? payload.value : []) as TRow[];
      rows.push(...batch);
      pages += 1;
      const nextLinkRaw = typeof payload['@odata.nextLink'] === 'string'
        ? payload['@odata.nextLink']
        : typeof payload.nextLink === 'string'
          ? payload.nextLink
          : null;
      if (!nextLinkRaw) {
        nextPath = null;
        continue;
      }
      nextPath = normalizePath(nextLinkRaw);
    }

    return rows;
  };

  const addListItemByTitle = async <TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody
  ): Promise<TResult> => {
    const path = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
    const res = await spFetch(path, { method: 'POST', body: JSON.stringify(body) });
    return await res.json() as TResult;
  };
  const addItemByTitle = addListItemByTitle;

  const coerceResult = async <TResult>(res: Response): Promise<TResult> => {
    if (res.status === 204) {
      return undefined as unknown as TResult;
    }
    const contentLength = res.headers.get('Content-Length');
    if (contentLength === '0') {
      return undefined as unknown as TResult;
    }
    const contentType = res.headers.get('Content-Type') ?? '';
    if (!/json/i.test(contentType)) {
      return undefined as unknown as TResult;
    }
    const text = await res.text();
    if (!text) {
      return undefined as unknown as TResult;
    }
    try {
      return JSON.parse(text) as TResult;
    } catch {
      return undefined as unknown as TResult;
    }
  };

  const patchListItem = async <TBody extends object>(
    listIdentifier: string,
    id: number,
    body: TBody,
    ifMatch?: string
  ): Promise<Response> => {
    const itemPath = buildItemPath(listIdentifier, id);
    const payload = JSON.stringify(body);
    const attempt = async (etag: string | undefined): Promise<Response | null> => {
      try {
        return await spFetch(itemPath, {
          method: 'PATCH',
          headers: {
            'If-Match': etag ?? '*',
            'OData-Version': '4.0',
            'Content-Type': 'application/json;odata=nometadata',
          },
          body: payload,
        });
      } catch (error) {
        if ((error as { status?: number }).status === 412) {
          return null;
        }
        throw error;
      }
    };

    const first = await attempt(ifMatch);
    if (first) return first;

    let latest: Response;
    try {
      latest = await spFetch(buildItemPath(listIdentifier, id, ['Id']), { method: 'GET' });
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
  throw new SharePointItemNotFoundError();
      }
      throw error;
    }
    const refreshedEtag = latest.headers.get('ETag');
    if (!refreshedEtag) {
  throw new SharePointMissingEtagError();
    }

  const second = await attempt(refreshedEtag);
    if (second) return second;
  throw new SharePointMissingEtagError('SharePoint returned 412 after refreshing ETag');
  };

  const updateItemByTitle = async <TBody extends object, TResult = unknown>(
    listTitle: string,
    id: number,
    body: TBody,
    options?: { ifMatch?: string }
  ): Promise<TResult> => {
    const res = await patchListItem<TBody>(listTitle, id, body, options?.ifMatch);
    return coerceResult<TResult>(res);
  };

  const deleteItemByTitle = async (listTitle: string, id: number): Promise<void> => {
    const path = buildItemPath(listTitle, id);
    await spFetch(path, {
      method: 'DELETE',
      headers: {
        'If-Match': '*',
      },
    });
  };

  const getItemById = async <T>(
    listTitle: string,
    id: number,
    select: string[] = [],
    signal?: AbortSignal
  ): Promise<T> => {
    const path = buildItemPath(listTitle, id, select);
    const res = await spFetch(path, signal ? { signal } : undefined);
    return (await res.json()) as T;
  };

  const getItemByIdWithEtag = async <T>(
    listTitle: string,
    id: number,
    select: string[] = [],
    signal?: AbortSignal
  ): Promise<{ item: T; etag: string | null }> => {
    const path = buildItemPath(listTitle, id, select);
    const res = await spFetch(path, signal ? { signal } : undefined);
    const item = (await res.json()) as T;
    const etag = res.headers.get('ETag');
    return { item, etag };
  };

  const createItem = async <TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody
  ): Promise<TResult> => {
    const path = buildItemPath(listTitle);
    const res = await spFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return coerceResult<TResult>(res);
  };

  const updateItem = async <TBody extends object, TResult = unknown>(
    listIdentifier: string,
    id: number,
    body: TBody,
    options?: { ifMatch?: string }
  ): Promise<TResult> => {
    const res = await patchListItem<TBody>(listIdentifier, id, body, options?.ifMatch);
    return coerceResult<TResult>(res);
  };

  const deleteItem = async (listIdentifier: string, id: number): Promise<void> => {
    const path = buildItemPath(listIdentifier, id);
    await spFetch(path, {
      method: 'DELETE',
      headers: { 'If-Match': '*' },
    });
  };

  const tryGetListMetadata = async (listTitle: string): Promise<EnsureListResult | null> => {
    const encoded = encodeURIComponent(listTitle);
    const path = `/lists/getbytitle('${encoded}')?$select=Id,Title`;
    try {
  const res = await spFetch(path);
  const json = (await res.json().catch(() => ({}))) as SharePointListMetadata;
  const nested = json.d ?? {};
  const rawId = typeof json.Id === 'string' ? json.Id : (typeof nested.Id === 'string' ? nested.Id : '');
  const rawTitle = typeof json.Title === 'string' ? json.Title : (typeof nested.Title === 'string' ? nested.Title : '');
      return {
        listId: trimGuidBraces(rawId),
        title: rawTitle || listTitle,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/\b404\b/.test(message) || /Not Found/i.test(message) || /does not exist/i.test(message)) {
        return null;
      }
      throw error;
    }
  };

  const fetchExistingFields = async (listTitle: string): Promise<Map<string, ExistingFieldShape>> => {
    const encoded = encodeURIComponent(listTitle);
    const path = `/lists/getbytitle('${encoded}')/fields?$select=InternalName,TypeAsString,Required`;
    const res = await spFetch(path);
    const json = (await res.json().catch(() => ({ value: [] }))) as { value?: ExistingFieldShape[] };
    const map = new Map<string, ExistingFieldShape>();
    for (const row of json.value ?? []) {
      if (!row || typeof row.InternalName !== 'string') continue;
      map.set(row.InternalName, row);
    }
    return map;
  };

  const addFieldToList = async (listTitle: string, field: SpFieldDef) => {
    const encoded = encodeURIComponent(listTitle);
    const schema = buildFieldSchema(field);
    const body = {
      parameters: {
        SchemaXml: schema,
        AddToDefaultView: field.addToDefaultView ?? false,
      },
    };
    await spFetch(`/lists/getbytitle('${encoded}')/fields/createfieldasxml`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  const ensureListExists = async (
    listTitle: string,
    fields: SpFieldDef[],
    options: EnsureListOptions = {}
  ): Promise<EnsureListResult> => {
    const baseTemplate = options.baseTemplate ?? DEFAULT_LIST_TEMPLATE;
    let ensured = await tryGetListMetadata(listTitle);
    if (!ensured) {
      const createBody = {
        __metadata: { type: 'SP.List' },
        BaseTemplate: baseTemplate,
        Title: listTitle,
      };
  const res = await spFetch('/lists', { method: 'POST', body: JSON.stringify(createBody) });
  const json = (await res.json().catch(() => ({}))) as SharePointListMetadata;
  const nested = json.d ?? {};
  const rawId = typeof json.Id === 'string' ? json.Id : (typeof nested.Id === 'string' ? nested.Id : '');
  const rawTitle = typeof json.Title === 'string' ? json.Title : (typeof nested.Title === 'string' ? nested.Title : '');
      ensured = {
        listId: trimGuidBraces(rawId),
        title: rawTitle || listTitle,
      };
    }

    if (fields.length) {
      const existing = await fetchExistingFields(listTitle);
      for (const field of fields) {
        const current = existing.get(field.internalName);
        if (current) {
          if (field.required && current.Required === false) {
            const currentLabel = current.Required ? 'TRUE' : 'FALSE';
            console.warn(`[spClient] Field "${field.internalName}" required flag differs (current=${currentLabel}).`);
          }
          continue;
        }
        await addFieldToList(listTitle, field);
      }
    }

    return ensured ?? { listId: '', title: listTitle };
  };

  // $batch 投稿ヘルパー (429/503/504 リトライ対応)
  const postBatch = async (batchBody: string, boundary: string): Promise<Response> => {
    const apiRoot = baseUrl.replace(/\/web\/?$/, '');
    const maxAttempts = retrySettings.maxAttempts;
    const baseDelay = retrySettings.baseDelay;
    const capDelay = retrySettings.capDelay;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const computeBackoff = (attempt: number) => {
      const expo = Math.min(capDelay, baseDelay * Math.pow(2, attempt - 1));
      const jitter = Math.random() * expo; // full jitter
      return Math.round(jitter);
    };
    let attempt = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
      const token = await acquireToken();
      if (!token) throw new Error('SharePoint のアクセストークン取得に失敗しました。');
      const headers = new Headers({
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': `multipart/mixed; boundary=${boundary}`
      });
      const res = await fetch(`${apiRoot}/$batch`, { method: 'POST', headers, body: batchBody });
      // E2E instrumentation (non-production impact): expose attempt count & last URL for debugging
      if (typeof window !== 'undefined') {
        try {
          const e2eWindow = window as E2eDebugWindow;
          e2eWindow.__E2E_BATCH_URL__ = `${apiRoot}/$batch`;
          e2eWindow.__E2E_BATCH_ATTEMPTS__ = (e2eWindow.__E2E_BATCH_ATTEMPTS__ || 0) + 1;
        } catch {}
      }
      if (res.ok) return res;
      const shouldRetry = [429,503,504].includes(res.status) && attempt < maxAttempts;
      if (shouldRetry) {
        let waitMs: number | null = null;
        const ra = res.headers.get('Retry-After');
        if (ra) {
          const sec = Number(ra);
          if (!isNaN(sec) && sec > 0) {
            waitMs = sec * 1000;
          } else {
            const ts = Date.parse(ra);
            if (!isNaN(ts)) waitMs = Math.max(0, ts - Date.now());
          }
        }
        if (waitMs == null) waitMs = computeBackoff(attempt);
        if (debugEnabled) console.warn('[spRetry]', JSON.stringify({ phase: 'batch', status: res.status, nextAttempt: attempt + 1, waitMs }));
        await sleep(waitMs);
        attempt += 1;
        continue;
      }
      const text = await res.text();
      let msg = `Batch API に失敗しました (${res.status} ${res.statusText})`;
      try { const j = JSON.parse(text); msg = j['odata.error']?.message?.value || msg; } catch {}
      const guid = res.headers.get('sprequestguid') || res.headers.get('request-id');
      if (guid) msg += `\nSPRequestGuid: ${guid}`;
      throw new Error(msg);
    }
    throw new Error('Batch API が最大リトライ回数に達しました。');
  };

  const buildBatchPayload = (operations: SharePointBatchOperation[], boundary: string): string => {
    const lines: string[] = [];
    for (const operation of operations) {
      const method = operation.kind === 'create'
        ? 'POST'
        : operation.kind === 'update'
          ? (operation.method ?? 'PATCH')
          : 'DELETE';
      const targetPath = normalizePath(
        operation.kind === 'create'
          ? buildItemPath(operation.list)
          : buildItemPath(operation.list, operation.id)
      );
      const headers: Record<string, string> = {
        Accept: 'application/json;odata=nometadata',
        ...(operation.headers ?? {}),
      };
      if (method === 'POST' || method === 'PATCH' || method === 'MERGE') {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json;odata=nometadata';
      }
      if ((operation.kind === 'update' || operation.kind === 'delete') && !headers['If-Match']) {
        headers['If-Match'] = operation.etag ?? '*';
      }

      lines.push(`--${boundary}`);
      lines.push('Content-Type: application/http');
      lines.push('Content-Transfer-Encoding: binary');
      lines.push('');
      lines.push(`${method} ${targetPath} HTTP/1.1`);
      for (const [key, value] of Object.entries(headers)) {
        lines.push(`${key}: ${value}`);
      }
      lines.push('');
      if (operation.kind === 'create' || operation.kind === 'update') {
        lines.push(JSON.stringify(operation.body ?? {}));
        lines.push('');
      }
    }
    lines.push(`--${boundary}--`);
    lines.push('');
    return lines.join('\r\n');
  };

  const parseBatchResponse = (payload: string, boundary: string): SharePointBatchResult[] => {
    const results: SharePointBatchResult[] = [];
    const segments = payload.split(`--${boundary}`);
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed || trimmed === '--') continue;
      const httpIndex = trimmed.indexOf('HTTP/1.1');
      if (httpIndex === -1) continue;
      const httpPayload = trimmed.slice(httpIndex);
      const [statusLine] = httpPayload.split('\r\n');
      const statusMatch = /HTTP\/1\.1\s+(\d{3})/i.exec(statusLine ?? '');
      if (!statusMatch) continue;
      const status = Number(statusMatch[1]);
      const bodyIndex = httpPayload.indexOf('\r\n\r\n');
      const rawBody = bodyIndex >= 0 ? httpPayload.slice(bodyIndex + 4).trim() : '';
      let data: unknown;
      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = rawBody;
        }
      }
      results.push({ ok: status >= 200 && status < 300, status, data });
    }
    return results;
  };

  const batch = async (operations: SharePointBatchOperation[]): Promise<SharePointBatchResult[]> => {
    if (!operations.length) return [];
    const boundary = `batch_${Math.random().toString(36).slice(2)}`;
    const requestBody = buildBatchPayload(operations, boundary);
    const res = await postBatch(requestBody, boundary);
    const contentType = res.headers.get('Content-Type') ?? '';
    const match = /boundary=([^;]+)/i.exec(contentType);
    const responseBoundary = match ? match[1].trim() : boundary;
    const text = await res.text();
    return parseBatchResponse(text, responseBoundary);
  };

  return {
    spFetch,
    getListItemsByTitle,
    listItems,
    addListItemByTitle,
    addItemByTitle,
    updateItemByTitle,
    deleteItemByTitle,
    getItemById,
    getItemByIdWithEtag,
    createItem,
    updateItem,
    deleteItem,
    batch,
    postBatch,
    ensureListExists,
  };
}

type ListClient = Pick<ReturnType<typeof createSpClient>, 'spFetch'>;

const clampTop = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 100;
  const numeric = Number(value);
  if (!numeric || numeric < 1) return 1;
  if (numeric > 5000) return 5000;
  return Math.floor(numeric);
};

export async function getUsersMaster<TRow = Record<string, unknown>>(client: ListClient, top?: number): Promise<TRow[]> {
  const env = getRuntimeEnvRoot();
  const listTitle = sanitizeEnvValue(env.VITE_SP_LIST_USERS) || DEFAULT_USERS_LIST_TITLE;
  const rows = await fetchListItemsWithFallback<TRow>(
    client,
    listTitle,
    USERS_BASE_FIELDS,
    USERS_OPTIONAL_FIELDS,
    clampTop(top)
  );
  return rows;
}

export async function getStaffMaster<TRow = Record<string, unknown>>(client: ListClient, top?: number): Promise<TRow[]> {
  const env = getRuntimeEnvRoot();
  const listTitleCandidate = sanitizeEnvValue(env.VITE_SP_LIST_STAFF) || DEFAULT_STAFF_LIST_TITLE;
  const listGuidCandidate = sanitizeEnvValue(env.VITE_SP_LIST_STAFF_GUID);
  const identifier = resolveStaffListIdentifier(listTitleCandidate, listGuidCandidate);
  const listKey = identifier.type === 'guid' ? identifier.value : identifier.value;
  const rows = await fetchListItemsWithFallback<TRow>(
    client,
    listKey,
    STAFF_BASE_FIELDS,
    STAFF_OPTIONAL_FIELDS,
    clampTop(top)
  );
  return rows;
}

export const useSP = () => {
  const { acquireToken } = useAuth();
  const cfg = useMemo(() => {
    const env = getEnv();
    const rawResource = (env.VITE_SP_RESOURCE ?? '').trim();
    const rawSiteRel = (env.VITE_SP_SITE_RELATIVE ?? '').trim();
    const resourceCandidate = rawResource.replace(/\/+$|^\/+/, '');
    const resource = resourceCandidate;
    const siteRel0 = rawSiteRel.startsWith('/') ? rawSiteRel : `/${rawSiteRel}`;
    const siteRel = siteRel0.replace(/\/+$/, '');
    const baseUrl = `${resource}${siteRel}/_api/web`;
    // --- DEBUG: always print resolved values ---
    // 決定済みの値を“1行”で出す（コピペしやすく）
    // eslint-disable-next-line no-console
    console.log('[useSP] resource:', resource, 'siteRel:', siteRel, 'baseUrl:', baseUrl);
    return { resource, siteRel, baseUrl };
  }, []);
  // createSpClient に resource, siteRel も渡す
  const client = useMemo(
    () => createSpClient(acquireToken, cfg.baseUrl, {}, cfg.resource, cfg.siteRel),
    [acquireToken, cfg.baseUrl, cfg.resource, cfg.siteRel]
  );
  return client;
};

export async function createSchedule(_sp: UseSP, _payload: unknown): Promise<void> {
  // placeholder: real implementation will map payload to SharePoint list mutation
  return;
}

export const __ensureListInternals = { buildFieldSchema };

// test-only export (intentionally non-exported in production bundles usage scope)
export const __test__ = {
  // ensureConfig is now inlined above if needed
  resetMissingOptionalFieldsCache(): void {
    missingOptionalFieldsCache.clear();
  },
  resolveStaffListIdentifier,
};

// IDE 補完用に公開フック型を輸出
export type UseSP = ReturnType<typeof useSP>;
