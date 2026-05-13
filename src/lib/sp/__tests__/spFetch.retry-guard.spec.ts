import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpFetch } from '../spFetch';
import type { EnvRecord } from '@/lib/env';

function createTestEnv(): EnvRecord {
  return {
    VITE_SKIP_LOGIN: '0',
    VITE_SKIP_SHAREPOINT: '0',
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

describe('spFetch retry guard for SharePoint throttle/cors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('retries 429/503 with exponential backoff and then succeeds', async () => {
    const r503a = new Response('busy', { status: 503 });
    const r503b = new Response('busy', { status: 503 });
    const ok = new Response(JSON.stringify({ value: [] }), { status: 200 });
    Object.defineProperty(r503a, 'url', { value: 'https://example.sharepoint.com/sites/welfare/_api/x' });
    Object.defineProperty(r503b, 'url', { value: 'https://example.sharepoint.com/sites/welfare/_api/x' });
    Object.defineProperty(ok, 'url', { value: 'https://example.sharepoint.com/sites/welfare/_api/x' });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(r503a)
      .mockResolvedValueOnce(r503b)
      .mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const spFetch = createFetcher();

    const req = spFetch('/_api/web/lists');
    await vi.runAllTimersAsync();
    const response = await req;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const delays = setTimeoutSpy.mock.calls.map((call) => Number(call[1]));
    expect(delays).toHaveLength(2);
    expect(delays[0]).toBeGreaterThanOrEqual(1600);
    expect(delays[0]).toBeLessThanOrEqual(2400);
    expect(delays[1]).toBeGreaterThanOrEqual(3200);
    expect(delays[1]).toBeLessThanOrEqual(4800);
    expect(delays[1]).toBeGreaterThan(delays[0]);
  });

  it('does not keep retrying on Failed to fetch (CORS-like TypeError)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const spFetch = createFetcher();

    await expect(spFetch('/_api/web/lists')).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
