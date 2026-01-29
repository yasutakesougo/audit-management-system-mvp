import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAppConfigForTests } from '@/lib/env';

describe('ensureConfig', () => {
  const originalPlaywrightFlag = process.env.PLAYWRIGHT_TEST;

  beforeAll(() => {
    delete process.env.PLAYWRIGHT_TEST;
  });

  beforeEach(() => {
	vi.unstubAllEnvs();
    __resetAppConfigForTests();
  });

	afterEach(() => {
		vi.unstubAllEnvs();
	});

  afterAll(() => {
    if (originalPlaywrightFlag === undefined) {
      delete process.env.PLAYWRIGHT_TEST;
    } else {
      process.env.PLAYWRIGHT_TEST = originalPlaywrightFlag;
    }
  });

  it('builds baseUrl correctly with valid env', async () => {
    vi.resetModules();
    vi.unmock('./spClient');
    const { ensureConfig } = await vi.importActual<typeof import('./spClient')>('./spClient');
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://contoso.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/Audit' });
    expect(cfg.resource).toBe('https://contoso.sharepoint.com');
    expect(cfg.siteRel).toBe('/sites/Audit');
    expect(cfg.baseUrl).toBe('https://contoso.sharepoint.com/sites/Audit/_api/web');
  });

  it('normalizes slashes', async () => {
    vi.resetModules();
    vi.unmock('./spClient');
    const { ensureConfig } = await vi.importActual<typeof import('./spClient')>('./spClient');
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://contoso.sharepoint.com/', VITE_SP_SITE_RELATIVE: 'sites/Audit/' });
    expect(cfg.resource).toBe('https://contoso.sharepoint.com');
    expect(cfg.siteRel).toBe('/sites/Audit');
  });

  it('throws when placeholders remain', async () => {
    vi.resetModules();
    vi.unmock('./spClient');
    const { ensureConfig } = await vi.importActual<typeof import('./spClient')>('./spClient');
    vi.stubEnv('VITE_SP_RESOURCE', '');
    vi.stubEnv('VITE_SP_SITE_RELATIVE', '');
    // eslint-disable-next-line no-console
    console.error('ensureConfig typeof', typeof ensureConfig, 'source', ensureConfig.toString());
    expect(() =>
      ensureConfig({ VITE_SP_RESOURCE: 'https://<yourtenant>.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/<SiteName>' })
    ).toThrow(/SharePoint 接続設定が未完了です。/);
  });

  it('throws when clearly invalid hosts are provided', async () => {
    vi.resetModules();
    vi.unmock('./spClient');
    const { ensureConfig } = await vi.importActual<typeof import('./spClient')>('./spClient');
    vi.stubEnv('VITE_SP_RESOURCE', '');
    vi.stubEnv('VITE_SP_SITE_RELATIVE', '');
    expect(() =>
      ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/x' })
    ).toThrow(/VITE_SP_RESOURCE の形式が不正です/);
  });
});
