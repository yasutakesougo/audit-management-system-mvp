import { beforeEach, describe, expect, it, vi } from 'vitest';

const envState = {
  isDev: false,
  isTestMode: false,
  isForceDemoEnabled: false,
  isDemoModeEnabled: false,
  shouldSkipLogin: false,
  forceSharePoint: false,
  dataProvider: undefined as string | undefined,
  e2e: false,
};

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({ isDev: envState.isDev }),
  isDemoModeEnabled: () => envState.isDemoModeEnabled,
  isForceDemoEnabled: () => envState.isForceDemoEnabled,
  isTestMode: () => envState.isTestMode,
  shouldSkipLogin: () => envState.shouldSkipLogin,
  readBool: (key: string, fallback = false) => {
    if (key === 'VITE_FORCE_SHAREPOINT') return envState.forceSharePoint;
    if (key === 'VITE_E2E') return envState.e2e;
    return fallback;
  },
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
    envState.e2e = false;
    window.history.pushState({}, '', '/');
  });

  it('forces sharepoint in kiosk runtime even when skipLogin is true', () => {
    envState.shouldSkipLogin = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

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

  it('respects local/memory provider hint in kiosk runtime during e2e', () => {
    envState.e2e = true;
    envState.dataProvider = 'memory';
    window.history.pushState({}, '', '/kiosk/users/10/procedures/0');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('uses local provider in kiosk runtime during local development', () => {
    envState.isDev = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('uses local provider in kiosk runtime during demo mode', () => {
    envState.isDemoModeEnabled = true;
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('local');
  });

  it('respects sharepoint provider hint in kiosk runtime during local development', () => {
    envState.isDev = true;
    envState.dataProvider = 'sharepoint';
    window.history.pushState({}, '', '/kiosk/users/6/procedures');

    expect(getCurrentExecutionRepositoryKind()).toBe('sharepoint');
  });
});
