import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpClient } from '@/lib/spClient';
import { SharePointItemNotFoundError, SharePointMissingEtagError } from '@/lib/errors';

const defaultConfig = {
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/demo',
};

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({ ...defaultConfig }),
  readEnv: (key: string, fallback: string) => (defaultConfig as any)[key] ?? fallback,
  skipSharePoint: () => false,
  shouldSkipLogin: () => false,
  isE2eMsalMockEnabled: () => false,
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ acquireToken: vi.fn() }),
}));

describe('spClient more branches', () => {
  const baseUrl = `${defaultConfig.VITE_SP_RESOURCE}${defaultConfig.VITE_SP_SITE_RELATIVE}/_api/web`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createItem variations', () => {
    it('returns null when the response status is 204', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const acquireToken = vi.fn().mockResolvedValue('token');
      const client = createSpClient(acquireToken, baseUrl);

      const result = await client.createItem('List', {});
      expect(result).toBeNull();
    });

    it('returns text body when the response is not json', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const acquireToken = vi.fn().mockResolvedValue('token');
      const client = createSpClient(acquireToken, baseUrl);

      const result = await client.createItem('List', {});
      expect(result).toBe('ok');
    });
  });

  describe('patchListItem etag refresh branches', () => {
    it('refreshes etag after 412 and succeeds on retry', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        const method = init.method?.toUpperCase();
        if (method === 'GET') {
          return new Response(JSON.stringify({ Id: 1 }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ETag: '"123"' } 
          });
        }
        if (method === 'POST') {
          // Check If-Match header (handle both Headers object and plain object)
          const h = init.headers;
          const ifMatch = (typeof (h as any)?.get === 'function') ? (h as any).get('If-Match') : (h as any)?.['If-Match'];
          
          if (ifMatch === '"123"') return new Response(null, { status: 204 });
          return new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' });
        }
        return new Response('unexpected', { status: 500 });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const acquireToken = vi.fn().mockResolvedValue('token');
      const client = createSpClient(acquireToken, baseUrl);

      const res = await client.patchListItem('List', 1, { Name: 'A' });
      expect(res.status).toBe(204);
    });

    it('throws SharePointItemNotFoundError when fallback fetch hits 404', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        const method = init.method?.toUpperCase();
        if (method === 'GET') return new Response('not found', { status: 404, statusText: 'Not Found' });
        return new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const acquireToken = vi.fn().mockResolvedValue('token');
      const client = createSpClient(acquireToken, baseUrl);

      await expect(client.patchListItem('List', 1, { Name: 'A' })).rejects.toThrow(SharePointItemNotFoundError);
    });

    it('throws SharePointMissingEtagError when refreshed etag is absent', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        const method = init.method?.toUpperCase();
        if (method === 'GET') return new Response(JSON.stringify({ Id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        return new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const acquireToken = vi.fn().mockResolvedValue('token');
      const client = createSpClient(acquireToken, baseUrl);

      await expect(client.patchListItem('List', 1, { Name: 'A' })).rejects.toThrow(SharePointMissingEtagError);
    });

    it('throws SharePointMissingEtagError when 412 persists after refreshing etag', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        const method = init.method?.toUpperCase();
        if (method === 'GET') return new Response(JSON.stringify({ Id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"abc"' } });
        if (method === 'POST') return new Response('precondition failed', { status: 412, statusText: 'Precondition Failed' });
        return new Response('unexpected', { status: 500 });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const acquireToken = vi.fn().mockResolvedValue('token');
      const client = createSpClient(acquireToken, baseUrl);

      await expect(client.patchListItem('List', 1, { Name: 'A' })).rejects.toThrow('SharePoint returned 412 after refreshing ETag');
    });
  });
});
