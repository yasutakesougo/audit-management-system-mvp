import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Helpers to manage process.env directly for real env testing
 * (bypassing vi.mock('@/lib/env') which runs at module load time)
 */
function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function importFreshSpClient() {
  vi.resetModules(); // ← clear module cache
  return await import('@/lib/spClient');
}

describe('spClient ensureConfig (real env validation)', () => {
  beforeEach(() => {
    // Initialize env to clean state（prevent test interdependencies）
    setEnv({
      VITE_SP_RESOURCE: undefined,
      VITE_SP_SITE_RELATIVE: undefined,
      VITE_SP_SITE_URL: undefined,
      VITE_SP_SITE: undefined,
      VITE_E2E: undefined,
      VITE_SKIP_SHAREPOINT: undefined,
      VITE_SKIP_LOGIN: undefined,
      VITE_AUTOMATION: undefined,
      IS_DEMO: undefined,
      PLAYWRIGHT_TEST: undefined,
    });
  });

  it('fails fast when resource or site value is still a placeholder', async () => {
    const sp = await importFreshSpClient();
    expect(() =>
      sp.ensureConfig({ VITE_SP_RESOURCE: 'https://<tenant>.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/<site>' })
    ).toThrow(/SharePoint 接続設定が未完了です。/);
  });

  it('rejects obviously invalid resource domains', async () => {
    const sp = await importFreshSpClient();
    expect(() =>
      sp.ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/foo' })
    ).toThrow(/VITE_SP_RESOURCE の形式が不正です|sharepoint\.com/);
  });

  it('treats undefined resource/site values as incomplete configuration', async () => {
    const sp = await importFreshSpClient();
    expect(() =>
      sp.ensureConfig({ VITE_SP_RESOURCE: undefined, VITE_SP_SITE_RELATIVE: undefined })
    ).toThrow(/SharePoint 接続設定が未完了です。|設定が不完全/);
  });

  it('accepts valid sharepoint.com domains', async () => {
    const sp = await importFreshSpClient();
    const result = sp.ensureConfig({
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/demo',
    });
    expect(result).toHaveProperty('resource');
    expect(result).toHaveProperty('siteRel');
    expect(result).toHaveProperty('baseUrl');
  });
});
