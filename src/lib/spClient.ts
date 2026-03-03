/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAuth } from '@/auth/useAuth';
import type { UnifiedResourceEvent } from '@/features/resources/types';
import { auditLog } from '@/lib/debugLogger';
import { getAppConfig, isE2eMsalMockEnabled, readEnv, shouldSkipLogin, skipSharePoint, type EnvRecord } from '@/lib/env';
import { useMemo } from 'react';
import { AuthRequiredError } from './errors';

// --- Config helpers imported from @/lib/sp/config (SSOT) --------------------
import { ensureConfig } from '@/lib/sp/config';
export { ensureConfig } from '@/lib/sp/config';
// --- Batch payload/parse imported from @/lib/sp/spBatch (SSOT) ---------------
import { buildBatchPayload as buildBatchPayloadImported, parseBatchResponse as parseBatchResponseImported } from '@/lib/sp/spBatch';



// List CRUD operations delegated to spLists.ts
import { createListOperations } from '@/lib/sp/spLists';

// ─── Types & schemas imported from @/lib/sp/types (SSOT) ────────────────────
import {
    trimGuidBraces,
    type RetryReason
} from '@/lib/sp/types';

// Re-export for backward compatibility — existing importers don't need to change
export {
    parseSpListResponse,
    type JsonRecord
} from '@/lib/sp/types';
export type {
    EnsureListResult, SharePointBatchOperation,
    SharePointBatchResult,
    SharePointRetryMeta,
    SpClientOptions,
    SpFieldDef
} from '@/lib/sp/types';

// Internal type imports (not re-exported — used only within this file)
import type {
    E2eDebugWindow,
    SharePointBatchOperation,
    SharePointBatchResult,
    SpClientOptions,
    StaffIdentifier
} from '@/lib/sp/types';


// ─── Field cache & schema imported from SSOT modules ────────────────────────
import {
    buildSelectFields,
    extractMissingField,
    getMissingSet,
    markOptionalMissing,
    resetMissingOptionalFieldsCache
} from '@/lib/sp/helpers';
import { buildFieldSchema } from '@/lib/sp/spSchema';

const sanitizeEnvValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
const DEFAULT_STAFF_LIST_TITLE = 'Staff_Master';

const USERS_BASE_FIELDS = ['Id', 'UserID', 'FullName', 'ContractDate', 'IsHighIntensitySupportTarget', 'ServiceStartDate', 'ServiceEndDate'] as const;
const USERS_OPTIONAL_FIELDS = ['FullNameKana', 'Furigana', 'Email', 'Phone', 'BirthDate'] as const;

const STAFF_BASE_FIELDS = ['Id', 'StaffID', 'StaffName', 'Role', 'Phone', 'Email'] as const;
const STAFF_OPTIONAL_FIELDS = ['StaffID', 'AttendanceDays', 'Certifications', 'Department', 'Notes'] as const;

