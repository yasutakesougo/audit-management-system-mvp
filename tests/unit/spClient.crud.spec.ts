import { getAppConfig } from '@/lib/env';
import type { UseSP } from '@/lib/spClient';
import { createSchedule, createSpClient } from '@/lib/spClient';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  const defaultConfig = {
    VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/demo',
    VITE_SP_RETRY_MAX: '3',
    VITE_SP_RETRY_BASE_MS: '10',
    VITE_SP_RETRY_MAX_DELAY_MS: '50',
    VITE_MSAL_CLIENT_ID: '',
    VITE_MSAL_TENANT_ID: '',
    VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    VITE_AUDIT_DEBUG: '',
    VITE_AUDIT_BATCH_SIZE: '',
    VITE_AUDIT_RETRY_MAX: '',
    VITE_AUDIT_RETRY_BASE: '',
    VITE_E2E: '',
    schedulesCacheTtlSec: 60,
    graphRetryMax: 2,
    graphRetryBaseMs: 100,
    graphRetryCapMs: 200,
    schedulesTz: 'Asia/Tokyo',
    schedulesWeekStart: 1,
    isDev: false,
  } as const;
  const getAppConfig = vi.fn(() => ({ ...defaultConfig }));
  const isDemoModeEnabled = vi.fn(() => true);
  return {
    ...actual,
    getAppConfig,
    isDemoModeEnabled,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

const baseConfig = {
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/demo',
  VITE_SP_SITE_URL: 'https://contoso.sharepoint.com/sites/demo',
  VITE_SP_RETRY_MAX: '3',
  VITE_SP_RETRY_BASE_MS: '10',
  VITE_SP_RETRY_MAX_DELAY_MS: '50',
  VITE_MSAL_CLIENT_ID: '',
  VITE_MSAL_TENANT_ID: '',
  VITE_MSAL_TOKEN_REFRESH_MIN: '300',
  VITE_AUDIT_DEBUG: '',
  VITE_AUDIT_BATCH_SIZE: '',
  VITE_AUDIT_RETRY_MAX: '',
  VITE_AUDIT_RETRY_BASE: '',
  VITE_E2E: '',
  schedulesCacheTtlSec: 60,
  graphRetryMax: 2,
  graphRetryBaseMs: 100,
  graphRetryCapMs: 200,
  schedulesTz: 'Asia/Tokyo',
  schedulesWeekStart: 1,
  isDev: false,
} as const;

const minimalSchedulePayload: Parameters<typeof createSchedule>[1] = {
  Title: 'noop',
  EventDate: '2025-01-01T00:00:00Z',
  EndDate: '2025-01-01T01:00:00Z',
  AllDay: false,
  Location: null,
  Status: 'planned',
  Notes: null,
  StaffIdId: null,
  UserIdId: null,
  ServiceType: null,
};

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    debug: vi.fn(),
  },
}));

