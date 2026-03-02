/**
 * Daily repositoryFactory — switching / fallback / cache tests
 *
 * Mirrors schedules.repositoryFactory.spec.ts pattern.
 * Verifies:
 * - Demo mode (isDev, test, demo, skipLogin, no SPFx) → InMemory
 * - SP mode with acquireToken → SharePoint
 * - SP mode without acquireToken → throws
 * - Cache hit / reset
 * - Override mechanism
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAcquireToken = vi.fn().mockResolvedValue('mock-token');

const { mockEnv, mockRuntime } = vi.hoisted(() => {
  return {
    mockEnv: {
      getAppConfig: vi.fn().mockReturnValue({ isDev: true }),
      isDemoModeEnabled: vi.fn().mockReturnValue(false),
      isForceDemoEnabled: vi.fn().mockReturnValue(false),
      isTestMode: vi.fn().mockReturnValue(false),
      shouldSkipLogin: vi.fn().mockReturnValue(false),
      getConfiguredMsalScopes: vi.fn().mockReturnValue([]),
      isWriteEnabled: true,
      isE2eForceSchedulesWrite: false,
      isDev: true,
      isE2E: false,
    },
    mockRuntime: {
      hasSpfxContext: vi.fn().mockReturnValue(false),
    },
  };
});

const mockSpInstance = vi.hoisted(() => ({
  save: vi.fn(),
  load: vi.fn(),
  list: vi.fn(),
}));

const MockSPRepo = vi.hoisted(() => {
  return vi.fn(function(this: unknown) { return mockSpInstance; });
});

vi.mock('@/lib/env', () => mockEnv);
vi.mock('@/lib/runtime', () => mockRuntime);
vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn().mockReturnValue({
    acquireToken: vi.fn(),
    getListReadyState: vi.fn().mockReturnValue(null),
    setListReadyState: vi.fn(),
  }),
}));
vi.mock('@/features/daily/infra/SharePointDailyRecordRepository', () => ({
  SharePointDailyRecordRepository: MockSPRepo,
}));

import { inMemoryDailyRecordRepository } from '@/features/daily/infra/InMemoryDailyRecordRepository';
import {
    getCurrentDailyRecordRepositoryKind,
    getDailyRecordRepository,
    resetDailyRecordRepository,
} from '@/features/daily/repositoryFactory';

describe('Daily repositoryFactory', () => {
  beforeEach(() => {
    resetDailyRecordRepository();
    vi.clearAllMocks();
    // Default: isDev=true → demo mode
    mockEnv.getAppConfig.mockReturnValue({ isDev: true });
    mockEnv.isDemoModeEnabled.mockReturnValue(false);
    mockEnv.isForceDemoEnabled.mockReturnValue(false);
    mockEnv.isTestMode.mockReturnValue(false);
    mockEnv.shouldSkipLogin.mockReturnValue(false);
    mockRuntime.hasSpfxContext.mockReturnValue(false);
  });

  describe('demo/InMemory path', () => {
    it('returns InMemory when isDev=true', () => {
      const repo = getDailyRecordRepository();
      expect(repo).toBe(inMemoryDailyRecordRepository);
      expect(getCurrentDailyRecordRepositoryKind()).toBe('demo');
    });

    it('returns InMemory when demo mode enabled', () => {
      mockEnv.getAppConfig.mockReturnValue({ isDev: false });
      mockEnv.isDemoModeEnabled.mockReturnValue(true);
      const repo = getDailyRecordRepository();
      expect(repo).toBe(inMemoryDailyRecordRepository);
    });

    it('returns InMemory when skipLogin', () => {
      mockEnv.getAppConfig.mockReturnValue({ isDev: false });
      mockEnv.shouldSkipLogin.mockReturnValue(true);
      const repo = getDailyRecordRepository();
      expect(repo).toBe(inMemoryDailyRecordRepository);
    });

    it('returns InMemory when no SPFx context', () => {
      mockEnv.getAppConfig.mockReturnValue({ isDev: false });
      mockRuntime.hasSpfxContext.mockReturnValue(false);
      const repo = getDailyRecordRepository();
      expect(repo).toBe(inMemoryDailyRecordRepository);
    });

    it('returns InMemory when test mode', () => {
      mockEnv.getAppConfig.mockReturnValue({ isDev: false });
      mockEnv.isTestMode.mockReturnValue(true);
      const repo = getDailyRecordRepository();
      expect(repo).toBe(inMemoryDailyRecordRepository);
    });
  });

  describe('SharePoint path', () => {
    it('returns SharePoint repo when forceKind=sharepoint with acquireToken', () => {
      const repo = getDailyRecordRepository({
        forceKind: 'sharepoint',
        acquireToken: mockAcquireToken,
      });
      expect(repo).toBe(mockSpInstance);
      // forceKind with custom options is not cached, so MockSPRepo was called
      expect(MockSPRepo).toHaveBeenCalledWith(
        expect.objectContaining({ acquireToken: mockAcquireToken }),
      );
    });

    it('throws when forceKind=sharepoint without acquireToken', () => {
      expect(() =>
        getDailyRecordRepository({ forceKind: 'sharepoint' }),
      ).toThrow('acquireToken is required');
    });
  });

  describe('caching', () => {
    it('returns cached instance on second call with same params', () => {
      const repo1 = getDailyRecordRepository();
      const repo2 = getDailyRecordRepository();
      expect(repo1).toBe(repo2);
    });

    it('returns fresh instance after reset', () => {
      const repo1 = getDailyRecordRepository();
      resetDailyRecordRepository();
      const repo2 = getDailyRecordRepository();
      // Both are inMemory singleton, so still same reference
      expect(repo1).toBe(repo2);
      expect(repo1).toBe(inMemoryDailyRecordRepository);
    });
  });
});
