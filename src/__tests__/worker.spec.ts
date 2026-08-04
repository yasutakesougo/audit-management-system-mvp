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

  it('injects the production provisioning policy into the runtime environment', async () => {
    const assetsFetch = vi.fn().mockResolvedValue(
      new Response('<!doctype html><html><head></head><body></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const response = await worker.fetch(new Request('https://app.example/billing'), {
      ...defaultEnv,
      ASSETS: { fetch: assetsFetch },
      VITE_SKIP_PROVISIONING: '1',
      SP_PROXY_DIAGNOSTICS: '1',
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('"VITE_SKIP_PROVISIONING":"1"');
    expect(html).not.toContain('SP_PROXY_DIAGNOSTICS');
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

  it('keeps proxy diagnostics disabled by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"d":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request(
      'https://app.example/api/sp-proxy?url=' +
        encodeURIComponent('https://example.sharepoint.com/sites/welfare/_api/web/lists'),
      { headers: { Authorization: 'Bearer secret-token', Cookie: 'session=secret-cookie' } },
    );

    await worker.fetch(request, defaultEnv);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'missing bearer token',
      request: () => new Request('https://app.example/api/sp-proxy?url=not-logged', { method: 'GET' }),
      status: 401,
      safeErrorCode: 'missing_bearer_token',
    },
    {
      name: 'invalid target URL',
      request: () => new Request('https://app.example/api/sp-proxy?url=not-a-url', { headers: { Authorization: 'Bearer secret-token' } }),
      status: 400,
      safeErrorCode: 'invalid_target_url',
    },
  ])('classifies $name without logging target values', async ({ request, status, safeErrorCode }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(request(), { ...defaultEnv, SP_PROXY_DIAGNOSTICS: '1' });

    expect(response.status).toBe(status);
    const diagnostic = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(diagnostic).toMatchObject({
      outcome: 'proxy_rejection',
      safeErrorCode,
      status,
      retryClass: 'none',
    });
    expect(diagnostic.durationMs).toEqual(expect.any(Number));
    expect(diagnostic.durationMs as number).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(diagnostic)).not.toContain('not-logged');
    expect(JSON.stringify(diagnostic)).not.toContain('secret-token');
  });

  it('emits sanitized diagnostics for an upstream response', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"error":{"code":"-1, Microsoft.SharePoint.Client.ResourceNotFoundException"}}', {
        status: 404,
        statusText: 'Not Found',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '72',
          'request-id': 'request-123',
          sprequestguid: 'sp-123',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request(
      'https://app.example/api/sp-proxy?url=' +
        encodeURIComponent(
          "https://example.sharepoint.com/sites/welfare/_api/web/lists/getbytitle('Users_Master')/items(123)?$filter=UserID%20eq%20'I019'&token=do-not-log",
        ),
      {
        headers: {
          Authorization: 'Bearer secret-token',
          Cookie: 'session=secret-cookie',
          'cf-ray': 'cf-ray-123',
        },
      },
    );

    const response = await worker.fetch(request, { ...defaultEnv, SP_PROXY_DIAGNOSTICS: '1' });
    expect(response.status).toBe(404);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const diagnostic = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(diagnostic).toMatchObject({
      event: 'sp-proxy',
      outcome: 'upstream_response',
      method: 'GET',
      targetOrigin: 'https://example.sharepoint.com',
      targetList: 'Users_Master',
      targetPath: "/sites/welfare/_api/web/lists/getbytitle('Users_Master')/items(?)",
      queryKeys: ['$filter', 'token'],
      status: 404,
      statusText: 'Not Found',
      contentType: 'application/json',
      contentLength: 72,
      requestId: 'request-123',
      cfRay: 'cf-ray-123',
      sprequestguid: 'sp-123',
      safeErrorCode: 'http_404',
      retryClass: 'none',
    });
    expect(diagnostic.diagnosticId).toEqual(expect.any(String));
    expect(diagnostic.durationMs).toEqual(expect.any(Number));
    expect(diagnostic.durationMs as number).toBeGreaterThanOrEqual(0);

    const serialized = JSON.stringify(diagnostic);
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('secret-cookie');
    expect(serialized).not.toContain('I019');
    expect(serialized).not.toContain('do-not-log');
    expect(serialized).not.toContain('ResourceNotFoundException');
  });

  it.each([
    { status: 200, safeErrorCode: 'ok', retryClass: 'none' },
    { status: 429, safeErrorCode: 'http_429', retryClass: 'throttle' },
    { status: 500, safeErrorCode: 'http_500', retryClass: 'server' },
  ])('classifies upstream status $status without changing the response', async ({ status, safeErrorCode, retryClass }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request(
      'https://app.example/api/sp-proxy?url=' +
        encodeURIComponent('https://example.sharepoint.com/sites/welfare/_api/web/lists'),
      { headers: { Authorization: 'Bearer secret-token' } },
    );
    const response = await worker.fetch(request, { ...defaultEnv, SP_PROXY_DIAGNOSTICS: '1' });

    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe('{"ok":true}');
    const diagnostic = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(diagnostic).toMatchObject({ outcome: 'upstream_response', status, safeErrorCode, retryClass });
    expect(diagnostic.durationMs).toEqual(expect.any(Number));
    expect(diagnostic.durationMs as number).toBeGreaterThanOrEqual(0);
  });

  it('classifies proxy rejection and upstream fetch failure without logging request secrets', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const request = new Request(
      'https://app.example/api/sp-proxy?url=' +
        encodeURIComponent('https://malicious.example/sites/other/_api/web/lists?secret=do-not-log'),
      { headers: { Authorization: 'Bearer secret-token', Cookie: 'session=secret-cookie' } },
    );

    const rejected = await worker.fetch(request, { ...defaultEnv, SP_PROXY_DIAGNOSTICS: '1' });
    expect(rejected.status).toBe(403);
    const rejection = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(rejection).toMatchObject({
      outcome: 'proxy_rejection',
      safeErrorCode: 'target_not_allowed',
      status: 403,
      retryClass: 'none',
      targetOrigin: 'https://malicious.example',
      targetPath: '/sites/other/_api/web/lists',
      queryKeys: ['secret'],
    });
    expect(rejection.durationMs).toEqual(expect.any(Number));
    expect(rejection.durationMs as number).toBeGreaterThanOrEqual(0);

    const fetchMock = vi.fn().mockRejectedValue(new Error('upstream URL and token must not be logged'));
    vi.stubGlobal('fetch', fetchMock);
    const fetchFailed = await worker.fetch(
      new Request(
        'https://app.example/api/sp-proxy?url=' +
          encodeURIComponent('https://example.sharepoint.com/sites/welfare/_api/web/lists?secret=do-not-log'),
        { headers: { Authorization: 'Bearer secret-token' } },
      ),
      { ...defaultEnv, SP_PROXY_DIAGNOSTICS: '1' },
    );
    expect(fetchFailed.status).toBe(502);
    const fetchFailure = JSON.parse(logSpy.mock.calls[1]?.[0] as string) as Record<string, unknown>;
    expect(fetchFailure).toMatchObject({
      outcome: 'upstream_fetch_error',
      safeErrorCode: 'sharepoint_fetch_failed',
      retryClass: 'server',
      queryKeys: ['secret'],
    });
    expect(fetchFailure.durationMs).toEqual(expect.any(Number));
    expect(fetchFailure.durationMs as number).toBeGreaterThanOrEqual(0);

    const serialized = JSON.stringify(logSpy.mock.calls);
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('secret-cookie');
    expect(serialized).not.toContain('do-not-log');
    expect(serialized).not.toContain('upstream URL and token');
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
