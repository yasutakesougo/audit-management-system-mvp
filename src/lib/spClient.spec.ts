import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ensureConfig', () => {
  const originalPlaywrightFlag = process.env.PLAYWRIGHT_TEST;

  beforeAll(() => {
    delete process.env.PLAYWRIGHT_TEST;
  });

  beforeEach(() => {
	vi.unstubAllEnvs();
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

describe('parseSpListResponse', () => {
  it('filters out invalid items and returns valid ones (Partial Failures)', async () => {
    const { parseSpListResponse } = await import('./spClient');
    const { z } = await import('zod');

    const schema = z.object({
      Id: z.number(),
      Title: z.string(),
    });

    const mockResponse = {
      value: [
        { Id: 1, Title: 'Valid Item 1' },
        { Id: '2', Title: 'Invalid ID Type' }, // Should fail (string instead of number)
        { Id: 3, Title: 'Valid Item 3' },
        { Id: 4 }, // Should fail (missing Title)
      ],
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = parseSpListResponse(mockResponse, schema);

    // Should return exactly the 2 valid items
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Id: 1, Title: 'Valid Item 1' });
    expect(result[1]).toEqual({ Id: 3, Title: 'Valid Item 3' });

    // Should log the failures
    expect(errorSpy).toHaveBeenCalled();
    const logCall = errorSpy.mock.calls[0];
    expect(logCall[0]).toContain('Partial validation failure: 2/4 items failed schema.');
  });

  it('returns empty array when the value array is missing due to default([])', async () => {
    const { parseSpListResponse } = await import('./spClient');
    const { z } = await import('zod');

    const schema = z.object({ Id: z.number() });

    // Missing 'value' array
    const responseWithMissingValue = { results: [] };

    const result = parseSpListResponse(responseWithMissingValue, schema);
    expect(result).toEqual([]);
  });
});
