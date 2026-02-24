/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { getRuntimeEnv as getRuntimeEnvRoot } from '@/env';
import type { UnifiedResourceEvent } from '@/features/resources/types';
import { auditLog } from '@/lib/debugLogger';
import { getAppConfig, isE2eMsalMockEnabled, readBool, readEnv, shouldSkipLogin, skipSharePoint, type EnvRecord } from '@/lib/env';
import { AuthRequiredError, SharePointItemNotFoundError, SharePointMissingEtagError } from './errors';

const FALLBACK_SP_RESOURCE = 'https://example.sharepoint.com';
const FALLBACK_SP_SITE_RELATIVE = '/sites/demo';

const shouldBypassSharePointConfig = (envOverride?: EnvRecord): boolean => {
  // Respect explicit SharePoint overrides even when test/demo flags are set
  if (envOverride && ('VITE_SP_RESOURCE' in envOverride || 'VITE_SP_SITE_RELATIVE' in envOverride || 'VITE_SP_SITE' in envOverride || 'VITE_SP_SITE_URL' in envOverride)) {
    return false;
  }

  // Force SharePoint even in E2E/mock contexts when explicitly requested (e.g., Playwright stub mode)
  if (readBool('VITE_FORCE_SHAREPOINT', false, envOverride)) {
    return false;
  }

  if (isE2eMsalMockEnabled(envOverride)) {
    return true;
  }
  if (readBool('VITE_E2E', false, envOverride)) {
    return true;
  }
  if (skipSharePoint(envOverride)) {
    return true;
  }
  if (shouldSkipLogin(envOverride)) {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.PLAYWRIGHT_TEST === '1') {
    return true;
  }
  return false;
};

const normalizeSiteRelative = (value: string): string => {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, '');
};

const normalizeResource = (value: string): string => value.trim().replace(/\/+$/, '');

export function ensureConfig(envOverride?: { VITE_SP_RESOURCE?: string; VITE_SP_SITE_RELATIVE?: string; VITE_SP_SITE?: string; VITE_SP_SITE_URL?: string }) {
  const overrideRecord = envOverride as EnvRecord | undefined;
  const hasExplicitOverride = envOverride !== undefined;

  const _pickSite = () => {
    const primary = readEnv('VITE_SP_SITE_RELATIVE', '', overrideRecord).trim();
    if (primary) return primary;
    const legacy = readEnv('VITE_SP_SITE', '', overrideRecord).trim();
    return legacy;
  };

  const isPlaceholder = (s: string) => {
    const normalized = (s ?? '').trim();
    if (!normalized) return true;

    const lower = normalized.toLowerCase();
    if (normalized.includes('<') || normalized.includes('__')) return true;
    if (/<[^>]+>/.test(normalized)) return true;
    if (lower.includes('fill') || lower.includes('your')) return true;

    return false;
  };

  const validateAndNormalize = (resourceRaw: string, siteRaw: string) => {
    const overrideResource = sanitizeEnvValue(resourceRaw);
    const overrideSiteRel = sanitizeEnvValue(siteRaw);

    if (isPlaceholder(overrideResource) || isPlaceholder(overrideSiteRel)) {
      throw new Error([
        'SharePoint 接続設定が未完了です。',
        'VITE_SP_RESOURCE 例: https://contoso.sharepoint.com（末尾スラッシュ不要）',
        'VITE_SP_SITE_RELATIVE 例: /sites/AuditSystem（先頭スラッシュ必須・末尾不要）',
        '`.env` を実値で更新し、開発サーバーを再起動してください。'
      ].join('\n'));
    }

    let overrideUrl: URL;
    try {
      overrideUrl = new URL(overrideResource);
    } catch {
      throw new Error(`VITE_SP_RESOURCE の形式が不正です: ${overrideResource}`);
    }

    if (overrideUrl.protocol !== 'https:' || !/\.sharepoint\.com$/i.test(overrideUrl.hostname)) {
      throw new Error(`VITE_SP_RESOURCE の形式が不正です: ${overrideResource}`);
    }

    const siteCandidate = normalizeSiteRelative(overrideSiteRel);
    if (!siteCandidate.startsWith('/sites/') && !siteCandidate.startsWith('/teams/')) {
      throw new Error(`VITE_SP_SITE_RELATIVE の形式が不正です: ${overrideSiteRel}`);
    }

    const resource = normalizeResource(overrideUrl.origin);
    const siteRel = siteCandidate;
    return { resource, siteRel, baseUrl: `${resource}${siteRel}/_api/web` };
  };

  if (hasExplicitOverride) {
    return validateAndNormalize(
      envOverride?.VITE_SP_RESOURCE ?? '',
      envOverride?.VITE_SP_SITE_RELATIVE ?? envOverride?.VITE_SP_SITE ?? ''
    );
  }

  if (shouldBypassSharePointConfig(overrideRecord)) {
    // E2E/demo/mock/skip-login 等では SharePoint を外部に出さない
    return { resource: '', siteRel: '', baseUrl: '' };
  }

  const baseConfig = getAppConfig(overrideRecord);
  const config = envOverride ? { ...baseConfig, ...(envOverride as Record<string, string | undefined>) } : baseConfig;

  if (config.VITE_E2E === '1') {
    const resource = FALLBACK_SP_RESOURCE;
    const siteRel = FALLBACK_SP_SITE_RELATIVE;
    return { resource, siteRel, baseUrl: `${resource}${siteRel}/_api/web` };
  }

  const rawResource = sanitizeEnvValue(config.VITE_SP_RESOURCE ?? '');
  const rawSiteRel = sanitizeEnvValue(
    (config as unknown as { VITE_SP_SITE_RELATIVE?: string; VITE_SP_SITE?: string }).VITE_SP_SITE_RELATIVE ??
      (config as unknown as { VITE_SP_SITE?: string }).VITE_SP_SITE ??
      ''
  );

  return validateAndNormalize(rawResource, rawSiteRel);
}

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

