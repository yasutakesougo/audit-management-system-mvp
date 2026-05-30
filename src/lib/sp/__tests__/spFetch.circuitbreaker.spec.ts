import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createSpFetch,
  SpThrottleRedirectError,
  isThrottleCircuitOpen,
  __clearSharePointThrottleCircuitBreakerForTests,
  __getSharePointThrottleCircuitBreakerStateForTests,
} from '../spFetch';
import type { EnvRecord } from '@/lib/env';

describe('spFetch Throttle Circuit Breaker', () => {
  const mockAcquireToken = vi.fn().mockResolvedValue('mock-token');
  const mockConfig: EnvRecord = {
    VITE_SP_SITE_URL: 'https://tenant.sharepoint.com/sites/test',
    VITE_SP_SITE_RELATIVE: '/sites/test',
    VITE_SP_RESOURCE: 'https://tenant.sharepoint.com',
    VITE_E2E_MSAL_MOCK: '0',
    VITE_SKIP_SHAREPOINT: '0',
  };

  const defaultDeps = {
    acquireToken: mockAcquireToken,
    baseUrl: 'https://tenant.sharepoint.com/sites/test/_api/web',
    config: mockConfig,
    retrySettings: { maxAttempts: 1, baseDelay: 100, capDelay: 1000 },
    debugEnabled: false,
    spSiteLegacy: '/sites/test',
    throwOnError: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    __clearSharePointThrottleCircuitBreakerForTests();
    mockAcquireToken.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    __clearSharePointThrottleCircuitBreakerForTests();
  });

  it('should not be open initially', () => {
    expect(isThrottleCircuitOpen()).toBe(false);
    const state = __getSharePointThrottleCircuitBreakerStateForTests();
    expect(state.isOpen).toBe(false);
    expect(state.openUntil).toBe(0);
  });

  it('should open circuit breaker for SpThrottleRedirectError and block subsequent requests', async () => {
    const spFetch = createSpFetch(defaultDeps);

    // Mock fetch to simulate a Throttle.htm redirect landing page
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      url: 'https://tenant.sharepoint.com/sites/test/_layouts/15/Throttle.htm#17',
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', mockFetch);

    // First request should hit mockFetch and trigger circuit breaker
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(isThrottleCircuitOpen()).toBe(true);

    // Second request should be blocked immediately without calling fetch
    mockFetch.mockClear();
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should open circuit breaker for CORS/Redirect errors (Likely CORS failure due to 302 Throttle.htm redirect)', async () => {
    const spFetch = createSpFetch(defaultDeps);

    // Mock fetch to simulate a CORS/network error triggered by redirect
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (CORS block)'));
    vi.stubGlobal('fetch', mockFetch);

    // First request fails with CORS and triggers circuit breaker
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(isThrottleCircuitOpen()).toBe(true);

    // Second request blocked immediately
    mockFetch.mockClear();
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should automatically close the circuit breaker after 30 seconds', async () => {
    const spFetch = createSpFetch(defaultDeps);

    // Trigger circuit breaker
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        url: 'https://tenant.sharepoint.com/sites/test/_layouts/15/Throttle.htm',
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: 'https://tenant.sharepoint.com/sites/test/_api/web/lists',
        headers: new Headers(),
        json: async () => ({ value: [] }),
      });
    vi.stubGlobal('fetch', mockFetch);

    // Trigger
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);
    expect(isThrottleCircuitOpen()).toBe(true);

    // Check blocked
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);

    // Advance time by 29 seconds - breaker should still be open
    vi.advanceTimersByTime(29000);
    expect(isThrottleCircuitOpen()).toBe(true);

    // Advance time by 1 more second (total 30 seconds) - breaker should close
    vi.advanceTimersByTime(1000);
    expect(isThrottleCircuitOpen()).toBe(false);

    // Request should now pass and call fetch
    mockFetch.mockClear();
    const res = await spFetch('/lists');
    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not open circuit breaker for typical 500 errors', async () => {
    const spFetch = createSpFetch(defaultDeps);

    // Mock fetch to simulate a internal server error
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      url: 'https://tenant.sharepoint.com/sites/test/_api/web/lists',
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', mockFetch);

    // First request should fail with normal HTTP error, NOT opening the breaker
    await expect(spFetch('/lists')).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(isThrottleCircuitOpen()).toBe(false);

    // Second request should still hit fetch
    mockFetch.mockClear();
    await expect(spFetch('/lists')).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should be able to manually clear/reset circuit breaker using the test helper', async () => {
    const spFetch = createSpFetch(defaultDeps);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        url: 'https://tenant.sharepoint.com/sites/test/_layouts/15/Throttle.htm',
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: 'https://tenant.sharepoint.com/sites/test/_api/web/lists',
        headers: new Headers(),
        json: async () => ({ value: [] }),
      });
    vi.stubGlobal('fetch', mockFetch);

    // Trigger breaker
    await expect(spFetch('/lists')).rejects.toThrow(SpThrottleRedirectError);
    expect(isThrottleCircuitOpen()).toBe(true);

    // Clear breaker manually using helper
    __clearSharePointThrottleCircuitBreakerForTests();
    expect(isThrottleCircuitOpen()).toBe(false);

    // Subsequent request should pass through
    const res = await spFetch('/lists');
    expect(res.ok).toBe(true);
  });
});
