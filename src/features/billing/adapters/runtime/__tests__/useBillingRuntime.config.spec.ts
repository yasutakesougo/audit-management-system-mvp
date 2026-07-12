import { afterEach, describe, expect, it, vi } from 'vitest';

describe('billing runtime composition config', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses the billing-specific SharePoint site override when configured', async () => {
    vi.doMock('@/lib/env', () => ({
      getAppConfig: vi.fn(() => ({
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      })),
      readOptionalEnv: vi.fn((key: string) =>
        key === 'VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE' ? '/sites/2' : undefined
      ),
    }));
    vi.doMock('@/lib/spClient', () => ({
      createSpClient: vi.fn(),
      ensureConfig: vi.fn((override?: { VITE_SP_RESOURCE?: string; VITE_SP_SITE_RELATIVE?: string }) => ({
        baseUrl: override
          ? `${override.VITE_SP_RESOURCE}${override.VITE_SP_SITE_RELATIVE}/_api/web`
          : 'https://contoso.sharepoint.com/sites/welfare/_api/web',
      })),
    }));

    const { resolveBillingSharePointBaseUrl } = await import('../useBillingRuntime');
    const { ensureConfig } = await import('@/lib/spClient');

    expect(resolveBillingSharePointBaseUrl()).toBe('https://contoso.sharepoint.com/sites/2/_api/web');
    expect(ensureConfig).toHaveBeenCalledWith({
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/2',
    });
  });

  it('falls back to the default SharePoint site when billing override is absent', async () => {
    vi.doMock('@/lib/env', () => ({
      getAppConfig: vi.fn(() => ({
        VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      })),
      readOptionalEnv: vi.fn(() => undefined),
    }));
    vi.doMock('@/lib/spClient', () => ({
      createSpClient: vi.fn(),
      ensureConfig: vi.fn(() => ({
        baseUrl: 'https://contoso.sharepoint.com/sites/welfare/_api/web',
      })),
    }));

    const { resolveBillingSharePointBaseUrl } = await import('../useBillingRuntime');
    const { ensureConfig } = await import('@/lib/spClient');

    expect(resolveBillingSharePointBaseUrl()).toBe('https://contoso.sharepoint.com/sites/welfare/_api/web');
    expect(ensureConfig).toHaveBeenCalledWith();
  });
});
