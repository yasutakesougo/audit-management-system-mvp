import { resilientFetch } from '@/features/nurse/sp/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const buildResponse = (body: unknown, init: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });

describe('resilientFetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retries on 503 and respects Retry-After headers', async () => {
    let callCount = 0;
    const responses = [
      buildResponse(
        { error: { message: { value: 'service unavailable' } } },
        { status: 503, headers: { 'Retry-After': '1' } },
      ),
      buildResponse({ result: 'ok' }, { status: 200 }),
    ];

    globalThis.fetch = vi.fn(async () => {
      const response = responses[callCount] ?? responses[responses.length - 1];
      callCount += 1;
      return response;
    });

    const promise = resilientFetch('https://example.test/api/nurse', { method: 'POST' }, 3, 10);

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
