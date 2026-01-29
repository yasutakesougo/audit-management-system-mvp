import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SharePointItemNotFoundError, SharePointMissingEtagError } from '@/lib/errors';
import { createSpClient } from '@/lib/spClient';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

const baseUrl = 'https://contoso.sharepoint.com/sites/wf/_api/web';
const acquireToken = async () => 'tok';

const jsonRes = (status: number, body: any = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;odata=nometadata', ...headers },
  });

describe('spClient ETag / 412 handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends PATCH with auth headers, refreshes ETag, and retries with the new value', async () => {
    const fetchMock = vi
      .fn(async (..._args: Parameters<typeof fetch>): Promise<Response> => new Response('', { status: 500 }))
      // 1st PATCH → 412 (stale ETag)
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      // GET latest item with new weak ETag
      .mockResolvedValueOnce(jsonRes(200, { Id: 10, Title: 'latest' }, { ETag: 'W/"3"' }))
      // 2nd PATCH succeeds with refreshed ETag
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createSpClient(acquireToken, baseUrl);
    const list = "lists/getbytitle('SupportRecord_Daily')";

    await expect(client.updateItem(list, 10, { Title: 'edited' }, { ifMatch: 'W/"2"' })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);

  const [url1, init1] = fetchMock.mock.calls[0]!;
  expect(init1?.method).toBe('POST'); // SharePoint Online uses POST+X-HTTP-Method:MERGE instead of PATCH
  const url1Obj = new URL(String(url1));
  expect(url1Obj.pathname.endsWith('/items(10)')).toBe(true);
  expect(url1Obj.pathname).toContain('SupportRecord_Daily');
    const headers1 = Object.fromEntries((init1!.headers as Headers).entries());
    expect(headers1['authorization']).toBe('Bearer tok');
    expect(headers1['if-match']).toBe('W/"2"');
    expect(headers1['x-http-method']).toBe('MERGE'); // SharePoint MERGE operation via POST
    expect(headers1['content-type']).toBe('application/json;odata=nometadata');
    expect(headers1['odata-version']).toBe('4.0');

  const [url2, init2] = fetchMock.mock.calls[1]!;
  expect(init2?.method).toBe('GET');
  const url2Obj = new URL(String(url2));
  expect(url2Obj.pathname.endsWith('/items(10)')).toBe(true);
  expect(url2Obj.searchParams.get('$select')).toBe('Id');
    const headers2 = Object.fromEntries((init2!.headers as Headers).entries());
    expect(headers2['authorization']).toBe('Bearer tok');
    expect(headers2['accept']).toBe('application/json;odata=nometadata');

    const [, init3] = fetchMock.mock.calls[2]!;
    expect(init3?.method).toBe('POST'); // Second attempt also uses POST+X-HTTP-Method:MERGE
    const headers3 = Object.fromEntries((init3!.headers as Headers).entries());
    expect(headers3['authorization']).toBe('Bearer tok');
    expect(headers3['if-match']).toBe('W/"3"');
  });

  it('throws a descriptive error if item disappeared (GET 404 after 412)', async () => {
    const fetchMock = vi
      .fn(async (..._args: Parameters<typeof fetch>): Promise<Response> => new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createSpClient(acquireToken, baseUrl);
    const list = "lists/getbytitle('SupportRecord_Daily')";

    await expect(
      client.updateItem(list, 10, { Title: 'edited' }, { ifMatch: 'W/"2"' }),
    ).rejects.toBeInstanceOf(SharePointItemNotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 409 conflict and surfaces the error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 409 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createSpClient(acquireToken, baseUrl);
    const list = "lists/getbytitle('SupportRecord_Daily')";

    await expect(client.updateItem(list, 10, { Title: 'edited' }, { ifMatch: 'W/"2"' })).rejects.toMatchObject({
      status: 409,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 428 precondition required and surfaces the error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 428 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createSpClient(acquireToken, baseUrl);
    const list = "lists/getbytitle('SupportRecord_Daily')";

    await expect(client.updateItem(list, 10, { Title: 'edited' }, { ifMatch: 'W/"2"' })).rejects.toMatchObject({
      status: 428,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails clearly if refreshed ETag header is missing', async () => {
    const fetchMock = vi
      .fn(async (..._args: Parameters<typeof fetch>): Promise<Response> => new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(jsonRes(200, { Id: 10 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createSpClient(acquireToken, baseUrl);
    const list = "lists/getbytitle('SupportRecord_Daily')";

    await expect(
      client.updateItem(list, 10, { Title: 'edited' }, { ifMatch: 'W/"2"' }),
    ).rejects.toBeInstanceOf(SharePointMissingEtagError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
