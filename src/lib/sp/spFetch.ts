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
import { startFetchSpan } from '@/telemetry/fetchSpan';
import { raiseHttpError } from './helpers';
import type { SpClientOptions } from './types';
import { spTelemetryStore, type SpFetchTelemetryEvent, type SpMetric } from '@/lib/telemetry/spTelemetryStore';

export type SpLane = 'read' | 'write' | 'provisioning';

export function resolveLane(path: string, method: string): SpLane {
  const upperMethod = method.toUpperCase();
  const normalized = path.toLowerCase();

  const isProvisioning =
    normalized.includes('/fields/createfieldasxml') ||
    (normalized.endsWith('/lists') && upperMethod === 'POST') ||
    normalized.includes('/fields/addfield') ||
    normalized.includes('/contenttypes');

  if (isProvisioning) return 'provisioning';

  const isWrite =
    ['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE'].includes(upperMethod) ||
    normalized.includes('/$batch');

  return isWrite ? 'write' : 'read';
}

// ─── Dependencies injected from createSpClient ──────────────────────────────

export type SpFetchDeps = {
  acquireToken: () => Promise<string | null>;
  baseUrl: string;
  config: EnvRecord;
  retrySettings: { maxAttempts: number; baseDelay: number; capDelay: number };
  debugEnabled: boolean;
  spSiteLegacy: string;
  onRetry?: SpClientOptions['onRetry'];
  /**
   * true (default): !response.ok 時に raiseHttpError で例外を投げる
   * false: Response をそのまま返す（互換レイヤー用）
   */
  throwOnError?: boolean;
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

// ─── Concurrency Limiter (Semaphore) ────────────────────────────────────────
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
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

function parseRetryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After');
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}

function jitter(ms: number): number {
  const ratio = 0.2; // ±20%
  const delta = ms * ratio;
  return Math.max(0, Math.round(ms - delta + Math.random() * delta * 2));
}

