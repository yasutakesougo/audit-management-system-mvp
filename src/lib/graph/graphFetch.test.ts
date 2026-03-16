import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGraphClient, GraphApiError, GraphAuthError } from './graphFetch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({
    graphRetryMax: 2,
    graphRetryBaseMs: 10,
    graphRetryCapMs: 200,
  }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockGetToken.mockResolvedValue('test-token-123');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (status: number, body = ''): Response =>
  new Response(body, { status, statusText: `Error ${status}` });

// ---------------------------------------------------------------------------
// fetchJson
// ---------------------------------------------------------------------------

describe('graphFetch', () => {
  describe('fetchJson', () => {
    it('相対パスを Graph ベースURL に解決してリクエストする', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ displayName: 'John' }));
      const client = createGraphClient(mockGetToken);

      const result = await client.fetchJson<{ displayName: string }>('/me');

      expect(result.displayName).toBe('John');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('絶対URLはそのまま使用する', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = createGraphClient(mockGetToken);

      await client.fetchJson('https://graph.microsoft.com/v1.0/me/events');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/events',
        expect.anything(),
      );
    });

    it('追加ヘッダーがマージされる', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      const client = createGraphClient(mockGetToken);

      await client.fetchJson('/me/calendarView', {
        headers: { Prefer: 'outlook.timezone="Asia/Tokyo"' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            Accept: 'application/json',
            Prefer: 'outlook.timezone="Asia/Tokyo"',
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  describe('認証エラー', () => {
    it('トークンが null の場合 GraphAuthError をスロー', async () => {
      mockGetToken.mockResolvedValueOnce(null);
      const client = createGraphClient(mockGetToken);

      await expect(client.fetchJson('/me')).rejects.toThrow(GraphAuthError);
    });
  });

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------

  describe('リトライ', () => {
    it('429 を受けてリトライし最終的に成功する', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(429))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchJson<{ ok: boolean }>('/me');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('500 を受けてリトライし最終的に成功する', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce(jsonResponse({ value: [] }));

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchJson<{ value: unknown[] }>('/me/events');

      expect(result.value).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('リトライ上限を超えると GraphApiError をスロー', async () => {
      mockFetch
        .mockResolvedValue(errorResponse(503, 'Service Unavailable'));

      const client = createGraphClient(mockGetToken);

      await expect(client.fetchJson('/me')).rejects.toThrow(GraphApiError);
      // retryMax=2 → 初回 + 2リトライ = 3回
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('リトライ不可のステータス(404)は即座にエラー', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'));

      const client = createGraphClient(mockGetToken);

      await expect(client.fetchJson('/me/events/xxx')).rejects.toThrow(GraphApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('Retry-After ヘッダーを尊重する', async () => {
      const retryResponse = new Response('', {
        status: 429,
        headers: { 'Retry-After': '0' },
      });
      mockFetch
        .mockResolvedValueOnce(retryResponse)
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchJson<{ ok: boolean }>('/me');

      expect(result.ok).toBe(true);
    });

    it('ネットワーク障害でもリトライする', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchJson<{ ok: boolean }>('/me');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('AbortError はリトライせずそのまま再スロー', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const client = createGraphClient(mockGetToken);

      await expect(client.fetchJson('/me')).rejects.toThrow('Aborted');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Error shape
  // ---------------------------------------------------------------------------

  describe('エラー形状', () => {
    it('GraphApiError に status / statusText / body が含まれる', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'));

      const client = createGraphClient(mockGetToken);

      try {
        await client.fetchJson('/me');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(GraphApiError);
        const err = e as GraphApiError;
        expect(err.status).toBe(403);
        expect(err.body).toBe('Forbidden');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // fetchAllPages
  // ---------------------------------------------------------------------------

  describe('fetchAllPages', () => {
    it('単一ページの結果を返す', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ value: [{ id: '1' }, { id: '2' }] }),
      );

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchAllPages<{ id: string }>('/me/memberOf?$select=id');

      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });

    it('複数ページを自動走査して全件返す', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({
            value: [{ id: '1' }],
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/memberOf?$skiptoken=xxx',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ value: [{ id: '2' }, { id: '3' }] }),
        );

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchAllPages<{ id: string }>('/me/memberOf?$select=id');

      expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('空ページを正しく処理する', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      const client = createGraphClient(mockGetToken);
      const result = await client.fetchAllPages<{ id: string }>('/me/memberOf');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // retryMax override
  // ---------------------------------------------------------------------------

  describe('retryMax 個別上書き', () => {
    it('options.retryMax で個別にリトライ回数を指定できる', async () => {
      mockFetch.mockResolvedValue(errorResponse(503));

      const client = createGraphClient(mockGetToken);

      await expect(
        client.fetchJson('/me', { retryMax: 0 }),
      ).rejects.toThrow(GraphApiError);

      // retryMax=0 → 1回のみ
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
