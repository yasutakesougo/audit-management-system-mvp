/**
 * SharePoint $batch POST — retry-aware batch submission
 *
 * Extracted from spClient.ts createSpClient().postBatch for single-responsibility.
 * The batch payload builder/parser remain in spBatch.ts (SSOT).
 */

import { auditLog } from '@/lib/debugLogger';
import type { EnvRecord } from '@/lib/env';
import { isE2eMsalMockEnabled, shouldSkipLogin, skipSharePoint } from '@/lib/env';
import type { E2eDebugWindow } from './types';

// ─── Dependencies ───────────────────────────────────────────────────────────

export type PostBatchDeps = {
  spFetch: (path: string, init?: import('./types').SpRequestInit) => Promise<Response>;
  baseUrl: string;
  config: EnvRecord;
};

// ─── Factory ────────────────────────────────────────────────────────────────

export function createPostBatch(deps: PostBatchDeps) {
  const { spFetch, baseUrl, config } = deps;

  return async function postBatch(batchBody: string, boundary: string): Promise<Response> {
    const isE2EWithMsalMock = isE2eMsalMockEnabled(config);
    const shouldMock = !isE2EWithMsalMock && (!baseUrl || baseUrl === '' || skipSharePoint(config) || shouldSkipLogin(config));

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

    // Real $batch via unified spFetch (with semaphore, retry, and telemetry)
    const apiRoot = baseUrl.replace(/\/web\/?$/, '');

    // E2E instrumentation
    if (typeof window !== 'undefined') {
      try {
        const e2eWindow = window as E2eDebugWindow;
        e2eWindow.__E2E_BATCH_URL__ = `${apiRoot}/$batch`;
        e2eWindow.__E2E_BATCH_ATTEMPTS__ = (e2eWindow.__E2E_BATCH_ATTEMPTS__ || 0) + 1;
      } catch { /* noop */ }
    }

    const headers = new Headers({ 
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
      'Accept': 'application/json;odata=nometadata'
    });

    return spFetch(`${apiRoot}/$batch`, { method: 'POST', headers, body: batchBody });
  };
}
