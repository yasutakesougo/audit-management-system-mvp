import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpFetch, __clearSharePointThrottleCircuitBreakerForTests } from '../spFetch';

describe('diagnostic SharePoint transport', () => {
  const acquireToken = vi.fn().mockResolvedValue('synthetic-token');
  const deps = {
    acquireToken,
    baseUrl: 'https://example.sharepoint.com/sites/test/_api/web',
    config: { VITE_DEMO_MODE: '0', VITE_SKIP_LOGIN: '0', VITE_SKIP_SHAREPOINT: '0', VITE_E2E: '0', VITE_E2E_MSAL_MOCK: '0', VITE_SP_USE_PROXY: '0' },
    retrySettings: { maxAttempts: 1, baseDelay: 1, capDelay: 1 },
    debugEnabled: false,
    spSiteLegacy: '/sites/test',
  };
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/status');
    __clearSharePointThrottleCircuitBreakerForTests();
    acquireToken.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
  });
  afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'MERGE'])('rejects %s before token acquisition or network', async (method) => {
    await expect(createSpFetch(deps)('/lists', { method })).rejects.toThrow('DIAGNOSTIC_READ_ONLY');
    expect(acquireToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['MERGE', 'GET', ''])('rejects any X-HTTP-Method header (%s)', async (override) => {
    await expect(createSpFetch(deps)('/lists', { headers: { 'x-http-method': override } })).rejects.toThrow('DIAGNOSTIC_READ_ONLY');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['GET', 'HEAD', 'OPTIONS'])('forces %s through the server boundary even when proxy configuration is disabled', async (method) => {
    await createSpFetch(deps)('/lists', { method });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/sp-proxy-readonly?url=https%3A%2F%2Fexample.sharepoint.com%2Fsites%2Ftest%2F_api%2Fweb%2Flists');
  });
  it('preserves the normal transport outside diagnostics', async () => {
    window.history.replaceState({}, '', '/billing');
    await createSpFetch(deps)('/lists', { method: 'POST' });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://example.sharepoint.com/sites/test/_api/web/lists');
  });
  it('rejects a pending business write if navigation enters diagnostics before token acquisition completes', async () => {
    window.history.replaceState({}, '', '/billing');
    let releaseToken!: (value: string) => void;
    const client = createSpFetch({ ...deps, acquireToken: () => new Promise<string>((resolve) => { releaseToken = resolve; }) });
    const pending = client('/lists', { method: 'POST' });
    window.history.replaceState({}, '', '/admin/status');
    releaseToken('synthetic-token');
    await expect(pending).rejects.toThrow('DIAGNOSTIC_READ_ONLY');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps an in-flight diagnostic read on the read-only proxy after navigation away', async () => {
    let releaseToken!: (value: string) => void;
    const client = createSpFetch({ ...deps, acquireToken: () => new Promise<string>((resolve) => { releaseToken = resolve; }) });
    const pending = client('/lists');
    window.history.replaceState({}, '', '/billing');
    releaseToken('synthetic-token');
    await pending;
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toMatch(/^\/api\/sp-proxy-readonly\?/);
  });
});
