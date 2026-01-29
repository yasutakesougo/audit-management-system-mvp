import { __resetAppConfigForTests } from '@/lib/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

import { createSpClient, type SharePointRetryMeta } from '@/lib/spClient';

describe('spClient – retry & paging branches', () => {
  const baseUrl = 'https://contoso.sharepoint.com/sites/app/_api/web';

  beforeEach(() => {
    __resetAppConfigForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    __resetAppConfigForTests();
  });

  it('retries on 503 then succeeds and emits retry metadata', async () => {
    vi.useFakeTimers();

    const acquire = vi.fn().mockResolvedValue('token');
    const onRetry = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy
      .mockResolvedValueOnce(
        new Response('Service Unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: 1 }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const client = createSpClient(acquire, baseUrl, { onRetry });
    const promise = client.listItems('lists/Foo');

    await vi.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const meta = onRetry.mock.calls[0][1] as SharePointRetryMeta;
    expect(meta).toMatchObject({ attempt: 1, status: 503, reason: 'server' });
    expect(meta.delayMs).toBeGreaterThanOrEqual(0);
  });

  it('follows @odata.nextLink pagination until exhaustion', async () => {
    const acquire = vi.fn().mockResolvedValue('token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [{ id: 'p1' }],
            '@odata.nextLink': `${baseUrl}/lists(guid'X')/items?$skiptoken=2`,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ value: [{ id: 'p2' }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const client = createSpClient(acquire, baseUrl);
    const rows = await client.listItems<{ id: string }>('lists/Bar', { top: 1 });

    expect(rows.map((row) => row.id)).toEqual(['p1', 'p2']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('surface text errors from non-JSON 500 responses', async () => {
    const acquire = vi.fn().mockResolvedValue('token');
    const previousRetryMax = process.env.VITE_SP_RETRY_MAX;
    process.env.VITE_SP_RETRY_MAX = '1';
    __resetAppConfigForTests();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response('Internal Boom', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
          statusText: 'Internal Server Error',
        })
      )
    );

    try {
      const client = createSpClient(acquire, baseUrl);
      await expect(client.listItems('SupportRecord_Daily')).rejects.toThrow(/Internal Boom/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      if (previousRetryMax === undefined) {
        delete process.env.VITE_SP_RETRY_MAX;
      } else {
        process.env.VITE_SP_RETRY_MAX = previousRetryMax;
      }
      __resetAppConfigForTests();
    }
  });
});
