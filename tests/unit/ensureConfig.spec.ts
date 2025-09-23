import { describe, it, expect } from 'vitest';
import { ensureConfig } from '../../src/lib/spClient';

describe('ensureConfig', () => {
  it('throws on placeholder values', () => {
    expect(() => ensureConfig({ VITE_SP_RESOURCE: 'https://contoso.sharepoint.com', VITE_SP_SITE_RELATIVE: '__FILL_ME__' })).toThrow(/接続設定が未完了/);
    expect(() => ensureConfig({ VITE_SP_RESOURCE: '<yourtenant>', VITE_SP_SITE_RELATIVE: '/sites/Audit' })).toThrow(/接続設定が未完了/);
  });

  it('throws on invalid resource domain', () => {
    expect(() => ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/Audit' })).toThrow(/形式が不正/);
  });

  it('normalizes trailing/leading slashes and builds baseUrl', () => {
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://foo.sharepoint.com/', VITE_SP_SITE_RELATIVE: 'sites/TeamX/' });
    expect(cfg.resource).toBe('https://foo.sharepoint.com');
    expect(cfg.siteRel).toBe('/sites/TeamX');
    expect(cfg.baseUrl).toBe('https://foo.sharepoint.com/sites/TeamX/_api/web');
  });
});
