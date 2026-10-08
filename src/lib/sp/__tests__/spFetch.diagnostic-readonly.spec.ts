import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpFetch, __clearSharePointThrottleCircuitBreakerForTests } from '../spFetch';
import { updateDiagnosticReadonlyNavigation } from '@/lib/diagnosticReadonly';

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
    updateDiagnosticReadonlyNavigation('/admin/status');
    __clearSharePointThrottleCircuitBreakerForTests();
    acquireToken.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'X-Diagnostic-Readonly-Proxy': '1' } })));
  });
  afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); updateDiagnosticReadonlyNavigation('/'); });

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
    updateDiagnosticReadonlyNavigation('/billing');
    await createSpFetch(deps)('/lists', { method: 'POST' });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://example.sharepoint.com/sites/test/_api/web/lists');
  });
  it('rejects a pending business write if navigation enters diagnostics before token acquisition completes', async () => {
    window.history.replaceState({}, '', '/billing');
    updateDiagnosticReadonlyNavigation('/billing');
    let releaseToken!: (value: string) => void;
    const client = createSpFetch({ ...deps, acquireToken: () => new Promise<string>((resolve) => { releaseToken = resolve; }) });
    const pending = client('/lists', { method: 'POST' });
    window.history.replaceState({}, '', '/admin/status');
    updateDiagnosticReadonlyNavigation('/billing', '/admin/status');
    releaseToken('synthetic-token');
    await expect(pending).rejects.toThrow('DIAGNOSTIC_READ_ONLY');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps an in-flight diagnostic read on the read-only proxy after navigation away', async () => {
    let releaseToken!: (value: string) => void;
    const client = createSpFetch({ ...deps, acquireToken: () => new Promise<string>((resolve) => { releaseToken = resolve; }) });
    const pending = client('/lists');
    window.history.replaceState({}, '', '/billing');
    updateDiagnosticReadonlyNavigation('/billing');
    releaseToken('synthetic-token');
    await pending;
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toMatch(/^\/api\/sp-proxy-readonly\?/);
  });
  it.each([200, 404])('fails closed on an unsupported host response (%s) without common proxy fallback', async (status) => {
    const network = vi.fn().mockResolvedValue(new Response('<html>SPA fallback</html>', { status, headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', network);
    await expect(createSpFetch({ ...deps, retrySettings: { ...deps.retrySettings, maxAttempts: 3 } })('/lists')).rejects.toThrow('DIAGNOSTIC_READONLY_TRANSPORT_UNSUPPORTED');
    expect(network).toHaveBeenCalledTimes(1);
    expect(String(network.mock.calls[0][0])).toMatch(/^\/api\/sp-proxy-readonly\?/);
  });
  it('rejects a write resuming from the write semaphore during pending diagnostic navigation', async () => {
    updateDiagnosticReadonlyNavigation('/billing');
    window.history.replaceState({}, '', '/billing');
    const releases: Array<(response: Response) => void> = [];
    const network = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { releases.push(resolve); }));
    vi.stubGlobal('fetch', network);
    const client = createSpFetch(deps);
    const results = Promise.allSettled([client('/items', { method: 'POST' }), client('/items', { method: 'POST' }), client('/items', { method: 'POST' })]);
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(2));
    updateDiagnosticReadonlyNavigation('/billing', '/admin/status');
    releases.forEach((release) => release(new Response('{}')));
    const settled = await results;
    expect(settled[2]).toMatchObject({ status: 'rejected', reason: { message: 'DIAGNOSTIC_READ_ONLY' } });
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('rejects a write resuming from retry delay during pending diagnostic navigation', async () => {
    updateDiagnosticReadonlyNavigation('/billing');
    window.history.replaceState({}, '', '/billing');
    vi.useFakeTimers();
    try {
      const network = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
      vi.stubGlobal('fetch', network);
      const client = createSpFetch({ ...deps, retrySettings: { maxAttempts: 2, baseDelay: 100, capDelay: 100 }, onRetry: () => updateDiagnosticReadonlyNavigation('/billing', '/admin/status') });
      const result = Promise.allSettled([client('/items', { method: 'POST' })]);
      await vi.runAllTimersAsync();
      expect((await result)[0]).toMatchObject({ status: 'rejected', reason: { message: 'DIAGNOSTIC_READ_ONLY' } });
      expect(network).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});
