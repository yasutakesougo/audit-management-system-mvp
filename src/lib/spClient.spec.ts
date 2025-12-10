import { describe, it, expect } from 'vitest';
import { ensureConfig } from './spClient';

describe('ensureConfig', () => {
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

  it('throws on placeholder env', () => {
    expect(() => ensureConfig({ VITE_SP_RESOURCE: 'https://<yourtenant>.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/<SiteName>' })).toThrow(/未完了/);
  });

  it('throws on invalid resource host', () => {
    expect(() => ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/x' })).toThrow(/形式が不正/);
  });
});
