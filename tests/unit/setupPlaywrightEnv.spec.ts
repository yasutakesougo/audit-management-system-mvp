import { describe, expect, it } from 'vitest';
import { getPlaywrightBaseEnv } from '../e2e/_helpers/setupPlaywrightEnv';

describe('getPlaywrightBaseEnv', () => {
  it('selects SharePoint settings for the sp-stub lane', () => {
    const env = getPlaywrightBaseEnv(true);

    expect(env.VITE_SKIP_SHAREPOINT).toBe('0');
    expect(env.VITE_FORCE_SHAREPOINT).toBe('1');
    expect(env.VITE_DATA_PROVIDER).toBe('sharepoint');
    expect(env.VITE_DEMO_MODE).toBe('0');
  });

  it('keeps memory settings for non-SharePoint lanes', () => {
    const env = getPlaywrightBaseEnv(false);

    expect(env.VITE_SKIP_SHAREPOINT).toBe('1');
    expect(env.VITE_FORCE_SHAREPOINT).toBe('0');
    expect(env.VITE_DATA_PROVIDER).toBe('memory');
    expect(env.VITE_DEMO_MODE).toBe('1');
  });
});
