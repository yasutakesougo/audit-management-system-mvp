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

  const encodeJwtSegment = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const validGraphToken = (): string =>
    `${encodeJwtSegment({ alg: 'none', typ: 'JWT' })}.${encodeJwtSegment({ tid: 'tenant-1', oid: 'oid-1' })}.signature`;

  const decodeJwtPayload = (token: string): Record<string, unknown> =>
    JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;

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

  it('allows request targeting VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE if configured', async () => {
    const targetResponse = new Response('{"d":[]}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchMock = vi.fn().mockResolvedValue(targetResponse);
    vi.stubGlobal('fetch', fetchMock);

    const envWithBilling = {
      ...defaultEnv,
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/2',
    };

    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2F2%2F_api%2Fweb%2Flists', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-token',
        Accept: 'application/json',
      },
    });

    const response = await worker.fetch(request, envWithBilling);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('{"d":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledReq = fetchMock.mock.calls[0][0] as Request;
    expect(calledReq.url).toBe('https://example.sharepoint.com/sites/2/_api/web/lists');
  });

  it('still rejects requests targeting other sites when billing site is configured', async () => {
    const envWithBilling = {
      ...defaultEnv,
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/2',
    };

    const request = new Request('https://app.example/api/sp-proxy?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2Fevil%2F_api%2Fweb%2Flists', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    const response = await worker.fetch(request, envWithBilling);
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

  it('returns 401 for Firebase exchange without a bearer token', async () => {
    const request = new Request('https://app.example/api/firebase/exchange', { method: 'POST' });
    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'missing_bearer_token' });
  });

  it('returns 401 for Firebase exchange with an invalid JWT format', async () => {
    const request = new Request('https://app.example/api/firebase/exchange', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_token_format' });
  });

  it('returns 401 when Graph verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const request = new Request('https://app.example/api/firebase/exchange', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validGraphToken()}` },
    });
    const response = await worker.fetch(request, {
      ...defaultEnv,
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: 'firebase-project',
        client_email: 'service@example.iam.gserviceaccount.com',
        private_key: 'AQID',
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'token_verification_failed' });
  });

  it('returns 500 when Firebase service account configuration is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'graph-id' }), { status: 200 })));
    const request = new Request('https://app.example/api/firebase/exchange', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validGraphToken()}` },
    });
    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'service_account_not_configured' });
  });

  it('returns a Firebase custom token when Graph and service account configuration succeed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'graph-id',
      displayName: 'Test User',
      userPrincipalName: 'test@example.com',
    }), { status: 200 })));
    const subtle = {
      importKey: vi.fn().mockResolvedValue({}),
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    };
    vi.stubGlobal('crypto', { subtle });
    const request = new Request('https://app.example/api/firebase/exchange', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validGraphToken()}` },
    });
    const response = await worker.fetch(request, {
      ...defaultEnv,
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: 'firebase-project',
        client_email: 'service@example.iam.gserviceaccount.com',
        private_key: 'AQID',
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { firebaseCustomToken?: string; actor?: { id?: string } };
    expect(body.firebaseCustomToken?.split('.')).toHaveLength(3);
    expect(body.actor).toEqual({ id: 'aad:oid-1', name: 'Test User' });
    const tokenPayload = decodeJwtPayload(body.firebaseCustomToken!);
    expect(tokenPayload.iss).toBe('service@example.iam.gserviceaccount.com');
    expect(tokenPayload.sub).toBe('service@example.iam.gserviceaccount.com');
    expect(tokenPayload.aud).toBe('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
    expect(tokenPayload.uid).toBe('aad:oid-1');
    expect(tokenPayload.claims).toEqual({
      orgId: 'tenant-1',
      actorId: 'aad:oid-1',
      actorName: 'Test User',
    });
    expect(tokenPayload.iat).toEqual(expect.any(Number));
    expect(tokenPayload.exp).toEqual(expect.any(Number));
    expect((tokenPayload.exp as number) - (tokenPayload.iat as number)).toBe(3600);
  });
});
