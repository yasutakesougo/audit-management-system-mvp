/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SharePoint $batch POST — retry-aware batch submission
 *
 * Extracted from spClient.ts createSpClient().postBatch for single-responsibility.
 * The batch payload builder/parser remain in spBatch.ts (SSOT).
 */

import { auditLog } from '@/lib/debugLogger';
import { isE2eMsalMockEnabled, shouldSkipLogin, skipSharePoint } from '@/lib/env';
import { AuthRequiredError } from '@/lib/errors';
import type { E2eDebugWindow } from './types';

// ─── Dependencies ───────────────────────────────────────────────────────────

export type PostBatchDeps = {
  acquireToken: () => Promise<string | null>;
  baseUrl: string;
  config: Record<string, any>;
  retrySettings: { maxAttempts: number; baseDelay: number; capDelay: number };
  debugEnabled: boolean;
};

// ─── Factory ────────────────────────────────────────────────────────────────

export function createPostBatch(deps: PostBatchDeps) {
  const { acquireToken, baseUrl, config, retrySettings, debugEnabled } = deps;

  return async function postBatch(batchBody: string, boundary: string): Promise<Response> {
    const isE2EWithMsalMock = isE2eMsalMockEnabled(config as any);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(config as any) || shouldSkipLogin(config as any));

    // Mock response for dev/demo/skip-login
    if (shouldMock) {
      if (config.isDev) {
        auditLog.debug('sp:batch', 'mock_response');
      }
      const mockBatchResponse = (opCount: number) => {
        const parts: string[] = [];
        for (let i = 0; i < opCount; i++) {
          parts.push(`--${boundary}`);
          parts.push('Content-Type: application/http');
          parts.push('Content-Transfer-Encoding: binary');
          parts.push('');
          parts.push('HTTP/1.1 204 No Content');
          parts.push('');
        }
        parts.push(`--${boundary}--`);
        return new Response(parts.join('\r\n'), {
          status: 200, statusText: 'OK',
          headers: { 'Content-Type': `multipart/mixed; boundary=${boundary}` },
        });
      };
      const operationCount = (batchBody.match(new RegExp(`--${boundary}`, 'g')) || []).length - 1;
      return Promise.resolve(mockBatchResponse(Math.max(1, operationCount)));
    }

    // Real $batch with retry
    const apiRoot = baseUrl.replace(/\/web\/?$/, '');
    const { maxAttempts, baseDelay, capDelay } = retrySettings;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const computeBackoff = (attempt: number) => {
      const expo = Math.min(capDelay, baseDelay * Math.pow(2, attempt - 1));
      return Math.round(Math.random() * expo); // full jitter
    };

    let attempt = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const token = await acquireToken();
      const skipAuthCheck = shouldSkipLogin(config as any) || isE2eMsalMockEnabled(config as any);
      if (!token && !skipAuthCheck) throw new AuthRequiredError();

      const headers = new Headers({ 'Content-Type': `multipart/mixed; boundary=${boundary}` });
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const res = await fetch(`${apiRoot}/$batch`, { method: 'POST', headers, body: batchBody });

      // E2E instrumentation
      if (typeof window !== 'undefined') {
        try {
          const e2eWindow = window as E2eDebugWindow;
          e2eWindow.__E2E_BATCH_URL__ = `${apiRoot}/$batch`;
          e2eWindow.__E2E_BATCH_ATTEMPTS__ = (e2eWindow.__E2E_BATCH_ATTEMPTS__ || 0) + 1;
        } catch { /* noop */ }
      }

      if (res.ok) return res;

      const shouldRetry = [429, 503, 504].includes(res.status) && attempt < maxAttempts;
      if (shouldRetry) {
        let waitMs: number | null = null;
        const ra = res.headers.get('Retry-After');
        if (ra) {
          const sec = Number(ra);
          if (!isNaN(sec) && sec > 0) { waitMs = sec * 1000; }
          else { const ts = Date.parse(ra); if (!isNaN(ts)) waitMs = Math.max(0, ts - Date.now()); }
        }
        if (waitMs == null) waitMs = computeBackoff(attempt);
        if (debugEnabled) auditLog.debug('sp:retry', 'batch', { status: res.status, nextAttempt: attempt + 1, waitMs });
        await sleep(waitMs);
        attempt += 1;
        continue;
      }

      // Non-retryable error
      const text = await res.text();
      let msg = `Batch API に失敗しました (${res.status} ${res.statusText})`;
      try { const j = JSON.parse(text); msg = j['odata.error']?.message?.value || msg; } catch { /* noop */ }
      const guid = res.headers.get('sprequestguid') || res.headers.get('request-id');
      if (guid) msg += `\nSPRequestGuid: ${guid}`;
      throw new Error(msg);
    }
  };
}
