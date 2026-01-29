import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpClient } from '../../src/lib/spClient';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false), // ← Disable SharePoint mocking for these tests
    shouldSkipLogin: vi.fn(() => false), // ← Force real auth flow testing
  };
});

describe('Retry-After absolute date', () => {
  const BASE_URL = 'https://contoso.sharepoint.com/sites/Audit/_api/web';

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits until absolute date, then succeeds and emits onRetry metadata', async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const retryDate = new Date(Date.now() + 2000).toUTCString();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('', {
          status: 429,
          headers: { 'Retry-After': retryDate },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const client = createSpClient(async () => 'token', BASE_URL, { onRetry });

    const promise = client.listItems('Users', { top: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    const rows = await promise;

    expect(rows).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const [, meta] = onRetry.mock.calls[0] as [Response, { status?: number; reason: string; attempt: number; delayMs: number }];
    expect(meta).toMatchObject({ status: 429, reason: 'throttle', attempt: 1 });
    expect(typeof meta.delayMs).toBe('number');
  });
});
