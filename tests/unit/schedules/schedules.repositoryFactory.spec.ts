/**
 * Schedules repositoryFactory — switch / cache / fallback tests
 *
 * Safety-net to ensure:
 * - Demo mode → InMemory repository
 * - No SPFx context → InMemory (safe fallback)
 * - forceKind=sharepoint → SharePoint repo (with acquireToken)
 * - Caching: same params → same instance
 * - Missing acquireToken in SP mode → throws
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs BEFORE vi.mock hoisting — safe to reference in factories
const { mockInMemoryRepo, MockSPRepo, mockSpInstance } = vi.hoisted(() => {
  const mockSpInstance = {
    list: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  // Use a regular function (not arrow) so it's callable with `new`
  const MockSPRepo = vi.fn(function(this: unknown) {
    Object.assign(this as Record<string, unknown>, mockSpInstance);
    return mockSpInstance;
  });
  return {
    mockInMemoryRepo: {
      list: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    MockSPRepo,
    mockSpInstance,
  };
});

// Mock env module before imports
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    getAppConfig: vi.fn(() => ({ isDev: false })),
    isDemoModeEnabled: vi.fn(() => false),
    isForceDemoEnabled: vi.fn(() => false),
    isTestMode: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
    shouldSkipSharePoint: vi.fn(() => false),
    readBool: vi.fn(() => false),
    readEnv: vi.fn(() => ''),
    readOptionalEnv: vi.fn(() => undefined),
  };
});

vi.mock('@/lib/runtime', () => ({
  hasSpfxContext: vi.fn(() => false),
}));

vi.mock('@/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/env')>();
  return {
    ...actual,
    isE2E: false,
    isE2eMsalMock: false,
    isE2eForceSchedulesWrite: false,
  };
});

// Break transitive import chain: SharePointScheduleRepository → fetchSp → msal
vi.mock('@/features/schedules/infra/SharePointScheduleRepository', () => ({
  SharePointScheduleRepository: MockSPRepo,
}));

// Factory uses DataProviderScheduleRepository for real SP access
vi.mock('@/features/schedules/infra/DataProviderScheduleRepository', () => ({
  DataProviderScheduleRepository: MockSPRepo,
}));

// Mock InMemory repo singleton
vi.mock('@/features/schedules/infra/InMemoryScheduleRepository', () => ({
  inMemoryScheduleRepository: mockInMemoryRepo,
  InMemoryScheduleRepository: vi.fn(() => mockInMemoryRepo),
}));

// Mock auth to prevent MSAL chain
vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({ acquireToken: vi.fn(async () => null) })),
}));

// Mock spClient — factory calls createSpClient + ensureConfig for DI
vi.mock('@/lib/spClient', () => ({
  createSpClient: vi.fn(() => ({
    spFetch: vi.fn(),
    tryGetListMetadata: vi.fn(),
  })),
  ensureConfig: vi.fn(() => ({
    siteUrl: 'https://example.sharepoint.com/sites/test',
    baseUrl: 'https://example.sharepoint.com/sites/test/_api',
  })),
}));


import {
    getCurrentScheduleRepositoryKind,
    getScheduleRepository,
    resetScheduleRepository,
} from '@/features/schedules/repositoryFactory';

// eslint-disable-next-line no-restricted-imports -- test needs direct env mock access
import * as envModule from '@/lib/env';
import * as runtimeModule from '@/lib/runtime';

const mockAcquireToken = vi.fn(async () => 'mock-token');

describe('schedules repositoryFactory', () => {
  beforeEach(() => {
    resetScheduleRepository();
    MockSPRepo.mockClear();
    vi.mocked(envModule.getAppConfig).mockReturnValue({ isDev: false } as ReturnType<typeof envModule.getAppConfig>);
    vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(false);
    vi.mocked(envModule.isForceDemoEnabled).mockReturnValue(false);
    vi.mocked(envModule.isTestMode).mockReturnValue(false);
    vi.mocked(envModule.shouldSkipLogin).mockReturnValue(false);
    vi.mocked(envModule.shouldSkipSharePoint).mockReturnValue(false);
    vi.mocked(envModule.readBool).mockReturnValue(false);
    vi.mocked(runtimeModule.hasSpfxContext).mockReturnValue(true);
  });

  describe('demo/InMemory path', () => {
    it('returns InMemory when isDev is true', () => {
      vi.mocked(envModule.getAppConfig).mockReturnValue({ isDev: true } as ReturnType<typeof envModule.getAppConfig>);

      const repo = getScheduleRepository();
      expect(repo).toBe(mockInMemoryRepo);
      expect(getCurrentScheduleRepositoryKind()).toBe('demo');
    });

    it('returns InMemory when demo mode is enabled', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(true);

      const repo = getScheduleRepository();
      expect(repo).toBe(mockInMemoryRepo);
    });

    it('returns InMemory when skipLogin is true', () => {
      vi.mocked(envModule.shouldSkipLogin).mockReturnValue(true);

      const repo = getScheduleRepository();
      expect(repo).toBe(mockInMemoryRepo);
    });

    it('returns InMemory when no SPFx context (safe fallback)', () => {
      vi.mocked(runtimeModule.hasSpfxContext).mockReturnValue(false);

      const repo = getScheduleRepository();
      expect(repo).toBe(mockInMemoryRepo);
    });

    it('returns InMemory when test mode is enabled', () => {
      vi.mocked(envModule.isTestMode).mockReturnValue(true);

      const repo = getScheduleRepository();
      expect(repo).toBe(mockInMemoryRepo);
    });
  });

  describe('SharePoint path', () => {
    it('returns SharePoint repo when forceKind=real with acquireToken', () => {
      const repo = getScheduleRepository({
        forceKind: 'real',
        acquireToken: mockAcquireToken,
      });
      expect(repo).toBe(mockSpInstance);
      expect(getCurrentScheduleRepositoryKind()).toBe('real');
      expect(MockSPRepo).toHaveBeenCalledWith(
        expect.objectContaining({ provider: expect.anything() }),
      );
    });

    it('throws when forceKind=sharepoint without acquireToken', () => {
      expect(() => getScheduleRepository({ forceKind: 'real' }))
        .toThrow('acquireToken is required');
    });
  });

  describe('caching', () => {
    it('returns same instance for repeated calls with no options', () => {
      vi.mocked(envModule.getAppConfig).mockReturnValue({ isDev: true } as ReturnType<typeof envModule.getAppConfig>);

      const a = getScheduleRepository();
      const b = getScheduleRepository();
      expect(a).toBe(b);
    });

    it('returns fresh instance after resetScheduleRepository()', () => {
      vi.mocked(envModule.getAppConfig).mockReturnValue({ isDev: true } as ReturnType<typeof envModule.getAppConfig>);

      const a = getScheduleRepository();
      resetScheduleRepository();
      const b = getScheduleRepository();
      expect(a).toBe(mockInMemoryRepo);
      expect(b).toBe(mockInMemoryRepo);
    });
  });
});
