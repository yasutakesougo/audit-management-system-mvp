/**
 * SharePoint Fetch — HTTP fetch + retry + mock logic
 *
 * Extracted from spClient.ts createSpClient() for single-responsibility.
 * This module exports a factory `createSpFetch` that returns an `spFetch` function.
 */

import { auditLog } from '@/lib/debugLogger';
import type { EnvRecord } from '@/lib/env';
import { isE2eMsalMockEnabled, shouldSkipLogin, skipSharePoint } from '@/lib/env';
import { AuthRequiredError } from '@/lib/errors';
import { raiseHttpError } from './helpers';
import type { RetryReason, SpClientOptions } from './types';

// ─── Dependencies injected from createSpClient ──────────────────────────────

export type SpFetchDeps = {
  acquireToken: () => Promise<string | null>;
  baseUrl: string;
  config: EnvRecord;
  retrySettings: { maxAttempts: number; baseDelay: number; capDelay: number };
  debugEnabled: boolean;
  spSiteLegacy: string;
  onRetry?: SpClientOptions['onRetry'];
};

// ─── normalizePath (extracted as standalone) ────────────────────────────────

export function createNormalizePath(
  config: EnvRecord,
  spSiteLegacy: string,
  baseUrl: string,
) {
  const baseUrlInfo = baseUrl ? new URL(baseUrl) : null;

  return function normalizePath(value: string): string {
    if (!value) return value;
    const siteUrl = String(config.VITE_SP_SITE_URL ?? '');
    const siteRelative = String(config.VITE_SP_SITE_RELATIVE ?? '');
    const resource = String(config.VITE_SP_RESOURCE ?? '');
    const interpolated = value
      .replace('{SP_SITE_URL}', siteUrl)
      .replace('{SP_SITE}', spSiteLegacy || siteRelative)
      .replace('{SP_RESOURCE}', resource);

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
}

// ─── Retry classifier (delegates to helpers.ts SSOT) ────────────────────────

function classifyRetry(status: number): RetryReason | null {
  if (status === 408) return 'timeout';
  if (status === 429) return 'throttle';
  if ([500, 502, 503, 504].includes(status)) return 'server';
  return null;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  return typeof e === 'object' && e !== null && 'name' in e && (e as { name: string }).name === 'AbortError';
}

function toHeaders(input?: HeadersInit): Headers {
  const h = new Headers();
  if (!input) return h;

  const isInvalidValue = (v: unknown): boolean => {
    if (v === undefined || v === null) return true;
    const str = `${v}`.trim();
    if (str === '') return true;
    if (str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return true;
    return false;
  };

  if (input instanceof Headers) {
    input.forEach((v, k) => { if (!isInvalidValue(v)) h.set(k, `${v}`); });
    return h;
  }
  if (Array.isArray(input)) {
    for (const [k, v] of input) { if (!isInvalidValue(v)) h.set(k, `${v}`); }
    return h;
  }
  for (const [k, v] of Object.entries(input)) { if (!isInvalidValue(v)) h.set(k, `${v}`); }
  return h;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function computeDelay(attempt: number, res: Response, baseDelay: number, capDelay: number): number {
  const ra = res.headers.get('Retry-After');
  if (ra) {
    const sec = Number(ra);
    if (!Number.isNaN(sec) && sec > 0) return Math.max(0, Math.round(sec * 1000));
    const ts = Date.parse(ra);
    if (!Number.isNaN(ts)) return Math.max(0, ts - Date.now());
  }
  const expo = Math.min(capDelay, baseDelay * Math.pow(2, attempt - 1));
  const jitter = Math.random() * expo;
  return Math.max(0, Math.round(jitter));
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createSpFetch(deps: SpFetchDeps) {
  const { acquireToken, baseUrl, config, retrySettings, debugEnabled, onRetry } = deps;
  const _e2eMsalMockFlag = config.VITE_E2E_MSAL_MOCK;
  const tokenMetricsCarrier = globalThis as { __TOKEN_METRICS__?: Record<string, unknown> };

  const dbg = (event: string, data?: Record<string, unknown>) => { auditLog.debug('sp', event, data); };

  const resolveUrl = (targetPath: string) =>
    /^https?:\/\//i.test(targetPath) ? targetPath : `${baseUrl}${targetPath}`;

  return async function spFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const resolvedPath = path; // normalizePath is applied BEFORE calling spFetch by createSpClient

    // Mock decision
    const isE2EWithMsalMock = isE2eMsalMockEnabled(config);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(config) || shouldSkipLogin(config));
    const AUDIT_DEBUG = config.VITE_AUDIT_DEBUG;

    if (AUDIT_DEBUG || isE2EWithMsalMock) {
      auditLog.debug('sp:fetch', 'request', {
        path: resolvedPath.substring(0, 80),
        method: init.method || 'GET',
        isE2EWithMsalMock,
        shouldMock,
        baseUrl: baseUrl ? `${baseUrl.substring(0, 40)}...` : '(empty)',
      });
    }

    // Dev / demo / skip-login mock responses
    if (shouldMock) {
      if (AUDIT_DEBUG) {
        auditLog.debug('sp:mock', 'mock_response', { method: init.method || 'GET', path: resolvedPath });
      }
      const mockResponse = (data: unknown, status = 200) => {
        const response = new Response(JSON.stringify(data), {
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          headers: { 'Content-Type': 'application/json', 'ETag': 'W/"1"' },
        });
        return Promise.resolve(response);
      };

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
      return mockResponse({ value: [] });
    }

    // ── Real fetch ──
    const token1 = await acquireToken();
    if (debugEnabled && tokenMetricsCarrier.__TOKEN_METRICS__) {
      dbg('token metrics snapshot', tokenMetricsCarrier.__TOKEN_METRICS__);
    }

    const skipAuthCheck = shouldSkipLogin(config) || isE2eMsalMockEnabled(config);
    if (!token1 && !skipAuthCheck) throw new AuthRequiredError();

    const doFetch = async (token: string | null) => {
      const url = resolveUrl(resolvedPath);
      const headers = toHeaders(init.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const method = (init.method ?? 'GET').toUpperCase();

      if (AUDIT_DEBUG) {
        auditLog.debug('sp:fetch', 'reached', { method, url: url.split('?')[0] });
      }

      if (['POST', 'PUT', 'PATCH', 'MERGE'].includes(method)) {
        const accept = headers.get('Accept');
        if (!accept || !accept.trim() || accept.trim().toLowerCase() === 'undefined') {
          headers.set('Accept', 'application/json;odata=nometadata');
        }
        const contentType = headers.get('Content-Type');
        if (!contentType || !contentType.trim() || contentType.trim().toLowerCase() === 'undefined') {
          headers.set('Content-Type', 'application/json;odata=nometadata');
        }
        if (process.env.NODE_ENV === 'development') {
          auditLog.debug('sp:fetch', 'write_headers', {
            method,
            Accept: headers.get('Accept'),
            ContentType: headers.get('Content-Type'),
            url: url.split('?')[0],
          });
        }
      } else {
        const currentAccept = headers.get('Accept');
        if (!currentAccept || currentAccept.trim() === '' || currentAccept.trim() === '*/*') {
          headers.set('Accept', 'application/json;odata=nometadata');
        }
      }

      if (AUDIT_DEBUG) {
        auditLog.debug('sp:fetch', 'outbound', {
          method, url: url.split('?')[0],
          Accept: headers.get('Accept'), ContentType: headers.get('Content-Type'),
        });
      }
      // eslint-disable-next-line no-restricted-globals -- SP基盤 SSOT: fetch はこの最下層でのみ許可
      return fetch(url, { ...init, headers }).catch((e: unknown) => {
        if (isAbortError(e)) throw e;
        throw e;
      });
    };

    // ── Retry loop ──
    let response: Response;
    try { response = await doFetch(token1); } catch (e) {
      if (isAbortError(e)) throw e;
      throw e;
    }

    const { maxAttempts, baseDelay, capDelay } = retrySettings;
    let attempt = 1;
    while (!response.ok && attempt < maxAttempts) {
      const reason = classifyRetry(response.status);
      if (!reason) break;
      const delayMs = computeDelay(attempt, response, baseDelay, capDelay);
      if (onRetry) {
        try { onRetry(response, { attempt, status: response.status, reason, delayMs }); }
        catch (error) { auditLog.debug('sp:retry', 'callback_failed', { error: error instanceof Error ? (error as Error).message : String(error) }); }
      }
      auditLog.debug('sp:retry', { attempt, status: response.status, reason, delayMs });
      if (debugEnabled) {
        auditLog.debug('sp:retry', 'single', { status: response.status, nextAttempt: attempt + 1, waitMs: delayMs });
      }
      if (delayMs > 0) { await sleep(delayMs); } else { await Promise.resolve(); }
      attempt += 1;
      try { response = await doFetch(token1); } catch (e) {
        if (isAbortError(e)) throw e;
        throw e;
      }
    }

    // ── Auth refresh on 401/403 ──
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      if (!skipAuthCheck) {
        const token2 = await acquireToken();
        if (token2 && token2 !== token1) {
          try { response = await doFetch(token2); } catch (e) {
            if (isAbortError(e)) throw e;
            throw e;
          }
        } else if (!token2) { throw new AuthRequiredError(); }
      }
    }

    if (!response.ok) {
      await raiseHttpError(response, { url: resolveUrl(resolvedPath), method: init.method ?? 'GET' });
    }
    return response;
  };
}
