import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

const setupStore = async (options: { demo: boolean; skipLogin: boolean; isDev?: boolean }) => {
  const envModule = (await import('@/lib/env')) as typeof import('@/lib/env');
  envModule.__resetAppConfigForTests();

  const originalGetAppConfig = envModule.getAppConfig.bind(envModule);
  vi.spyOn(envModule, 'getAppConfig').mockImplementation((envOverride) => {
    const base = originalGetAppConfig(envOverride);
    if (typeof options.isDev === 'boolean') {
      return { ...base, isDev: options.isDev };
    }
    return base;
  });

  const originalIsDemoModeEnabled = envModule.isDemoModeEnabled.bind(envModule);
  vi.spyOn(envModule, 'isDemoModeEnabled').mockImplementation((envOverride) => {
    if (typeof options.demo === 'boolean') {
      return options.demo;
    }
    return originalIsDemoModeEnabled(envOverride);
  });

  const originalShouldSkipLogin = envModule.shouldSkipLogin.bind(envModule);
  vi.spyOn(envModule, 'shouldSkipLogin').mockImplementation((envOverride) => {
    if (typeof options.skipLogin === 'boolean') {
      return options.skipLogin;
    }
    return originalShouldSkipLogin(envOverride);
  });

  const liveHook = vi.fn(() => 'live-result');
  const demoHook = vi.fn(() => 'demo-result');

  vi.doMock('@/features/users/useUsers', () => ({
    useUsers: liveHook,
  }));

  vi.doMock('@/features/users/usersStoreDemo', () => ({
    useUsersDemo: demoHook,
  }));

  const module = await import('@/features/users/store');
  return { useUsersStore: module.useUsersStore, liveHook, demoHook };
};

describe('useUsersStore', () => {
  it('delegates to live hook when demo mode and skip-login are disabled', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: false, skipLogin: false });

    const result = useUsersStore('active-only');

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledWith('active-only');
    expect(demoHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when skip-login is enabled', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: false, skipLogin: true });

    const result = useUsersStore('demo-only');

    expect(result).toBe('demo-result');
    expect(demoHook).toHaveBeenCalledWith('demo-only');
    expect(liveHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when demo mode flag is set', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: true, skipLogin: false });

    const result = useUsersStore();

    expect(result).toBe('demo-result');
    expect(demoHook).toHaveBeenCalledTimes(1);
    expect(liveHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when running in dev mode', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: false, skipLogin: false, isDev: true });

    const result = useUsersStore('dev-mode');

    expect(result).toBe('demo-result');
    expect(demoHook).toHaveBeenCalledWith('dev-mode');
    expect(liveHook).not.toHaveBeenCalled();
  });
});
