import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('VITE_SP_ENABLED strictly resolves SP_ENABLED to true only when "true"', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const loadEnv = async (val: string | undefined): Promise<boolean> => {
    vi.unstubAllEnvs();
    if (val !== undefined) {
      vi.stubEnv('VITE_SP_ENABLED', val);
    } else {
      // Simulate "unset" by explicitly clearing the env var
      // (.env.local may set VITE_SP_ENABLED=true which would leak into tests)
      vi.stubEnv('VITE_SP_ENABLED', '');
    }
    // Reset modules AFTER env stub so the import gets the correct env value
    vi.resetModules();
    const { SP_ENABLED } = await import('@/lib/env');
    return SP_ENABLED;
  };

  it("VITE_SP_ENABLED='true' -> SP_ENABLED === true", async () => {
    const isSPEnabled = await loadEnv('true');
    expect(isSPEnabled).toBe(true);
  });

  it('未設定 -> false', async () => {
    const isSPEnabled = await loadEnv(undefined);
    expect(isSPEnabled).toBe(false);
  });

  it("'false' -> false", async () => {
    const isSPEnabled = await loadEnv('false');
    expect(isSPEnabled).toBe(false);
  });

  it("'TRUE' -> false", async () => {
    const isSPEnabled = await loadEnv('TRUE');
    expect(isSPEnabled).toBe(false);
  });

  it("'1' -> false", async () => {
    const isSPEnabled = await loadEnv('1');
    expect(isSPEnabled).toBe(false);
  });
});