// ─── Path & error helpers imported from @/lib/sp/helpers (SSOT) ─────────────
import {
    buildItemPath,
    buildListItemsPath,
    raiseHttpError
} from '@/lib/sp/helpers';


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
  const spSiteLegacy = readEnv('VITE_SP_SITE', '', config as unknown as EnvRecord);
  const e2eMsalMockFlag = readEnv('VITE_E2E_MSAL_MOCK', '0', config as unknown as EnvRecord);
  const retrySettings = {
    maxAttempts: Number(config.VITE_SP_RETRY_MAX) || 4,
    baseDelay: Number(config.VITE_SP_RETRY_BASE_MS) || 400,
    capDelay: Number(config.VITE_SP_RETRY_MAX_DELAY_MS) || 5000,
  } as const;
  const debugEnabled = !!config.VITE_AUDIT_DEBUG;
  function dbg(...a: unknown[]) { if (debugEnabled) console.debug('[spClient]', ...a); }
  const tokenMetricsCarrier = globalThis as { __TOKEN_METRICS__?: Record<string, unknown> };
  const { onRetry } = options;

  // baseUrl が空の場合は URL 初期化をスキップ（モックモード）
  const baseUrlInfo = baseUrl ? new URL(baseUrl) : null;

  const normalizePath = (value: string): string => {
    if (!value) return value;
    const interpolated = value
      .replace('{SP_SITE_URL}', config.VITE_SP_SITE_URL || '')
      .replace('{SP_SITE}', spSiteLegacy || config.VITE_SP_SITE_RELATIVE || '')
      .replace('{SP_RESOURCE}', config.VITE_SP_RESOURCE || '');

    if (!baseUrlInfo) return interpolated;
    if (/^https?:\/\//i.test(interpolated)) {
      try {
        const target = new URL(interpolated);
        if (target.origin === baseUrlInfo.origin) {
          const basePath = baseUrlInfo.pathname.replace(/\/+$|$/u, '');
          const fullPath = `${target.pathname}${target.search}`;
          if (fullPath.startsWith(basePath)) {
            const slice = fullPath.slice(basePath.length);
            return slice.startsWith('/') ? slice : `/${slice}`;
          }
          return `${target.pathname}${target.search}`;
        }
        return interpolated;
      } catch {
        return interpolated;
      }
    }
    return interpolated.startsWith('/') ? interpolated : `/${interpolated}`;
  };
  const classifyRetry = (status: number): RetryReason | null => {
    if (status === 408) return 'timeout';
    if (status === 429) return 'throttle';
    if ([500, 502, 503, 504].includes(status)) return 'server';
    return null;
  };


  const spFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const resolvedPath = normalizePath(path);

    // 🔥 CRITICAL: Always use config to respect overrides and mocks
    const isE2EWithMsalMock = isE2eMsalMockEnabled(config as any);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(config as any) || shouldSkipLogin(config as any));
    const AUDIT_DEBUG = config.VITE_AUDIT_DEBUG;

    // 🔍 デバッグログ: モック条件を確認
    if (AUDIT_DEBUG || isE2EWithMsalMock) {
      console.log('[spFetch]', {
        path: resolvedPath.substring(0, 80),
        method: init.method || 'GET',
        isE2EWithMsalMock,
        shouldMock,
        baseUrl: baseUrl ? `${baseUrl.substring(0, 40)}...` : '(empty)',
        'VITE_E2E_MSAL_MOCK': e2eMsalMockFlag,
        'VITE_E2E': config.VITE_E2E,
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
    const skipAuthCheck = shouldSkipLogin(config as any) || isE2eMsalMockEnabled(config as any);

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

    const resolveUrl = (targetPath: string) => (/^https?:\/\//i.test(targetPath) ? targetPath : `${baseUrl}${targetPath}`);
    const doFetch = async (token: string | null) => {
      const url = resolveUrl(resolvedPath);
      const AUDIT_DEBUG = !!config.VITE_AUDIT_DEBUG;

      // ヘッダー生成: undefined/null を絶対に入れない
      const headers = toHeaders(init.headers);
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

  // ── Delegate list CRUD to spLists.ts (single source of truth) ────────────
  const listOps = createListOperations(spFetch, normalizePath, baseUrl);
  const {
    getListItemsByTitle,
    listItems,
    addListItemByTitle,
    getItemById,
    getItemByIdWithEtag,
    createItem,
    updateItemByTitle,
    updateItem,
    deleteItemByTitle,
    deleteItem,
    tryGetListMetadata,
    getListFieldInternalNames,
    ensureListExists,
  } = listOps;
  /** @deprecated Use `addListItemByTitle`. Kept for backward compatibility. */
  const addItemByTitle = addListItemByTitle;

  // $batch 投稿ヘルパー (429/503/504 リトライ対応)
  const postBatch = async (batchBody: string, boundary: string): Promise<Response> => {
    const isE2EWithMsalMock = isE2eMsalMockEnabled(config as any);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(config as any) || shouldSkipLogin(config as any));

    // 開発環境・デモモード・スキップモードでのモック応答
    if (shouldMock) {
      if (config.isDev) {
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
      const skipAuthCheck = shouldSkipLogin(config as any) || isE2eMsalMockEnabled(config as any);
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

  // batch: uses imported buildBatchPayload / parseBatchResponse from sp/batch.ts
  const batch = async (operations: SharePointBatchOperation[]): Promise<SharePointBatchResult[]> => {
    if (!operations.length) return [];
    const boundary = `batch_${Math.random().toString(36).slice(2)}`;
    const requestBody = buildBatchPayloadImported(operations, boundary, normalizePath, buildItemPath);
    const res = await postBatch(requestBody, boundary);
    const contentType = res.headers.get('Content-Type') ?? '';
    const match = /boundary=([^;]+)/i.exec(contentType);
    const responseBoundary = match ? match[1].trim() : boundary;
    const text = await res.text();
    return parseBatchResponseImported(text, responseBoundary);
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
  const listTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) || DEFAULT_USERS_LIST_TITLE;
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
  const listTitleCandidate = sanitizeEnvValue(readEnv('VITE_SP_LIST_STAFF', '')) || DEFAULT_STAFF_LIST_TITLE;
  const listGuidCandidate = sanitizeEnvValue(readEnv('VITE_SP_LIST_STAFF_GUID', ''));
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

// Re-export cache clear utilities from helpers (SSOT)
export { clearAllFieldsCache, clearFieldsCacheFor } from '@/lib/sp/helpers';

// test-only export (intentionally non-exported in production bundles usage scope)
export const __test__ = {
  ensureConfig,
  resetMissingOptionalFieldsCache,
  resolveStaffListIdentifier,
};

// IDE 補完用に公開フック型を輸出
export type UseSP = ReturnType<typeof useSP>;
