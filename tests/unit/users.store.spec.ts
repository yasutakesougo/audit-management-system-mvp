import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.unmock('@/lib/env');
  vi.unmock('@/features/users/useUsers');
  vi.unmock('@/features/users/usersStoreDemo');
});

const setupStore = async (options: { demo: boolean; skipLogin: boolean; isDev?: boolean }) => {
  vi.resetModules();

  vi.doMock('@/lib/env', () => ({
    getAppConfig: vi.fn(() => ({ isDev: options.isDev ?? false })),
    isDemoModeEnabled: vi.fn(() => options.demo),
    shouldSkipLogin: vi.fn(() => options.skipLogin),
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
