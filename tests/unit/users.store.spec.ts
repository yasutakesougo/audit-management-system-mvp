import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.unmock('@/lib/env');
  vi.unmock('@/features/users/useUsers');
  vi.unmock('@/features/users/usersStoreDemo');
});

const setupStore = async (options: {
  demo: boolean;
  skipLogin: boolean;
  isDev?: boolean;
  isTest?: boolean;
  forceDemo?: boolean;
  featureDemo?: boolean;
}) => {
  vi.resetModules();

  const featureDemo = options.featureDemo ?? options.demo;

  vi.doMock('@/lib/env', () => ({
    getAppConfig: vi.fn(() => ({ isDev: options.isDev ?? false })),
    isDemoModeEnabled: vi.fn(() => options.demo),
    isForceDemoEnabled: vi.fn(() => options.forceDemo ?? false),
    isTestMode: vi.fn(() => options.isTest ?? false),
    shouldSkipLogin: vi.fn(() => options.skipLogin),
    readBool: vi.fn((key: string) => {
      if (key === 'VITE_FEATURE_USERS_DEMO') {
        return featureDemo;
      }
      return false;
    }),
  }));

  const liveHook = vi.fn(() => 'live-result');
  vi.doMock('@/features/users/useUsers', () => ({
    useUsers: liveHook,
  }));

  const demoHook = vi.fn(() => 'demo-result');
  vi.doMock('@/features/users/usersStoreDemo', () => ({
    useUsersDemo: demoHook,
  }));

  const module = await import('@/features/users/store');
  return { useUsersStore: module.useUsersStore, liveHook, demoHook };
};

describe('useUsersStore', () => {
  it('delegates to live hook when demo mode and skip-login are disabled', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: false, skipLogin: false, featureDemo: false });

    const params = { filters: { keyword: 'active-only' } };

    const result = useUsersStore(params);

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledWith(params);
    expect(demoHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when skip-login is enabled', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: false, skipLogin: true, featureDemo: true });

    const params = { filters: { keyword: 'demo-only' } };

    const result = useUsersStore(params);

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledWith(params);
    expect(demoHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when demo mode flag is set', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: true, skipLogin: false, featureDemo: true });

    const result = useUsersStore();

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledTimes(1);
    expect(demoHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when running in dev mode', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({ demo: false, skipLogin: false, isDev: true, featureDemo: true });

    const params = { filters: { keyword: 'dev-mode' } };

    const result = useUsersStore(params);

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledWith(params);
    expect(demoHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when running in test mode', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({
      demo: false,
      skipLogin: false,
      isTest: true,
      featureDemo: true,
    });

    const params = { filters: { keyword: 'test-mode' } };

    const result = useUsersStore(params);

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledWith(params);
    expect(demoHook).not.toHaveBeenCalled();
  });

  it('switches to demo hook when force demo flag is set', async () => {
    const { useUsersStore, liveHook, demoHook } = await setupStore({
      demo: false,
      skipLogin: false,
      forceDemo: true,
      featureDemo: true,
    });

    const params = { filters: { keyword: 'forced-demo' } };

    const result = useUsersStore(params);

    expect(result).toBe('live-result');
    expect(liveHook).toHaveBeenCalledWith(params);
    expect(demoHook).not.toHaveBeenCalled();
  });
});