function computeBackoffMs(
  attempt: number,
  baseRetryDelayMs: number,
  maxRetryDelayMs: number,
  retryAfterMs?: number,
): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, maxRetryDelayMs);
  }

  const exp = baseRetryDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(jitter(exp), maxRetryDelayMs);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs?: number): AbortSignal | undefined {
  if (!timeoutMs || timeoutMs <= 0) return signal;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const cleanup = () => clearTimeout(timer);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        () => {
          controller.abort();
          cleanup();
        },
        { once: true },
      );
    }
  }

  controller.signal.addEventListener('abort', cleanup, { once: true });
  return controller.signal;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createSpFetch(deps: SpFetchDeps) {
  const { acquireToken, baseUrl, config, retrySettings, debugEnabled, onRetry, throwOnError = true } = deps;
  const _e2eMsalMockFlag = config.VITE_E2E_MSAL_MOCK;
  const tokenMetricsCarrier = globalThis as { __TOKEN_METRICS__?: Record<string, unknown> };

  const dbg = (event: string, data?: Record<string, unknown>) => { auditLog.debug('sp', event, data); };

  const recordTelemetry = (event: SpFetchTelemetryEvent, payload: Omit<SpMetric, 'timestamp' | 'event'>) => {
    auditLog.debug(event, payload);
    spTelemetryStore.record(event, payload);
  };

  const readLane = new Semaphore(5);
  const writeLane = new Semaphore(2);
  const provisionLane = new Semaphore(1);

  const resolveUrl = (targetPath: string) => {
    if (/^https?:\/\//i.test(targetPath)) return targetPath;
    const base = baseUrl.replace(/\/+$/, '');
    const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    return `${base}${path}`;
  };

  return async function spFetch(path: string, init: import('./types').SpRequestInit = {}): Promise<Response> {
    const spOptions = init.spOptions || {};
    const resolvedPath = path; // normalizePath is applied BEFORE calling spFetch by createSpClient
    const method = (init.method ?? 'GET').toUpperCase();

    // Mock decision
    const isE2EWithMsalMock = isE2eMsalMockEnabled(config);
    // VITE_SKIP_SHAREPOINT=1 (skipSharePoint) should always trigger mock, even in E2E
    const shouldMock = skipSharePoint(config) || (!isE2EWithMsalMock && (!baseUrl || baseUrl === '' || shouldSkipLogin(config)));
    const AUDIT_DEBUG = config.VITE_AUDIT_DEBUG;

    if (AUDIT_DEBUG || isE2EWithMsalMock) {
      auditLog.debug('sp:fetch', 'request', {
        path: resolvedPath.substring(0, 80),
        method: method,
        isE2EWithMsalMock,
        shouldMock,
        baseUrl: baseUrl ? `${baseUrl.substring(0, 40)}...` : '(empty)',
      });
    }

    // Dev / demo / skip-login mock responses (スパン不要)
    if (shouldMock) {
      if (AUDIT_DEBUG) {
        auditLog.debug('sp:mock', 'mock_response', { method: method, path: resolvedPath });
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
    const skipAuthCheck = shouldSkipLogin(config) || isE2eMsalMockEnabled(config);
    let initialToken: string | null = null;
    if (!skipAuthCheck) {
      initialToken = await acquireToken();
      if (!initialToken) throw new AuthRequiredError();
    }
    
    if (debugEnabled && tokenMetricsCarrier.__TOKEN_METRICS__) {
      dbg('token metrics snapshot', tokenMetricsCarrier.__TOKEN_METRICS__);
    }

    const url = resolveUrl(resolvedPath);
    const queuedAt = Date.now();

    // Observability span
    const span = startFetchSpan({ layer: 'sp', method, path: resolvedPath });

    const isUpdate = ['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE'].includes(method);
    const skipRetry = spOptions.skipRetry ?? false;
    
    const lane = resolveLane(url, method);
    const effectiveRetries =
      lane === 'provisioning'
        ? 0
        : (spOptions.retries ?? retrySettings.maxAttempts - 1);
    
    const maxRetries = effectiveRetries;
    const baseDelay = retrySettings.baseDelay;
    const capDelay = retrySettings.capDelay;
    
    // Default 30s timeout if none provided explicitly
    const mergedSignal = withTimeout(init.signal ?? undefined, spOptions.timeoutMs ?? 30000);

    const release =
      lane === 'provisioning'
        ? await provisionLane.acquire()
        : lane === 'write'
        ? await writeLane.acquire()
        : await readLane.acquire();

    try {
      const startedAt = Date.now();
      const queuedMs = startedAt - queuedAt;

      recordTelemetry('sp:request_start', { url: url.split('?')[0], method, lane, queuedMs });

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const attemptStartedAt = Date.now();
        
        let token = initialToken;
        if (!token && !skipAuthCheck) {
          token = await acquireToken();
          if (!token) throw new AuthRequiredError();
        }

        const headers = toHeaders(init.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);

        if (isUpdate) {
          const accept = headers.get('Accept');
          if (!accept || !accept.trim() || accept.trim().toLowerCase() === 'undefined') {
            headers.set('Accept', 'application/json;odata=nometadata');
          }
          const contentType = headers.get('Content-Type');
          if (!contentType || !contentType.trim() || contentType.trim().toLowerCase() === 'undefined') {
            headers.set('Content-Type', 'application/json;odata=nometadata');
          }
          // Force OData 3.0 to avoid issues per user's strict instruction
          if (!headers.has('OData-Version')) {
            headers.set('OData-Version', '3.0');
          }
        } else {
          const currentAccept = headers.get('Accept');
          if (!currentAccept || currentAccept.trim() === '' || currentAccept.trim() === '*/*') {
            headers.set('Accept', 'application/json;odata=nometadata');
          }
        }

        try {
          // eslint-disable-next-line no-restricted-globals
          const response = await fetch(url, { ...init, headers, signal: mergedSignal });
          const retryAfterMs = parseRetryAfterMs(response);

          if (response.ok) {
            recordTelemetry('sp:request_end', {
              url: url.split('?')[0],
              method,
              lane,
              status: response.status,
              attempt,
              queuedMs,
              durationMs: Date.now() - attemptStartedAt,
            });
            span.succeed(response.status, attempt - 1);
            return response;
          }

          let retryable = !skipRetry && isRetryableStatus(response.status);
          
          if (isUpdate && retryable && response.status !== 429 && response.status !== 503) {
             // For update methods, be conservative: only retry 429 and 503 by default unless explicitly skipping
             retryable = false;
          }

          if (retryable && attempt <= maxRetries) {
            let delayMs = computeBackoffMs(attempt, baseDelay, capDelay, retryAfterMs);

            if (response.status === 429) {
              // Forced backoff for 429 incidents as requested (1s per retry count)
              const forcedDelay = 1000 * attempt;
              delayMs = Math.max(delayMs, forcedDelay);

              recordTelemetry('sp:throttled', {
                url: url.split('?')[0],
                method,
                lane,
                status: response.status,
                attempt,
                retryAfterMs: delayMs,
                durationMs: Date.now() - attemptStartedAt,
              });
            }

            recordTelemetry('sp:retry', {
              url: url.split('?')[0],
              method,
              lane,
              status: response.status,
              attempt,
              retryAfterMs: delayMs,
              durationMs: Date.now() - attemptStartedAt,
            });

            if (onRetry) {
              const reason = response.status === 429 ? 'throttle' : 'server';
              try { onRetry(response, { attempt, status: response.status, reason, delayMs }); }
              catch (e) { auditLog.debug('sp:retry', 'callback_failed', { error: String(e) }); }
            }

            await sleep(delayMs, mergedSignal);
            continue;
          }

          // 401/403 Token Refresh logic from original code
          if (!response.ok && (response.status === 401 || response.status === 403)) {
            if (!skipAuthCheck) {
              const token2 = await acquireToken();
              if (token2 && token2 !== initialToken) {
                initialToken = token2; // Set for next loop, immediately retry
                continue;
              }
            }
          }

          // Fall through: max retries reached or non-retryable response
          recordTelemetry('sp:request_failed', {
            url: url.split('?')[0],
            method,
            lane,
            status: response.status,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
          });
          span.fail(response.status, 'SpHttpError', attempt - 1);

          if (throwOnError) {
             console.error('[DEBUG] spFetch DETECTED ERROR STATUS, THROWING...', response.status);
             await raiseHttpError(response, { url, method, spOptions });
          }
          console.error('[DEBUG] spFetch RETURNING WITHOUT THROWING', response.status);
          return response;

        } catch (error) {
          // If the error already has a status, it was thrown by raiseHttpError
          // and should NOT be retried here (as it would be treated as a network error).
          if (error && typeof error === 'object' && 'status' in error) {
            throw error;
          }

          if (isAbortError(error)) {
            recordTelemetry('sp:request_failed', {
              url: url.split('?')[0],
              method,
              lane,
              attempt,
              durationMs: Date.now() - attemptStartedAt,
              message: 'aborted',
            });
            span.error('AbortError', attempt - 1);
            throw error;
          }

          const retryable = !skipRetry && attempt <= maxRetries;
          if (retryable) {
            const delayMs = computeBackoffMs(attempt, baseDelay, capDelay);
            recordTelemetry('sp:retry', {
              url: url.split('?')[0],
              method,
              lane,
              attempt,
              retryAfterMs: delayMs,
              durationMs: Date.now() - attemptStartedAt,
              message: error instanceof Error ? error.message : 'NetworkError',
            });
            await sleep(delayMs, mergedSignal);
            continue;
          }

          recordTelemetry('sp:request_failed', {
            url: url.split('?')[0],
            method,
            lane,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
            message: error instanceof Error ? error.message : 'NetworkError',
          });
          span.error('NetworkError', attempt - 1);
          throw error;
        }
      }

      throw new Error(`Unreachable retry loop exit: ${url}`);
    } finally {
      release();
    }
  };
}
