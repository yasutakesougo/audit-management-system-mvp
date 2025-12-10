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
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 固定値でjitter=100ms
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

  it('falls back to baseDelay when Retry-After header is missing', async () => {
    let callCount = 0;
    const responses = [
      buildResponse({ error: { message: { value: 'busy' } } }, { status: 503 }),
      buildResponse({ result: 'ok' }, { status: 200 }),
    ];

    globalThis.fetch = vi.fn(async () => {
      const response = responses[callCount] ?? responses[responses.length - 1];
      callCount += 1;
      return response;
    });

    const promise = resilientFetch('https://example.test/api/nurse', { method: 'POST' }, 3, 500);

    await vi.advanceTimersByTimeAsync(600); // 500ms base + 100ms jitter
    const result = await promise;

    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 too-many-requests with Retry-After', async () => {
    let callCount = 0;
    const responses = [
      buildResponse({ error: { message: { value: 'throttled' } } }, { status: 429, headers: { 'Retry-After': '2' } }),
      buildResponse({ result: 'ok' }, { status: 200 }),
    ];

    globalThis.fetch = vi.fn(async () => {
      const response = responses[callCount] ?? responses[responses.length - 1];
      callCount += 1;
      return response;
    });

    const promise = resilientFetch('https://example.test/api/nurse', { method: 'GET' }, 3, 10);

    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('stops retrying after the maxAttempts is reached and throws error', async () => {
    const responses = [
      buildResponse({ error: { message: { value: 'busy 1' } } }, { status: 503, headers: { 'Retry-After': '1' } }),
      buildResponse({ error: { message: { value: 'busy 2' } } }, { status: 503, headers: { 'Retry-After': '1' } }),
      buildResponse({ error: { message: { value: 'busy 3' } } }, { status: 503, headers: { 'Retry-After': '1' } }),
      buildResponse({ error: { message: { value: 'busy 4' } } }, { status: 503, headers: { 'Retry-After': '1' } }),
    ];

    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      const response = responses[callCount] ?? responses[responses.length - 1];
      callCount += 1;
      return response;
    });

    const promise = resilientFetch('https://example.test/api/nurse', {}, 3, 10);
    const rejection = expect(promise).rejects.toThrow(/busy [123]/);

    await vi.advanceTimersByTimeAsync(3000);

    await rejection;
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('handles all TRANSIENT_STATUS codes (429, 502, 503, 504)', async () => {
    const transientStatuses = [429, 502, 503, 504];

    for (const status of transientStatuses) {
      let callCount = 0;
      const responses = [
        buildResponse({ error: { message: { value: `error ${status}` } } }, { status, headers: { 'Retry-After': '1' } }),
        buildResponse({ result: 'ok' }, { status: 200 }),
      ];

      globalThis.fetch = vi.fn(async () => {
        const response = responses[callCount] ?? responses[responses.length - 1];
        callCount += 1;
        return response;
      });

      const promise = resilientFetch('https://example.test/api/nurse', {}, 3, 10);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result.status, `Status ${status} should be retried and succeed`).toBe(200);
      expect(globalThis.fetch, `Status ${status} should trigger exactly 2 calls`).toHaveBeenCalledTimes(2);

      vi.clearAllMocks();
    }
  });

  it('does not retry on non-transient status codes (400)', async () => {
    const response = buildResponse(
      { error: { message: { value: 'bad request' } } },
      { status: 400 },
    );

    globalThis.fetch = vi.fn(async () => response);

    // maxAttempts=1 ensures we do not enter the retry backoff branch
    await expect(resilientFetch('https://example.test/api/nurse', {}, 1, 10)).rejects.toThrow('bad request');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles network errors with exponential backoff', async () => {
    let callCount = 0;
    const networkError = new Error('Network connection failed');

    globalThis.fetch = vi.fn(async () => {
      if (callCount === 0) {
        callCount += 1;
        throw networkError;
      }
      callCount += 1;
      return buildResponse({ result: 'ok' }, { status: 200 });
    });

    const promise = resilientFetch('https://example.test/api/nurse', {}, 3, 500);

    await vi.advanceTimersByTimeAsync(600); // 500ms base + 100ms jitter
    const result = await promise;

    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles Retry-After with date format', async () => {
    const futureDate = new Date(Date.now() + 1500);
    let callCount = 0;
    const responses = [
      buildResponse(
        { error: { message: { value: 'rate limited' } } },
        { status: 429, headers: { 'Retry-After': futureDate.toUTCString() } },
      ),
      buildResponse({ result: 'ok' }, { status: 200 }),
    ];

    globalThis.fetch = vi.fn(async () => {
      const response = responses[callCount] ?? responses[responses.length - 1];
      callCount += 1;
      return response;
    });

    const promise = resilientFetch('https://example.test/api/nurse', {}, 3, 10);

    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
