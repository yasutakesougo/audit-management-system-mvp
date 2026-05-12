import { beforeEach, describe, expect, it, vi } from 'vitest';

const envState = {
  isDev: false,
  isTestMode: false,
  isForceDemoEnabled: false,
  isDemoModeEnabled: false,
  shouldSkipLogin: false,
  forceSharePoint: false,
  dataProvider: undefined as string | undefined,
};

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({ isDev: envState.isDev }),
  isDemoModeEnabled: () => envState.isDemoModeEnabled,
  isForceDemoEnabled: () => envState.isForceDemoEnabled,
  isTestMode: () => envState.isTestMode,
  shouldSkipLogin: () => envState.shouldSkipLogin,
  readBool: (key: string, fallback = false) => (key === 'VITE_FORCE_SHAREPOINT' ? envState.forceSharePoint : fallback),
  readOptionalEnv: (key: string) => (key === 'VITE_DATA_PROVIDER' ? envState.dataProvider : undefined),
}));

import { getCurrentExecutionRepositoryKind } from '../executionRepositoryFactory';

describe('executionRepositoryFactory', () => {
  beforeEach(() => {
    envState.isDev = false;
    envState.isTestMode = false;
    envState.isForceDemoEnabled = false;
    envState.isDemoModeEnabled = false;
    envState.shouldSkipLogin = false;
    envState.forceSharePoint = false;
    envState.dataProvider = undefined;
    window.history.pushState({}, '', '/');
  });

  it('forces sharepoint in kiosk runtime even when skipLogin is true', () => {
    envState.shouldSkipLogin = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });

  it('forces sharepoint in kiosk runtime even during dev', () => {
    envState.isDev = true;
    envState.dataProvider = 'local';
    window.history.pushState({}, '', '/kiosk/users/10/procedures/0');

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });

  it('respects local provider hint outside kiosk runtime', () => {
    envState.dataProvider = 'local';
    window.history.pushState({}, '', '/daily/activity');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('forces sharepoint when VITE_FORCE_SHAREPOINT is true', () => {
    envState.forceSharePoint = true;
    envState.dataProvider = 'local';

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });
});
