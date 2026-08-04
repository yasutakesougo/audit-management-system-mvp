import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSpProxyCorrelation,
  getSpProxyCorrelationSnapshot,
  recordSpProxyCorrelation,
} from '../spProxyCorrelation';

describe('spProxyCorrelation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SP_PROXY_CORRELATION', '1');
    clearSpProxyCorrelation();
  });

  afterEach(() => {
    clearSpProxyCorrelation();
    vi.unstubAllEnvs();
  });

  it('records only safe correlation metadata', () => {
    recordSpProxyCorrelation({
      diagnosticId: 'diag-12345678',
      event: 'http_response',
      occurredAt: '2026-08-04T02:34:00.000Z',
      method: 'get',
      targetPath: "/_api/web/lists/getbytitle('Users_Master')/items(123)?$filter=secret",
      targetList: 'Users_Master',
      status: 403,
      safeErrorCode: 'http_403',
      failureClass: 'http',
      retryClass: 'none',
      retryable: false,
      durationMs: 12.8,
    });

    const snapshot = getSpProxyCorrelationSnapshot();
    expect(snapshot.records[0]).toMatchObject({
      diagnosticId: 'diag-12345678',
      method: 'GET',
      targetPath: "/_api/web/lists/getbytitle('Users_Master')/items(?)",
      status: 403,
      statusClass: '4xx',
      durationMs: 12,
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('secret');
    expect(snapshot.records[0]?.targetPath).not.toContain('/123');
  });

  it('is disabled by default', () => {
    vi.stubEnv('VITE_SP_PROXY_CORRELATION', '0');
    recordSpProxyCorrelation({
      diagnosticId: 'diag-12345678',
      event: 'request_start',
      occurredAt: new Date().toISOString(),
    });
    expect(getSpProxyCorrelationSnapshot().records).toEqual([]);
  });
});
