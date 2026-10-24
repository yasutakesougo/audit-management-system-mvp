import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearEnvCache } from '@/lib/env';
import {
  getCurrentUserRepositoryKind,
  resetUserRepository,
  shouldUseUserDemoRepository,
} from '@/features/users/repositoryFactory';

type EnvCarrier = Window & { __ENV__?: Record<string, string | undefined> };

const setRuntimeEnv = (env: Record<string, string | undefined> | undefined): void => {
  if (env === undefined) {
    delete (window as EnvCarrier).__ENV__;
    return;
  }
  (window as EnvCarrier).__ENV__ = { ...env };
};

const useBuildEnv = (env: Record<string, string>): void => {
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
};

describe('shouldUseUserDemoRepository precedence', () => {
  afterEach(() => {
    setRuntimeEnv(undefined);
    resetUserRepository();
    clearEnvCache();
    vi.unstubAllEnvs();
  });

  it('build VITE_FORCE_DEMO=1 and runtime 0 selects SharePoint, not demo', () => {
    useBuildEnv({ VITE_FORCE_DEMO: '1', VITE_FORCE_SHAREPOINT: '0' });
    setRuntimeEnv({ VITE_FORCE_DEMO: '0' });
    clearEnvCache();
    resetUserRepository();

    expect(shouldUseUserDemoRepository()).toBe(false);
    expect(getCurrentUserRepositoryKind()).toBe('real');
  });

  it('build VITE_FORCE_DEMO=1 and runtime unset stays on the build-time demo flag', () => {
    useBuildEnv({ VITE_FORCE_DEMO: '1', VITE_FORCE_SHAREPOINT: '0' });
    setRuntimeEnv({ VITE_E2E: '1' });
    clearEnvCache();
    resetUserRepository();

    expect(shouldUseUserDemoRepository()).toBe(true);
    expect(getCurrentUserRepositoryKind()).toBe('demo');
  });

  it('runtime VITE_FORCE_DEMO=1 selects demo even when the build value is 0', () => {
    useBuildEnv({ VITE_FORCE_DEMO: '0', VITE_FORCE_SHAREPOINT: '0' });
    setRuntimeEnv({ VITE_FORCE_DEMO: '1' });
    clearEnvCache();
    resetUserRepository();

    expect(shouldUseUserDemoRepository()).toBe(true);
    expect(getCurrentUserRepositoryKind()).toBe('demo');
  });

  it('effective VITE_FORCE_SHAREPOINT=1 selects SharePoint even when demo flags are on', () => {
    useBuildEnv({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_FORCE_DEMO: '1',
      VITE_DEMO_MODE: '1',
      VITE_SKIP_LOGIN: '1',
    });
    setRuntimeEnv({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_FORCE_DEMO: '1',
      VITE_DEMO_MODE: '1',
      VITE_SKIP_LOGIN: '1',
    });
    clearEnvCache();
    resetUserRepository();

    expect(shouldUseUserDemoRepository()).toBe(false);
    expect(getCurrentUserRepositoryKind()).toBe('real');
  });
});
