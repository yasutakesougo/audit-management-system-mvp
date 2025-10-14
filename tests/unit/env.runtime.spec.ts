import { afterEach, describe, expect, it, vi } from 'vitest';

type RuntimeWindow = Window & { __ENV__?: Record<string, string | undefined> };

const originalWindow = (globalThis as { window?: Window }).window;

const restoreWindow = () => {
  const globalTarget = globalThis as { window?: Window };
  if (originalWindow) {
    globalTarget.window = originalWindow;
  } else {
    delete globalTarget.window;
  }
  const win = globalTarget.window as RuntimeWindow | undefined;
  if (win) {
    delete win.__ENV__;
  }
};

afterEach(() => {
  restoreWindow();
  vi.resetModules();
  vi.restoreAllMocks();
});

const importEnv = async () => await import('@/env');

describe('runtime env helpers', () => {
  it('excludes window overrides when window is unavailable', async () => {
    const globalTarget = globalThis as { window?: Window };
    const winWithEnv = globalTarget.window as RuntimeWindow;
    winWithEnv.__ENV__ = { injected: 'value' };

    vi.resetModules();
    const withWindow = await importEnv();
    expect(withWindow.getRuntimeEnv().injected).toBe('value');

    const savedWindow = globalTarget.window;
    delete globalTarget.window;
    vi.resetModules();
    const withoutWindow = await importEnv();
    expect(withoutWindow.getRuntimeEnv().injected).toBeUndefined();
    if (savedWindow) {
      globalTarget.window = savedWindow;
    }
  });

  it('clones window env to avoid accidental mutation', async () => {
    const win = (globalThis as { window?: Window }).window as RuntimeWindow;
    win.__ENV__ = { SAMPLE: 'value' };

    const envModule = await importEnv();
    const runtimeEnv = envModule.getRuntimeEnv();

    expect(runtimeEnv.SAMPLE).toBe('value');
    runtimeEnv.SAMPLE = 'changed';
    expect(win.__ENV__?.SAMPLE).toBe('value');
  });

  it('reads values with fallback helpers', async () => {
    const win = (globalThis as { window?: Window }).window as RuntimeWindow;
    win.__ENV__ = {
      MODE: 'production',
      COUNT: '42',
      FLAG_TRUE: 'true',
      FLAG_FALSE: '0',
    };

    const envModule = await importEnv();

    expect(envModule.get('MISSING', 'fallback')).toBe('fallback');
    expect(envModule.getNumber('COUNT', 5)).toBe(42);
    expect(envModule.getNumber('BAD_NUMBER', 7)).toBe(7);
    expect(envModule.getFlag('FLAG_TRUE')).toBe(true);
    expect(envModule.getFlag('FLAG_FALSE', true)).toBe(false);
  });

  it('derives dev mode from MODE or DEV flags', async () => {
    const win = (globalThis as { window?: Window }).window as RuntimeWindow;
    win.__ENV__ = {
      MODE: 'development',
      DEV: 'false',
    };

    let envModule = await importEnv();
    expect(envModule.isDev).toBe(true);

    win.__ENV__ = {
      MODE: 'production',
      DEV: 'true',
    };
    vi.resetModules();
    envModule = await importEnv();
    expect(envModule.isDev).toBe(true);

    win.__ENV__ = {
      MODE: 'production',
      DEV: 'false',
    };
    vi.resetModules();
    envModule = await importEnv();
    expect(envModule.isDev).toBe(false);
  });
});
