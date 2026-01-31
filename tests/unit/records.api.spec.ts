import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../src/lib/env';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

const boomPayload = { error: { message: 'Internal Boom' } };

const mockFetch = vi.fn(async () => ({
  ok: false,
  status: 500,
  headers: {
    get: (k: string) =>
      k.toLowerCase() === 'content-type' ? 'application/json' : null,
  },
  text: async () => JSON.stringify(boomPayload),
  json: async () => boomPayload,
}));

const DEFAULT_APP_CONFIG: AppConfig = {
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/wf',
  VITE_SP_SITE_URL: 'https://contoso.sharepoint.com/sites/wf',
  VITE_SP_RETRY_MAX: '1',
  VITE_SP_RETRY_BASE_MS: '50',
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
  graphRetryBaseMs: 300,
  graphRetryCapMs: 2000,
  schedulesTz: 'Asia/Tokyo',
  schedulesWeekStart: 1,
  isDev: false,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.mock('cross-fetch', () => ({ default: mockFetch, fetch: mockFetch }));
  vi.mock('cross-fetch/polyfill', () => ({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('records add failure (500)', () => {
  it('propagates server error message on 500', async () => {
    const envModule = await import('../../src/lib/env');
    vi.spyOn(envModule, 'getAppConfig').mockReturnValue(DEFAULT_APP_CONFIG);
    const { createSpClient } = await import('../../src/lib/spClient');
    const acquireToken = vi.fn().mockResolvedValue('fake-token');

    const client = createSpClient(
      acquireToken,
      'https://contoso.sharepoint.com/sites/wf/_api/web',
    );

    await expect(
      client.addListItemByTitle('SupportRecord_Daily', { Title: 'X' }),
    ).rejects.toThrow(/Internal Boom/);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
