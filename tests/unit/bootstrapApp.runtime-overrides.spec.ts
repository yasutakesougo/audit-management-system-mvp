import { describe, expect, it } from 'vitest';
import { buildBootstrapRuntimeOverrides } from '../e2e/utils/bootstrapApp';

describe('buildBootstrapRuntimeOverrides', () => {
  it('inherit leaves all SharePoint runtime keys untouched', () => {
    expect(buildBootstrapRuntimeOverrides()).toEqual({});
    expect(buildBootstrapRuntimeOverrides('inherit')).toEqual({});
  });

  it('skip selects the memory provider without injecting SharePoint URLs', () => {
    expect(buildBootstrapRuntimeOverrides('skip')).toEqual({
      VITE_SKIP_SHAREPOINT: '1',
      VITE_FORCE_SHAREPOINT: '0',
      VITE_DATA_PROVIDER: 'memory',
    });
  });

  it('force selects SharePoint and supplies the E2E endpoint', () => {
    expect(buildBootstrapRuntimeOverrides('force')).toEqual({
      VITE_SKIP_SHAREPOINT: '0',
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_SP_RESOURCE: 'https://e2e.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/e2e-test',
      VITE_SP_SITE_URL: 'https://e2e.sharepoint.com/sites/e2e-test',
    });
  });
});
