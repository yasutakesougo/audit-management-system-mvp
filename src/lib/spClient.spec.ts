import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureConfig } from './spClient';

describe('ensureConfig', () => {
  const originalPlaywrightFlag = process.env.PLAYWRIGHT_TEST;

  beforeAll(() => {
    delete process.env.PLAYWRIGHT_TEST;
  });

  afterAll(() => {
    if (originalPlaywrightFlag === undefined) {
      delete process.env.PLAYWRIGHT_TEST;
    } else {
      process.env.PLAYWRIGHT_TEST = originalPlaywrightFlag;
    }
  });

  it('builds baseUrl correctly with valid env', () => {
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://contoso.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/Audit' });
    expect(cfg.resource).toBe('https://contoso.sharepoint.com');
    expect(cfg.siteRel).toBe('/sites/Audit');
    expect(cfg.baseUrl).toBe('https://contoso.sharepoint.com/sites/Audit/_api/web');
  });

  it('normalizes slashes', () => {
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://contoso.sharepoint.com/', VITE_SP_SITE_RELATIVE: 'sites/Audit/' });
    expect(cfg.resource).toBe('https://contoso.sharepoint.com');
    expect(cfg.siteRel).toBe('/sites/Audit');
  });

  it('throws when placeholders remain', () => {
    expect(() =>
      ensureConfig({ VITE_SP_RESOURCE: 'https://<yourtenant>.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/<SiteName>' })
    ).toThrow(/SharePoint 接続設定が未完了です。/);
  });

  it('throws when clearly invalid hosts are provided', () => {
    expect(() =>
      ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/x' })
    ).toThrow(/VITE_SP_RESOURCE の形式が不正です/);
  });
});
