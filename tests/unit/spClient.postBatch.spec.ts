import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpClient } from '../../src/lib/spClient';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

// Additional coverage for createSpClient helper functions: getListItemsByTitle, addListItemByTitle, postBatch

describe('spClient additional coverage (postBatch + list/add)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let acquireToken: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch' as any);
    acquireToken = vi.fn().mockResolvedValue('tok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getListItemsByTitle builds query string with select/filter/orderby/top', async () => {
    const json = { value: [{ Id: 1 }] };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(json), { status: 200 }));
    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const rows = await client.getListItemsByTitle('X', ['Id','Title'], "Title eq 'A'", 'Id desc', 10);
    expect(rows.length).toBe(1);
    const url = (fetchSpy.mock.calls[0][0] as string);
  // URLSearchParams encodes special chars so we assert on encoded components
  expect(url).toContain("%24select=Id%2CTitle");
  expect(url).toContain("%24filter=Title+eq+%27A%27");
  expect(url).toContain("%24orderby=Id+desc");
  expect(url).toContain("%24top=10");
  });

  it('addListItemByTitle returns created item', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ Id: 99, Title: 'Created' }), { status: 200 }));
    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const created: any = await client.addListItemByTitle('X', { Title: 'Created' });
    expect(created.Id).toBe(99);
    const body = (fetchSpy.mock.calls[0][1] as any).body;
    expect(body).toContain('Created');
  });

  it('postBatch success without retry', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const res = await client.postBatch('--body--', 'boundary');
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
  expect(url.endsWith('/_api/$batch')).toBe(true);
  });

  it('postBatch retries on 429 then succeeds', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('Too Many', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));
    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const res = await client.postBatch('--body--', 'boundary');
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
