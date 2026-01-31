import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeTestConfig } from '../helpers/mockEnv';
import { installTestResets } from '../helpers/reset';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: vi.fn(() => mergeTestConfig()),
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

import { createSpClient, type SharePointRetryMeta } from '@/lib/spClient';

describe('spClient – 429 Retry-After (HTTP-date) → retry then success', () => {
  installTestResets();

  const baseUrl = 'https://contoso.sharepoint.com/sites/app/_api/web';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for the HTTP-date retry window before retrying successfully', async () => {
    const acquire = vi.fn().mockResolvedValue('token');
    const onRetry = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const retryDate = new Date(Date.now() + 2000).toUTCString();

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Too Many Requests' } }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryDate,
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: 'ok-date' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const client = createSpClient(acquire, baseUrl, { onRetry });
    const promise = client.listItems('lists/Foo', { top: 1 });

    await vi.advanceTimersByTimeAsync(2000);
    const rows = await promise;
    const ids = (rows as Array<{ id: string }>).map((row) => row.id);

    expect(ids).toEqual(['ok-date']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const meta = onRetry.mock.calls[0]?.[1] as SharePointRetryMeta;
    expect(meta).toMatchObject({ status: 429, reason: 'throttle', attempt: 1 });
    expect(meta.delayMs).toBeGreaterThanOrEqual(2000);
  });
});