// ────────────────────────────────────────────────────────────────────────────
// Fields Cache（sessionStorage）
// ────────────────────────────────────────────────────────────────────────────
const FIELDS_CACHE_TTL_MS = 20 * 60 * 1000; // 20分

type FieldsCacheEntry = {
  v: 1;
  savedAt: number;
  listTitle: string;
  siteUrl: string;
  internalNames: string[];
};

function nowMs(): number {
  return Date.now();
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeJsonStringify(obj: unknown): string | null {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

function makeFieldsCacheKey(siteUrl: string, listTitle: string): string {
  return `sp.fieldsCache.v1::${siteUrl}::${listTitle}`;
}

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

const normalizeGuidCandidate = (value: string): string => trimGuidBraces(value.replace(/^guid:/i, ''));

const buildListItemsPath = (listTitle: string, select: string[], top: number): string => {
  const queryParts: string[] = [];
  if (select.length) queryParts.push(`$select=${select.join(',')}`);
  if (Number.isFinite(top) && top > 0) queryParts.push(`$top=${top}`);
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const guidCandidate = normalizeGuidCandidate(listTitle);
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
  const guidCandidate = normalizeGuidCandidate(raw);
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

const raiseHttpError = async (
  res: Response,
  ctx?: { url?: string; method?: string }
): Promise<never> => {
  const detail = await readErrorPayload(res);
  const AUDIT_DEBUG = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';

  // 必ず1行はエラーとして残す（詳細なし）
  console.error('[SP ERROR]', {
    status: res.status,
    statusText: res.statusText,
    method: ctx?.method,
    url: ctx?.url ? ctx.url.split('?')[0] : undefined,
  });

  // 詳細は AUDIT_DEBUG 時のみ
  if (AUDIT_DEBUG) {
    console.error('[SP ERROR][detail]', {
      status: res.status,
      statusText: res.statusText,
      method: ctx?.method,
      url: ctx?.url,
      detailPreview: typeof detail === 'string' ? detail.slice(0, 800) : detail,
    });
  }

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
  options: SpClientOptions = {}
) {
  const config = getAppConfig();
  const parsePositiveNumber = (raw: string, fallback: number): number => {
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  };
  const retrySettings = {
    maxAttempts: parsePositiveNumber(config.VITE_SP_RETRY_MAX, 4),
    baseDelay: parsePositiveNumber(config.VITE_SP_RETRY_BASE_MS, 400),
    capDelay: parsePositiveNumber(config.VITE_SP_RETRY_MAX_DELAY_MS, 5000),
  } as const;
  const debugEnabled = config.VITE_AUDIT_DEBUG === '1' || config.VITE_AUDIT_DEBUG === 'true';
  function dbg(...a: unknown[]) { if (debugEnabled) console.debug('[spClient]', ...a); }
  const tokenMetricsCarrier = globalThis as { __TOKEN_METRICS__?: Record<string, unknown> };
  const { onRetry } = options;

  // baseUrl が空の場合は URL 初期化をスキップ（モックモード）
  const baseUrlInfo = baseUrl ? new URL(baseUrl) : null;
  const deriveSiteRelative = (info: URL | null): string => {
    if (!info) return '';
    const normalized = info.pathname.replace(/\/_api\/web\/?$/u, '');
    return normalized || '';
  };
  const proxyBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/sp` : '';
  const proxyResource = baseUrlInfo?.origin ?? '';
  const proxySiteRelative = deriveSiteRelative(baseUrlInfo);

  const normalizePath = (value: string): string => {
    if (!value) return value;
    if (!baseUrlInfo) return value; // モックモードでは正規化不要
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

    // 🔥 CRITICAL: Always read runtime env to respect env.runtime.json override
    const runtimeEnv = getRuntimeEnvRoot() as Record<string, string>;
    // In E2E with Playwright stubs (VITE_E2E_MSAL_MOCK), skip the mock layer to allow interception
    const isE2EWithMsalMock = isE2eMsalMockEnabled(runtimeEnv);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(runtimeEnv) || shouldSkipLogin(runtimeEnv));
    const useProxy =
      !shouldMock &&
      Boolean(proxyBaseUrl) &&
      Boolean(proxyResource) &&
      Boolean(proxySiteRelative) &&
      readBool('VITE_SP_USE_PROXY', false, runtimeEnv as EnvRecord);

    // 🔍 デバッグログ: モック条件を確認
    const AUDIT_DEBUG = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';
    if (AUDIT_DEBUG || isE2EWithMsalMock) {
      console.log('[spFetch]', {
        path: resolvedPath.substring(0, 80),
        method: init.method || 'GET',
        isE2EWithMsalMock,
        shouldMock,
        baseUrl: baseUrl ? `${baseUrl.substring(0, 40)}...` : '(empty)',
        'VITE_E2E_MSAL_MOCK': runtimeEnv['VITE_E2E_MSAL_MOCK'],
        'VITE_E2E': runtimeEnv['VITE_E2E'],
      });
    }

    // 開発環境・デモモード・スキップモードでのモック応答
    if (shouldMock) {
      if (AUDIT_DEBUG) {
        console.info(`[DevMock] ✅ SharePoint API モック: ${init.method || 'GET'} ${resolvedPath}`);
      }

      // モックレスポンスを作成
      const mockResponse = (data: any, status = 200) => {
        const response = new Response(JSON.stringify(data), {
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          headers: {
            'Content-Type': 'application/json',
            'ETag': 'W/"1"',
          },
        });
        return Promise.resolve(response);
      };

      // パスに応じたモックデータ
      if (resolvedPath.includes('/currentuser')) {
        return mockResponse({ Id: 1, Title: 'Development User', LoginName: 'dev@example.com' });
      }

      if (resolvedPath.includes('/lists/getbytitle') && resolvedPath.includes('/items')) {
        return mockResponse({ value: [] });
      }

      if (resolvedPath.includes('/lists/getbytitle')) {
        return mockResponse({ Id: 'mock-list-id', Title: 'Mock List' });
      }

      if (resolvedPath.includes('/lists')) {
        return mockResponse({ value: [] });
      }

      // デフォルトの空レスポンス
      return mockResponse({ value: [] });
    }

    const token1 = await acquireToken();
    if (debugEnabled && tokenMetricsCarrier.__TOKEN_METRICS__) {
      dbg('token metrics snapshot', tokenMetricsCarrier.__TOKEN_METRICS__);
    }
    
    // E2E/skip-login: allow fetch without token so Playwright stubs can intercept
    const skipAuthCheck = shouldSkipLogin() || isE2eMsalMockEnabled();
    
    if (!token1 && !skipAuthCheck) {
      throw new AuthRequiredError();
    }

    // AbortError helper: 正常なキャンセル判定 (latest-request-only pattern)
    const isAbortError = (e: unknown): boolean => {
      if (e instanceof DOMException && e.name === 'AbortError') return true;
      // 環境差異対応: Node.js AbortSignal.abort() 等
      return typeof e === 'object' && e !== null && 'name' in e && (e as { name: string }).name === 'AbortError';
    };

    // util: undefined/null/空文字/文字列"undefined"/"null" を落として Headers に入れる
    const toHeaders = (input?: HeadersInit): Headers => {
      const h = new Headers();
      if (!input) return h;

      const isInvalidValue = (v: any): boolean => {
        if (v === undefined || v === null) return true;
        const str = `${v}`.trim();
        if (str === '') return true;
        if (str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return true;
        return false;
      };

      if (input instanceof Headers) {
        input.forEach((v, k) => {
          if (!isInvalidValue(v)) h.set(k, `${v}`);
        });
        return h;
      }

      if (Array.isArray(input)) {
        for (const [k, v] of input) {
          if (!isInvalidValue(v)) h.set(k, `${v}`);
        }
        return h;
      }

      for (const [k, v] of Object.entries(input)) {
        if (!isInvalidValue(v)) h.set(k, `${v}`);
      }
      return h;
    };

    const resolveUrl = (targetPath: string) => {
      if (/^https?:\/\//i.test(targetPath)) return targetPath;
      if (useProxy) return `${proxyBaseUrl}${targetPath}`;
      return `${baseUrl}${targetPath}`;
    };
    const doFetch = async (token: string | null) => {
      const url = resolveUrl(resolvedPath);
      const AUDIT_DEBUG = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';

      // ヘッダー生成: undefined/null を絶対に入れない
      const headers = toHeaders(init.headers);
      if (useProxy) {
        headers.set('X-SP-RESOURCE', proxyResource);
        headers.set('X-SP-SITE-RELATIVE', proxySiteRelative);
      }
      // E2E/skip-login: only set Authorization if token exists
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const method = (init.method ?? 'GET').toUpperCase();

      // 確実にログを出す（到達確認用）
      if (AUDIT_DEBUG) {
        console.warn('[spFetch] reached', { method, url: url.split('?')[0] });
      }

      if (['POST', 'PUT', 'PATCH', 'MERGE'].includes(method)) {
        // Accept を強制設定（undefined/空/文字列"undefined"を検出）
        const accept = headers.get('Accept');
        if (!accept || !accept.trim() || accept.trim().toLowerCase() === 'undefined') {
          headers.set('Accept', 'application/json;odata=nometadata');
        }

        // Content-Type を強制設定
        const contentType = headers.get('Content-Type');
        if (!contentType || !contentType.trim() || contentType.trim().toLowerCase() === 'undefined') {
          headers.set('Content-Type', 'application/json;odata=nometadata');
        }

        // デバッグ: 書き込み系リクエストの最終ヘッダー確認
        if (process.env.NODE_ENV === 'development') {
          console.warn('[spFetch] PATCH/POST headers FINAL', {
            method,
            Accept: headers.get('Accept'),
            ContentType: headers.get('Content-Type'),
            url: url.split('?')[0],
          });
        }
      } else {
        // 読み取り系: Accept が無い/`*/*` の場合のみ設定
        const currentAccept = headers.get('Accept');
        if (!currentAccept || currentAccept.trim() === '' || currentAccept.trim() === '*/*') {
          headers.set('Accept', 'application/json;odata=nometadata');
        }
      }

      // 🚨 fetch 直前の最終確認ログ（AUDIT_DEBUG 時のみ）
      if (AUDIT_DEBUG) {
        console.log('[spClient] 📡 fetch', {
          method,
          url: url.split('?')[0],
          Accept: headers.get('Accept'),
          ContentType: headers.get('Content-Type'),
        });
      }
      return fetch(url, { ...init, headers }).catch((e: unknown) => {
        // AbortError は正常なキャンセル: リトライ/ログ不要
        if (isAbortError(e)) throw e;
        throw e;
      });
    };


    let response: Response;
    try {
      response = await doFetch(token1);
    } catch (e) {
      // AbortError は正常なキャンセル: 即座に throw
      if (isAbortError(e)) throw e;
      throw e;
    }

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
      try {
        response = await doFetch(token1);
      } catch (e) {
        // AbortError: リトライせず即終了
        if (isAbortError(e)) throw e;
        throw e;
      }
    }

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      // E2E/skip-login: don't retry with token if already in skip mode (Playwright handles auth)
      if (!skipAuthCheck) {
        const token2 = await acquireToken();
        if (token2 && token2 !== token1) {
          try {
            response = await doFetch(token2);
          } catch (e) {
            // AbortError: token refresh 不要
            if (isAbortError(e)) throw e;
            throw e;
          }
        } else if (!token2) {
          throw new AuthRequiredError();
        }
      }
    }

    if (!response.ok) {
      await raiseHttpError(response, { url: resolveUrl(resolvedPath), method: init.method ?? 'GET' });
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
    const AUDIT_DEBUG = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';
    if (AUDIT_DEBUG) {
      console.log('[spClient.listItems] 🚀 initialPath=', initialPath);
    }
    const rows: TRow[] = [];
    let nextPath: string | null = initialPath;
    let pages = 0;
    const maxPages = typeof pageCap === 'number' && pageCap > 0 ? Math.floor(pageCap) : Number.POSITIVE_INFINITY;

    while (nextPath && pages < maxPages) {
      if (AUDIT_DEBUG) {
        console.log('[spClient.listItems] 📡 spFetch call with path=', nextPath);
      }
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
        // SharePoint Online: POST+X-HTTP-Method:MERGE は PATCH より安定
        return await spFetch(itemPath, {
          method: 'POST',
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'X-HTTP-Method': 'MERGE',
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

  const getListFieldInternalNames = async (listTitle: string): Promise<Set<string>> => {
    const debug = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';
    const siteUrl = baseUrl;
    const cacheKey = makeFieldsCacheKey(siteUrl, listTitle);

    // 1) キャッシュヒット判定
    if (typeof sessionStorage !== 'undefined') {
      const cached = safeJsonParse<FieldsCacheEntry>(sessionStorage.getItem(cacheKey));
      if (cached && cached.v === 1) {
        const age = nowMs() - cached.savedAt;
        const valid =
          cached.siteUrl === siteUrl &&
          cached.listTitle === listTitle &&
          age >= 0 &&
          age < FIELDS_CACHE_TTL_MS;

        if (valid && Array.isArray(cached.internalNames) && cached.internalNames.length > 0) {
          if (debug) {
            console.log('[spClient][fieldsCache] ✅ hit', {
              listTitle,
              count: cached.internalNames.length,
              ageMs: age,
            });
          }
          return new Set(cached.internalNames);
        }

        // 期限切れ/不正 → 破棄
        if (debug) {
          console.log('[spClient][fieldsCache] ⏰ stale/invalid -> drop', { listTitle, ageMs: age });
        }
        sessionStorage.removeItem(cacheKey);
      } else if (cached) {
        // JSON は読めたが形が違う
        sessionStorage.removeItem(cacheKey);
      }
    }

    // 2) Network fetch（Fields API）
    const encoded = encodeURIComponent(listTitle);
    const path = `/lists/getbytitle('${encoded}')/fields?$select=InternalName&$top=500`;

    try {
      const res = await spFetch(path);
      const json = (await res.json().catch(() => ({ value: [] }))) as {
        value?: { InternalName?: string }[];
      };
      const names = new Set<string>();
      for (const field of json.value ?? []) {
        if (field?.InternalName) {
          names.add(field.InternalName);
        }
      }

      // 3) キャッシュ保存（空は保存しない）
      if (typeof sessionStorage !== 'undefined' && names.size > 0) {
        const entry: FieldsCacheEntry = {
          v: 1,
          savedAt: nowMs(),
          listTitle,
          siteUrl,
          internalNames: Array.from(names),
        };
        const s = safeJsonStringify(entry);
        if (s) {
          sessionStorage.setItem(cacheKey, s);
          if (debug) {
            console.log('[spClient][fieldsCache] 💾 save', { listTitle, count: names.size });
          }
        }
      } else if (debug && names.size === 0) {
        console.log('[spClient][fieldsCache] ⚠️ fetched empty (not cached)', { listTitle });
      }

      return names;
    } catch (e) {
      // 4) 失敗時はキャッシュを残さない
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(cacheKey);
      }
      if (debug) {
        console.warn('[spClient][fieldsCache] ❌ fetch failed', { listTitle, error: e });
      }
      throw e;
    }
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
    // 🔥 CRITICAL: Always read runtime env to respect env.runtime.json override
    const runtimeEnv = getRuntimeEnvRoot() as Record<string, string>;
    // In E2E with Playwright stubs (VITE_E2E_MSAL_MOCK), skip the mock layer to allow interception
    const isE2EWithMsalMock = isE2eMsalMockEnabled(runtimeEnv);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(runtimeEnv) || shouldSkipLogin(runtimeEnv));

    // 開発環境・デモモード・スキップモードでのモック応答
    if (shouldMock) {
      if (import.meta.env.DEV) {
        console.info('[DevMock] ✅ SharePoint Batch API モック');
      }
      // バッチ操作が成功したというモックレスポンスを返す
      const mockBatchResponse = (operations: Array<{ method?: string; url?: string; headers?: Record<string, string>; body?: unknown }>) => {
        const parts: string[] = [];
        operations.forEach(() => {
          parts.push(`--${boundary}`);
          parts.push('Content-Type: application/http');
          parts.push('Content-Transfer-Encoding: binary');
          parts.push('');
          parts.push('HTTP/1.1 204 No Content');
          parts.push('');
        });
        parts.push(`--${boundary}--`);
        const mockBody = parts.join('\r\n');
        return new Response(mockBody, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': `multipart/mixed; boundary=${boundary}`,
          },
        });
      };
      // バッチ操作の数を推定（簡易的に boundary の出現回数から）
      const operationCount = (batchBody.match(new RegExp(`--${boundary}`, 'g')) || []).length - 1;
      const mockOps = Array(Math.max(1, operationCount)).fill({});
      return Promise.resolve(mockBatchResponse(mockOps));
    }

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
      // E2E/skip-login: allow batch without token so Playwright stubs can intercept
      const skipAuthCheck = shouldSkipLogin() || isE2eMsalMockEnabled();
      if (!token && !skipAuthCheck) {
        throw new AuthRequiredError();
      }
      const headers = new Headers({
        'Content-Type': `multipart/mixed; boundary=${boundary}`
      });
      // Only set Authorization if token exists
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
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
    tryGetListMetadata,
    getListFieldInternalNames,
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
  const cfg = useMemo(() => ensureConfig(), []);
  const client = useMemo(() => createSpClient(acquireToken, cfg.baseUrl), [acquireToken, cfg.baseUrl]);
  return client;
};

