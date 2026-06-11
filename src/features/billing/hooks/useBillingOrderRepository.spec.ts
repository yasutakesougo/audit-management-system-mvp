import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { BillingOrderRepository } from '../repository';

const envState = {
  isTestMode: true,
  shouldSkipSharePoint: false,
  isDemoModeEnabled: false,
};

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ acquireToken: vi.fn().mockResolvedValue('test-token') }),
}));

vi.mock('@/lib/env', () => ({
  isDemoModeEnabled: () => envState.isDemoModeEnabled,
  isForceDemoEnabled: () => false,
  isTestMode: () => envState.isTestMode,
  readBool: () => false,
  readEnv: () => '',
  isDevMode: () => false,
  shouldSkipLogin: () => false,
  shouldSkipSharePoint: () => envState.shouldSkipSharePoint,
  getAppConfig: () => ({ VITE_SP_RESOURCE: 'https://example.sharepoint.com/sites/test' }),
  readOptionalEnv: () => undefined,
}));

vi.mock('@/lib/runtime', () => ({
  hasSpfxContext: () => true,
}));

import { inMemoryBillingOrderRepository } from '../infra/InMemoryBillingOrderRepository';
import {
  getCurrentBillingOrderRepositoryKind,
  overrideBillingOrderRepository,
  resetBillingOrderRepository,
  useBillingOrderRepository,
} from '../repositoryFactory';

describe('useBillingOrderRepository', () => {
  beforeEach(() => {
    resetBillingOrderRepository();
    envState.isTestMode = true;
    envState.shouldSkipSharePoint = false;
    envState.isDemoModeEnabled = false;
  });

  it('returns in-memory repository in test mode by default', () => {
    const { result } = renderHook(() => useBillingOrderRepository());

    expect(result.current).toBe(inMemoryBillingOrderRepository);
    expect(getCurrentBillingOrderRepositoryKind()).toBe('demo');
  });

  it('returns override repository before reset', () => {
    const overrideRepo: BillingOrderRepository = {
      list: vi.fn(),
      isPersistenceColumnsResolved: vi.fn(),
      updatePaymentStatus: vi.fn(),
      bulkUpdatePaymentStatus: vi.fn(),
    };

    overrideBillingOrderRepository(overrideRepo, 'real');
    const { result } = renderHook(() => useBillingOrderRepository());

    expect(result.current).toBe(overrideRepo);
    expect(getCurrentBillingOrderRepositoryKind()).toBe('real');

    resetBillingOrderRepository();
    const { result: resetResult } = renderHook(() => useBillingOrderRepository());
    expect(resetResult.current).toBe(inMemoryBillingOrderRepository);
    expect(getCurrentBillingOrderRepositoryKind()).toBe('demo');
  });

  it('uses in-memory repository when skipSharePoint is true even without test mode', () => {
    envState.isTestMode = false;
    envState.shouldSkipSharePoint = true;

    const { result } = renderHook(() => useBillingOrderRepository());

    expect(result.current).toBe(inMemoryBillingOrderRepository);
    expect(getCurrentBillingOrderRepositoryKind()).toBe('demo');
  });
});
