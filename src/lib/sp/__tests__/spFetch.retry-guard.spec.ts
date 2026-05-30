import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpFetch, __clearSharePointThrottleCircuitBreakerForTests } from '../spFetch';
import type { EnvRecord } from '@/lib/env';

function createTestEnv(): EnvRecord {
  return {
    VITE_SKIP_LOGIN: '0',
    VITE_SKIP_SHAREPOINT: '0',
    VITE_FORCE_SHAREPOINT: '1',
    VITE_DEMO_MODE: '0',
    VITE_E2E_MSAL_MOCK: '0',
    VITE_AUDIT_DEBUG: '0',
  } as unknown as EnvRecord;
}

function createFetcher() {
  return createSpFetch({
    acquireToken: async () => 'test-token',
    baseUrl: 'https://example.sharepoint.com/sites/welfare',
    config: createTestEnv(),
    retrySettings: { maxAttempts: 4, baseDelay: 2000, capDelay: 30000 },
    debugEnabled: false,
    spSiteLegacy: '/sites/welfare',
    throwOnError: false,
  });
}

function createProxyFetcher() {
  return createSpFetch({
    acquireToken: async () => 'test-token',
    baseUrl: 'https://example.sharepoint.com/sites/welfare/_api/web',
    config: {
      ...createTestEnv(),
      VITE_SP_USE_PROXY: '1',
    },
    retrySettings: { maxAttempts: 4, baseDelay: 2000, capDelay: 30000 },
    debugEnabled: false,
    spSiteLegacy: '/sites/welfare',
    throwOnError: false,
  });
}

describe('spFetch retry guard for SharePoint throttle/cors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __clearSharePointThrottleCircuitBreakerForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __clearSharePointThrottleCircuitBreakerForTests();
  });

  it('does not retry when redirected to Throttle.htm', async () => {
    const throttled = new Response('', { status: 200 });
    Object.defineProperty(throttled, 'url', {
      value: 'https://example.sharepoint.com/_layouts/15/Throttle.htm#17',
    });

    const fetchMock = vi.fn().mockResolvedValue(throttled);
    vi.stubGlobal('fetch', fetchMock);

    const spFetch = createFetcher();

    await expect(spFetch('/_api/web/lists')).rejects.toThrow('Throttle.htm');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps CORS "Failed to fetch" as SpThrottleRedirectError and stops immediately', async () => {
    // In production, SharePoint throttle 302 → Throttle.htm lacks CORS headers,
    // causing the browser to throw "Failed to fetch". spFetch now wraps this
    // as SpThrottleRedirectError.
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const spFetch = createFetcher();

    await expect(spFetch('/_api/web/lists')).rejects.toThrow('Throttle.htm');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps NetworkError as SpThrottleRedirectError and stops immediately', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource'));
    vi.stubGlobal('fetch', fetchMock);

    const spFetch = createFetcher();

    await expect(spFetch('/_api/web/lists')).rejects.toThrow('Throttle.htm');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('routes SharePoint requests through same-origin proxy when enabled', async () => {
    const ok = new Response(JSON.stringify({ value: [] }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal('fetch', fetchMock);

    const spFetch = createProxyFetcher();

    const response = await spFetch("/lists/getbytitle('SupportPlans')/fields?$select=InternalName");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const proxyUrl = new URL(String(url), 'https://app.example');
    expect(proxyUrl.pathname).toBe('/api/sp-proxy');
    expect(proxyUrl.searchParams.get('url')).toBe(
      "https://example.sharepoint.com/sites/welfare/_api/web/lists/getbytitle('SupportPlans')/fields?$select=InternalName",
    );
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });
});
