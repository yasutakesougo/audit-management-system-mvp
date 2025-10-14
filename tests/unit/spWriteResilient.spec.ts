import { afterEach, describe, expect, it, vi } from 'vitest';
import { spWriteResilient } from '@/lib/spWrite';

const buildResponse = (body: unknown, init: ResponseInit) =>
  new Response(body != null ? JSON.stringify(body) : null, {
    headers: init.headers,
    status: init.status,
    statusText: init.statusText,
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('spWriteResilient', () => {
  it('succeeds with parsed payload and etag', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse({ ok: true, payload: 1 }, { status: 200, headers: { ETag: 'W/"123"' } })
    );
    const parse = vi.fn(async (response: Response) => ({ parsed: await response.json() }));

    const result = await spWriteResilient({
      list: 'My List',
      method: 'POST',
      fetcher,
      body: { field: 'value' },
      parse,
    });

  expect(result).toMatchObject({ ok: true, status: 200, data: { parsed: { ok: true, payload: 1 } }, etag: 'W/"123"' });
  expect(result.raw).toBeInstanceOf(Response);
    expect(fetcher).toHaveBeenCalledWith("/lists/getbytitle('My%20List')/items", {
      body: JSON.stringify({ field: 'value' }),
      headers: expect.objectContaining({ 'Content-Type': 'application/json;odata=verbose' }),
      method: 'POST',
    });
    expect(parse).toHaveBeenCalled();
  });

  it('returns conflict errors without retries', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse({ message: 'conflict' }, { status: 409, statusText: 'Conflict' })
    );

    const result = await spWriteResilient({
      list: 'Conflicts',
      method: 'POST',
      fetcher,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats precondition failures as hard errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse(null, { status: 412, statusText: 'Precondition Failed' })
    );

    const result = await spWriteResilient({
      list: 'Preconditions',
      method: 'MERGE',
      fetcher,
      retries: 5,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(412);
  });

  it('retries transient errors before succeeding', async () => {
    vi.useFakeTimers();
    const responses = [
      buildResponse(null, { status: 503, statusText: 'Service Unavailable' }),
      buildResponse({ ok: true }, { status: 200, statusText: 'OK' }),
    ];
    const fetcher = vi.fn().mockImplementation(async () => responses.shift()!);

    const resultPromise = spWriteResilient({
      list: 'RetryList',
      method: 'DELETE',
      fetcher,
      retries: 2,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('wraps fetch exceptions after exhausting retries', async () => {
    vi.useFakeTimers();
    const error = new Error('network down');
    const fetcher = vi.fn().mockRejectedValue(error);

    const resultPromise = spWriteResilient({
      list: 'ErrorList',
      method: 'POST',
      fetcher,
      retries: 1,
    });

    await vi.runAllTimersAsync();
  const result = await resultPromise;

  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected failure result');
  expect(result.error).toBe(error);
  });

  it('applies conditional headers and MERGE override for patch methods', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse({ ok: true }, { status: 200, headers: { ETag: 'etag' } })
    );

    await spWriteResilient({
      list: 'Conditional',
      method: 'PATCH',
      fetcher,
      itemId: 42,
      ifMatch: 'W/"etag"',
      additionalHeaders: { 'X-Custom': '1' },
    });

    const [, init] = fetcher.mock.calls[0];
    expect(init?.headers).toMatchObject({
      'If-Match': 'W/"etag"',
      'X-Custom': '1',
      'X-HTTP-Method': 'MERGE',
    });
    expect(fetcher.mock.calls[0][0]).toBe("/lists/getbytitle('Conditional')/items(42)");
  });

  it('propagates non-transient server errors without retrying', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse({ message: 'boom' }, { status: 500, statusText: 'Server Error' })
    );

    const result = await spWriteResilient({
      list: 'ServerList',
      method: 'POST',
      fetcher,
      retries: 3,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    if (!result.ok) {
      expect(result.error.status).toBe(500);
    }
  });

  it('uses custom url builder and skips body serialization for null payloads', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const urlBuilder = vi.fn().mockReturnValue('/custom/path');

    const result = await spWriteResilient({
      list: 'Custom',
      method: 'DELETE',
      fetcher,
      body: null,
      urlBuilder,
    });

    expect(urlBuilder).toHaveBeenCalledWith('Custom', undefined);
    const [, init] = fetcher.mock.calls[0];
    expect(init?.body).toBeUndefined();
    expect(fetcher.mock.calls[0][0]).toBe('/custom/path');
    expect(result.ok).toBe(true);
  });

  it('falls back to parseJsonSafe when parse is not provided', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('not-json', { status: 200 }));

    const result = await spWriteResilient({
      list: 'ParseList',
      method: 'POST',
      fetcher,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success result');
    expect(result.data).toBeUndefined();
  });

  it('throws when fetcher is missing', async () => {
    await expect(
      spWriteResilient({
        list: 'Broken',
        method: 'POST',
        // @ts-expect-error intentional to exercise runtime guard
        fetcher: undefined,
      }),
    ).rejects.toThrow('SharePoint fetcher is required');
  });

  it('wraps non-error rejection with fallback message', async () => {
    const fetcher = vi.fn().mockRejectedValue('boom');

    const result = await spWriteResilient({
      list: 'NonError',
      method: 'DELETE',
      fetcher,
      retries: 0,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.status).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('SharePoint write failed');
    expect(result.error.code).toBeUndefined();
    expect(result.raw).toBeUndefined();
  });

});
