import { afterEach, describe, expect, it, vi } from 'vitest';

type TestWindow = { __ENV__?: Record<string, string> };

const setWindowEnv = (env: Record<string, string>): void => {
  Object.defineProperty(globalThis as typeof globalThis & { window?: TestWindow }, 'window', {
    configurable: true,
    writable: true,
    value: { __ENV__: { ...env } },
  });
};

const clearWindowEnv = (): void => {
  Reflect.deleteProperty(globalThis as typeof globalThis & { window?: TestWindow }, 'window');
};

const loadEnvModule = async () => {
  vi.resetModules();
  return import('../../src/env');
};

describe('getRuntimeEnv protected flag overrides', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearWindowEnv();
    vi.resetModules();
  });

  it('falls back to inline values when runtime env lacks E2E hints', async () => {
    vi.stubEnv('VITE_SKIP_LOGIN', '0');
    setWindowEnv({ VITE_SKIP_LOGIN: '1' });

    const envModule = await loadEnvModule();
    expect(envModule.getRuntimeEnv().VITE_SKIP_LOGIN).toBe('0');
  });

  it('allows overrides when runtime env signals an E2E context', async () => {
    vi.stubEnv('VITE_SKIP_LOGIN', '0');
    setWindowEnv({ VITE_SKIP_LOGIN: '1', VITE_E2E: '1' });

    const envModule = await loadEnvModule();
    expect(envModule.getRuntimeEnv().VITE_SKIP_LOGIN).toBe('1');
  });

  it('allows explicit opt-in via __ALLOW_RUNTIME_FLAG_OVERRIDES__', async () => {
    vi.stubEnv('VITE_SKIP_LOGIN', '0');
    setWindowEnv({ VITE_SKIP_LOGIN: '1', '__ALLOW_RUNTIME_FLAG_OVERRIDES__': '1' });

    const envModule = await loadEnvModule();
    expect(envModule.getRuntimeEnv().VITE_SKIP_LOGIN).toBe('1');
  });
});
