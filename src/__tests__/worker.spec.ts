import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../worker';

describe('Cloudflare Worker - SharePoint Proxy', () => {
  const defaultEnv = {
    ASSETS: { fetch: vi.fn() },
    VITE_SP_RESOURCE: 'https://example.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/welfare',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns 204 for OPTIONS request without auth', async () => {
    const request = new Request('https://app.example/api/sp-proxy', {
      method: 'OPTIONS',
    });
    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(204);
  });

  it('returns 401 if Authorization header is missing', async () => {
    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2Fwelfare%2F_api%2Fweb%2Flists', {
      method: 'GET',
    });
    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'missing_bearer_token' });
  });

  it('returns 500 if VITE_SP_RESOURCE is not configured', async () => {
    const env = { ...defaultEnv, VITE_SP_RESOURCE: '' };
    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2Fwelfare%2F_api%2Fweb%2Flists', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'sp_proxy_not_configured' });
  });

  it('returns 400 for invalid target url', async () => {
    const request = new Request('https://app.example/api/sp-proxy?url=not-a-url', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'invalid_target_url' });
  });

  it('returns 403 if target origin does not match configured resource', async () => {
    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fmalicious.com%2Fsites%2Fwelfare%2F_api%2Fweb%2Flists', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('target_not_allowed');
  });

  it('returns 403 if target path does not start with allowed API path', async () => {
    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2Fother%2F_api%2Fweb%2Flists', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('target_not_allowed');
  });

  it('forwards request to target and returns target response if allowed', async () => {
    const targetResponse = new Response('{"d":[]}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'ETag': 'W/"1"' },
    });
    const fetchMock = vi.fn().mockResolvedValue(targetResponse);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2Fwelfare%2F_api%2Fweb%2Flists', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-token',
        Accept: 'application/json',
      },
    });

    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('{"d":[]}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledReq = fetchMock.mock.calls[0][0] as Request;
    expect(calledReq.url).toBe('https://example.sharepoint.com/sites/welfare/_api/web/lists');
    expect(calledReq.headers.get('Authorization')).toBe('Bearer valid-token');
    expect(calledReq.headers.get('Accept')).toBe('application/json');

    // Headers picked from response
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('ETag')).toBe('W/"1"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
