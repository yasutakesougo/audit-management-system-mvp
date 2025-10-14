import { __resetAppConfigForTests } from '@/lib/env';
import { createSpClient, type SharePointRetryMeta } from '@/lib/spClient';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('spClient – 429 Retry-After seconds → retry then success', () => {
  const baseUrl = 'https://contoso.sharepoint.com/sites/app/_api/web';

  beforeEach(() => {
    __resetAppConfigForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    __resetAppConfigForTests();
  });

  it('respects Retry-After seconds and retries once before succeeding', async () => {
    const acquire = vi.fn().mockResolvedValue('token');
    const onRetry = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Too Many Requests' } }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '2',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: 'ok' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const client = createSpClient(acquire, baseUrl, { onRetry });
    const promise = client.listItems('lists/Foo', { top: 1 });

    await vi.advanceTimersByTimeAsync(2000);
  const rows = await promise;
  const ids = (rows as Array<{ id: string }>).map((row) => row.id);

  expect(ids).toEqual(['ok']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const meta = onRetry.mock.calls[0]?.[1] as SharePointRetryMeta;
    expect(meta).toMatchObject({ attempt: 1, status: 429, delayMs: 2000, reason: 'throttle' });
  });
});
