import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { configGetter } = vi.hoisted(() => {
  const cfg = {
    VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/demo',
    VITE_SP_RETRY_MAX: '2',
    VITE_SP_RETRY_BASE_MS: '10',
    VITE_SP_RETRY_MAX_DELAY_MS: '20',
    VITE_MSAL_CLIENT_ID: '',
    VITE_MSAL_TENANT_ID: '',
    VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    VITE_AUDIT_DEBUG: '',
    VITE_AUDIT_BATCH_SIZE: '',
    VITE_AUDIT_RETRY_MAX: '',
    VITE_AUDIT_RETRY_BASE: '',
    schedulesCacheTtlSec: 60,
    graphRetryMax: 2,
    graphRetryBaseMs: 100,
    graphRetryCapMs: 200,
    schedulesTz: 'Asia/Tokyo',
    schedulesWeekStart: 1,
    isDev: false,
  } as const;
  
  const getter = vi.fn(() => cfg);
  
  return {
    baseConfig: cfg,
    configGetter: getter,
  };
});

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: configGetter,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    debug: vi.fn(),
  },
}));

import { createSpClient } from '@/lib/spClient';

describe('createSpClient retry branches', () => {
  const baseUrl = 'https://contoso.sharepoint.com/sites/demo/_api/web';
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('refreshes auth token once after 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { message: { value: 'No signed-in account' } } }),
        { status: 401, statusText: 'Unauthorized', headers: { 'Content-Type': 'application/json' } }
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { message: { value: 'Still unauthorized' } } }),
        { status: 401, statusText: 'Unauthorized', headers: { 'Content-Type': 'application/json' } }
      ));
    global.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValueOnce('token-a').mockResolvedValueOnce('token-b');
    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.getListItemsByTitle('Users')).rejects.toThrow('Still unauthorized');
    expect(acquireToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Headers | undefined;
  const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Headers | undefined;
  expect(firstHeaders?.get('Authorization')).toBe('Bearer token-a');
  expect(secondHeaders?.get('Authorization')).toBe('Bearer token-b');
  });

  it('respects Retry-After header before retrying throttled responses', async () => {
    vi.useFakeTimers();
    const first = new Response('', { status: 429, headers: { 'Retry-After': '1' } });
    const second = new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    global.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl);

    try {
      const promise = client.getListItemsByTitle('Schedules');
      await vi.advanceTimersByTimeAsync(1000);
      const rows = await promise;
      expect(rows).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(acquireToken).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surface server errors after retry exhaustion', async () => {
    const onRetry = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('first failure', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { message: { value: 'Server exploded' } } }),
        { status: 500, statusText: 'Server Error', headers: { 'Content-Type': 'application/json' } }
      ));
    global.fetch = fetchMock as unknown as typeof fetch;
    const acquireToken = vi.fn().mockResolvedValue('token');
    const client = createSpClient(acquireToken, baseUrl, { onRetry });

    await expect(client.getListItemsByTitle('Users')).rejects.toThrow('Server exploded');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(acquireToken).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Response), expect.objectContaining({ reason: 'server', attempt: 1 }));
  });
});