describe('createSpClient CRUD helpers', () => {
  const baseUrl = 'https://contoso.sharepoint.com/sites/demo/_api/web';
  const originalFetch = global.fetch;
  const mockedGetAppConfig = vi.mocked(getAppConfig);

  let acquireToken: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockedGetAppConfig.mockClear();
    mockedGetAppConfig.mockImplementation(() => ({ ...baseConfig }));
    acquireToken = vi.fn<() => Promise<string | null>>().mockResolvedValue('token');
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete (globalThis as { __TOKEN_METRICS__?: unknown }).__TOKEN_METRICS__;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('updateItemByTitle returns parsed JSON payload', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Title: 'Updated' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    const result = await client.updateItemByTitle('Announcements', 42, { Title: 'Updated' }, { ifMatch: '"3"' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/lists/getbytitle('Announcements')/items(42)");
    expect((init as RequestInit | undefined)?.method).toBe('POST'); // SharePoint Online uses POST+X-HTTP-Method:MERGE
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    expect(headers.get('X-HTTP-Method')).toBe('MERGE');
    expect(result).toEqual({ Title: 'Updated' });
  });

  it('deleteItemByTitle issues DELETE with wildcard If-Match', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.deleteItemByTitle('Announcements', 7);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/lists/getbytitle('Announcements')/items(7)");
    expect((init as RequestInit | undefined)?.method).toBe('DELETE');
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    expect(headers.get('If-Match')).toBe('*');
  });

  it('getItemById passes through optional AbortSignal', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Id: 10 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    const controller = new AbortController();
    const row = await client.getItemById<{ Id: number }>('Announcements', 10, ['Id', 'Title'], controller.signal);

    expect(row.Id).toBe(10);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toBeDefined();
    expect((init as RequestInit).signal).toBe(controller.signal);
  });

  it('getItemByIdWithEtag returns data and ETag header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Id: 11 }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: '"5"',
      },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    const { item, etag } = await client.getItemByIdWithEtag<{ Id: number }>('Announcements', 11, ['Id']);

    expect(item.Id).toBe(11);
    expect(etag).toBe('"5"');
  });

  it('createItem serialises body and unwraps JSON response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ Id: 99, Title: 'Created' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    const payload = { Title: 'Created' };
    const result = await client.createItem<typeof payload>('lists/getbytitle(\'Announcements\')', payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit | undefined)?.method).toBe('POST');
    expect(result).toEqual({ Id: 99, Title: 'Created' });
  });

  it('updateItem delegates to patchListItem for generic identifiers', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.updateItem('lists/getbytitle(\'Announcements\')', 5, { Title: 'Edited' }, { ifMatch: 'W/"1"' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit | undefined)?.method).toBe('POST'); // POST+X-HTTP-Method:MERGE
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    expect(headers.get('X-HTTP-Method')).toBe('MERGE');
  });

  it('deleteItem removes SharePoint items by generic identifier', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.deleteItem('lists/getbytitle(\'Announcements\')', 8);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit | undefined)?.method).toBe('DELETE');
  });

  it('listItems accepts absolute list paths without double encoding', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.listItems("/lists/getbytitle('Announcements')", { top: 3 });

    const [url] = fetchMock.mock.calls[0] ?? [];
  expect(String(url)).toBe("https://contoso.sharepoint.com/sites/demo/_api/web/lists/getbytitle('Announcements')/items?%24top=3");
  });

  it('listItems normalizes SharePoint list identifiers lacking a leading slash', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.listItems("lists/getbytitle('Announcements')", { top: 2 });

    const [url] = fetchMock.mock.calls[0] ?? [];
  expect(String(url)).toBe("https://contoso.sharepoint.com/sites/demo/_api/web/lists/getbytitle('Announcements')/items?%24top=2");
  });

  it('listItems resolves GUID style identifiers into lists(guid)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    const guid = '{123e4567-e89b-12d3-a456-426614174000}';
    await client.listItems(guid, { top: 1 });

    const [url] = fetchMock.mock.calls[0] ?? [];
  expect(String(url)).toBe("https://contoso.sharepoint.com/sites/demo/_api/web/lists(guid'123e4567-e89b-12d3-a456-426614174000')/items?%24top=1");
  });

  it('listItems rejects blank identifiers with a descriptive error', async () => {
    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.listItems('')).rejects.toThrow('SharePoint list identifier is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('listItems follows continuation links until the page cap is reached', async () => {
    const nextLink = `${baseUrl}/lists/getbytitle('Announcements')/items?$skiptoken=Paged=TRUE`;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ Id: 1 }],
        '@odata.nextLink': nextLink,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ Id: 2 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const client = createSpClient(acquireToken, baseUrl);
    const rows = await client.listItems("lists/getbytitle('Announcements')", { top: 2, pageCap: 2 });

    expect(rows).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('normalisePath handles relative, same-origin, and external URLs', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));

    const client = createSpClient(acquireToken, baseUrl);

    await client.spFetch("lists/getbytitle('Announcements')/items");
    await client.spFetch('https://contoso.sharepoint.com/sites/demo/_api/web/lists?skip=1');
    await client.spFetch('https://external.contoso.com/api');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);
    const secondUrl = String(fetchMock.mock.calls[1]?.[0]);
    const thirdUrl = String(fetchMock.mock.calls[2]?.[0]);

    expect(firstUrl).toBe("https://contoso.sharepoint.com/sites/demo/_api/web/lists/getbytitle('Announcements')/items");
    expect(secondUrl).toBe('https://contoso.sharepoint.com/sites/demo/_api/web/lists?skip=1');
    expect(thirdUrl).toBe('https://external.contoso.com/api');
  });

  it('normalisePath returns base-relative paths for same-origin URLs outside the API root', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.spFetch('https://contoso.sharepoint.com/sites/other/_api/web/lists');

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://contoso.sharepoint.com/sites/demo/_api/web/sites/other/_api/web/lists');
  });

  it('normalisePath falls back to the original string when URL parsing fails', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));

    const client = createSpClient(acquireToken, baseUrl);
    await client.spFetch('https://%zz');

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://%zz');
  });

  it('throws a descriptive error when token acquisition fails', async () => {
    acquireToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
    fetchMock.mockImplementation(async () => new Response('', { status: 200 }));

    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.spFetch('/lists')).rejects.toThrow('SharePoint のアクセストークン取得に失敗しました。');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries without delay when jitter computes to zero milliseconds', async () => {
    const first = new Response('', { status: 429 });
    const second = new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    fetchMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const client = createSpClient(acquireToken, baseUrl);
    try {
      const rows = await client.getListItemsByTitle('Users');
      expect(rows).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      mathSpy.mockRestore();
    }
  });

  it('coerceResult yields undefined for empty or non-JSON responses', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', {
        status: 200,
        headers: { 'Content-Length': '0' },
      }))
      .mockResolvedValueOnce(new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }))
      .mockResolvedValueOnce(new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const client = createSpClient(acquireToken, baseUrl);

    await expect(client.createItem('lists/getbytitle(\'Announcements\')', { Title: 'noop' })).resolves.toBeUndefined();
    await expect(client.createItem('lists/getbytitle(\'Announcements\')', { Title: 'noop' })).resolves.toBeUndefined();
    await expect(client.createItem('lists/getbytitle(\'Announcements\')', { Title: 'noop' })).resolves.toBeUndefined();
    await expect(client.createItem('lists/getbytitle(\'Announcements\')', { Title: 'noop' })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('logs token metrics snapshot when debug mode is enabled', async () => {
  mockedGetAppConfig.mockImplementation(() => ({ ...baseConfig, VITE_AUDIT_DEBUG: '1' }));
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    (globalThis as { __TOKEN_METRICS__?: Record<string, unknown> }).__TOKEN_METRICS__ = { refreshed: true };

    const client = createSpClient(acquireToken, baseUrl);
    await client.spFetch('/lists');

    expect(debugSpy).toHaveBeenCalledWith('[spClient]', 'token metrics snapshot', expect.objectContaining({ refreshed: true }));
    debugSpy.mockRestore();
  });

  it('createSchedule resolves without touching SharePoint', async () => {
    const result = await createSchedule({} as UseSP, minimalSchedulePayload);
    expect(result).toMatchObject({ Title: minimalSchedulePayload.Title });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
