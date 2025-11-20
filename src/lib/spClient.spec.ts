import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureConfig } from './spClient';

const expectConfigShape = (cfg: { resource: string; siteRel: string; baseUrl: string }) => {
  expect(typeof cfg.resource).toBe('string');
  expect(cfg.resource.length).toBeGreaterThan(0);
  expect(typeof cfg.siteRel).toBe('string');
  expect(cfg.siteRel.startsWith('/')).toBe(true);
  expect(cfg.baseUrl).toBe(`${cfg.resource}${cfg.siteRel}/_api/web`);
};

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

  it('returns a fallback config when placeholders remain', () => {
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://<yourtenant>.sharepoint.com', VITE_SP_SITE_RELATIVE: '/sites/<SiteName>' });

    expectConfigShape(cfg);
  });

  it('still returns a usable config when clearly invalid hosts are provided', () => {
    const cfg = ensureConfig({ VITE_SP_RESOURCE: 'https://example.com', VITE_SP_SITE_RELATIVE: '/sites/x' });

    expectConfigShape(cfg);
  });
});