export type IntegratedResourceCalendarClient = {
  getUnifiedEvents: () => Promise<UnifiedResourceEvent[]>;
};

export const createIrcSpClient = (): IntegratedResourceCalendarClient => ({
  async getUnifiedEvents() {
    // Placeholder: wire to SharePoint/Graph once schema stabilizes
    return [];
  },
});

export async function createSchedule<T extends Record<string, unknown>>(_sp: UseSP, payload: T): Promise<T> {
  // placeholder: real implementation will map payload to SharePoint list mutation
  return payload;
}

export const __ensureListInternals = { buildFieldSchema };

/**
 * Fields キャッシュを手動クリア（デバッグ用）
 */
export function clearFieldsCacheFor(listTitle: string, siteUrl?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const url = siteUrl || ensureConfig().baseUrl;
  const key = makeFieldsCacheKey(url, listTitle);
  sessionStorage.removeItem(key);
  console.log('[spClient][fieldsCache] 🗑️ cleared', { listTitle });
}

/**
 * 全 Fields キャッシュをクリア
 */
export function clearAllFieldsCache(): void {
  if (typeof sessionStorage === 'undefined') return;
  const prefix = 'sp.fieldsCache.v1::';
  let count = 0;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) {
      sessionStorage.removeItem(key);
      count++;
    }
  }
  console.log('[spClient][fieldsCache] 🗑️ cleared all', { count });
}

// test-only export (intentionally non-exported in production bundles usage scope)
export const __test__ = {
  ensureConfig,
  resetMissingOptionalFieldsCache(): void {
    missingOptionalFieldsCache.clear();
  },
  resolveStaffListIdentifier,
};

// IDE 補完用に公開フック型を輸出
export type UseSP = ReturnType<typeof useSP>;
