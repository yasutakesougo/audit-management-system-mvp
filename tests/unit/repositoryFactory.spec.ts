import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Test: repositoryFactory — 全6モジュールの共通契約テスト
//
// 各ファクトリが以下の不変条件を満たすことを検証する:
//  1. テスト環境ではデモリポジトリが返る
//  2. キャッシュされたインスタンスが再利用される
//  3. override が設定されていれば override が返る
//  4. override をクリアしたら通常ルートに戻る
//  5. reset 後はキャッシュがクリアされ kind がデモに戻る
//  6. forceKind で SP を指定できる（users のみ実証）
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
  isDev: false,
  hasSpfxContext: true,
}));

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    getAppConfig: () => ({
      isDev: mockState.isDev,
      VITE_SP_RESOURCE: 'https://example.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/test',
    }),
    isDemoModeEnabled: () => false,
    isForceDemoEnabled: () => false,
    isTestMode: () => false,
    readBool: () => false,
    shouldSkipLogin: () => false,
  };
});

vi.mock('@/lib/runtime', () => ({
  hasSpfxContext: () => mockState.hasSpfxContext,
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

vi.mock('@/lib/audit', () => ({
  pushAudit: vi.fn(),
}));

vi.mock('@/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/featureFlags')>();
  return {
    ...actual,
    getFeatureFlags: () => ({ ...actual.getFeatureFlags(), icebergPdca: false }),
  };
});

// Mock PnP SP to prevent real connections
vi.mock('@pnp/sp', () => ({
  spfi: () => ({ using: () => ({}) }),
  SPFx: () => ({}),
}));

// ── imports ─────────────────────────────────────────────────────

import {
    getAttendanceRepository,
    getCurrentAttendanceRepositoryKind,
    overrideAttendanceRepository,
    resetAttendanceRepository,
} from '@/features/attendance/repositoryFactory';

import {
    getCurrentDailyRecordRepositoryKind,
    getDailyRecordRepository,
    overrideDailyRecordRepository,
    resetDailyRecordRepository,
} from '@/features/daily/repositoryFactory';

import {
    getCurrentScheduleRepositoryKind,
    getScheduleRepository,
    overrideScheduleRepository,
    resetScheduleRepository,
} from '@/features/schedules/repositoryFactory';

import {
    getCurrentServiceProvisionRepositoryKind,
    getServiceProvisionRepository,
    overrideServiceProvisionRepository,
    resetServiceProvisionRepository,
} from '@/features/service-provision/repositoryFactory';

import {
    getCurrentUserRepositoryKind,
    getUserRepository,
    overrideUserRepository,
    resetUserRepository,
} from '@/features/users/repositoryFactory';

import { InMemoryUserRepository } from '@/features/users/infra/InMemoryUserRepository';

import {
    getPdcaRepository,
} from '@/features/ibd/analysis/pdca/repositoryFactory';

// ═══════════════════════════════════════════════════════════════
// テスト対象リスト（describe.each 用）
// ═══════════════════════════════════════════════════════════════

type FactorySpec = {
  name: string;
  getRepo: () => unknown;
  override: (repo: unknown) => void;
  reset: () => void;
  getKind: () => string;
};

const factories: FactorySpec[] = [
  {
    name: 'attendance',
    getRepo: () => getAttendanceRepository(),
    override: (r) => overrideAttendanceRepository(r as Parameters<typeof overrideAttendanceRepository>[0]),
    reset: resetAttendanceRepository,
    getKind: getCurrentAttendanceRepositoryKind,
  },
  {
    name: 'daily',
    getRepo: () => getDailyRecordRepository(),
    override: (r) => overrideDailyRecordRepository(r as Parameters<typeof overrideDailyRecordRepository>[0]),
    reset: resetDailyRecordRepository,
    getKind: getCurrentDailyRecordRepositoryKind,
  },
  {
    name: 'schedules',
    getRepo: () => getScheduleRepository(),
    override: (r) => overrideScheduleRepository(r as Parameters<typeof overrideScheduleRepository>[0]),
    reset: resetScheduleRepository,
    getKind: getCurrentScheduleRepositoryKind,
  },
  {
    name: 'service-provision',
    getRepo: () => getServiceProvisionRepository(),
    override: (r) => overrideServiceProvisionRepository(r as Parameters<typeof overrideServiceProvisionRepository>[0]),
    reset: resetServiceProvisionRepository,
    getKind: getCurrentServiceProvisionRepositoryKind,
  },
  {
    name: 'users',
    getRepo: () => getUserRepository(),
    override: (r) => overrideUserRepository(r as Parameters<typeof overrideUserRepository>[0]),
    reset: resetUserRepository,
    getKind: getCurrentUserRepositoryKind,
  },
];

// ═══════════════════════════════════════════════════════════════
// 共通契約テスト（5モジュール × 5テスト = 25テスト）
// ═══════════════════════════════════════════════════════════════

describe.each(factories)('repositoryFactory: $name', (factory) => {
  afterEach(() => {
    factory.reset();
    mockState.isDev = false;
    mockState.hasSpfxContext = true;
  });

  it('returns demo repository in test environment (isDev=true)', () => {
    mockState.isDev = true;
    factory.reset();
    const repo = factory.getRepo();
    expect(repo).toBeTruthy();
    expect(factory.getKind()).toBe('demo');
  });

  it('returns demo repository when no SPFx context', () => {
    mockState.isDev = false;
    mockState.hasSpfxContext = false;
    factory.reset();
    const repo = factory.getRepo();
    expect(repo).toBeTruthy();
    expect(factory.getKind()).toBe('demo');
  });

  it('caches repository instance across calls', () => {
    mockState.isDev = true;
    factory.reset();
    const first = factory.getRepo();
    const second = factory.getRepo();
    expect(first).toBe(second);
  });

  it('respects override for DI in tests', () => {
    const mockRepo = { __mock: true };
    factory.override(mockRepo);
    const repo = factory.getRepo();
    expect(repo).toBe(mockRepo);
  });

  it('clears override on null and returns to normal resolution', () => {
    const mockRepo = { __mock: true };
    factory.override(mockRepo);
    expect(factory.getRepo()).toBe(mockRepo);

    factory.override(null);
    mockState.isDev = true;
    factory.reset();
    const repo = factory.getRepo();
    expect(repo).not.toBe(mockRepo);
    expect(repo).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// users 固有テスト — forceKind でSPリポジトリが返る
// ═══════════════════════════════════════════════════════════════

describe('repositoryFactory: users (forceKind)', () => {
  afterEach(() => {
    resetUserRepository();
    mockState.isDev = false;
    mockState.hasSpfxContext = true;
  });

  it('returns SP repository kind when forced via forceKind', () => {
    (globalThis as Record<string, unknown>).__SPFX_CONTEXT__ = {
      pageContext: { web: { absoluteUrl: 'https://example.sharepoint.com/sites/test' } },
    };
    resetUserRepository();
    const repo = getUserRepository({ forceKind: 'real', acquireToken: vi.fn().mockResolvedValue('mock-token') });
    expect(repo).not.toBeInstanceOf(InMemoryUserRepository);
    delete (globalThis as Record<string, unknown>).__SPFX_CONTEXT__;
  });
});

// ═══════════════════════════════════════════════════════════════
// ibd/pdca — 特殊パターン（override/reset API なし）
// ═══════════════════════════════════════════════════════════════

describe('repositoryFactory: ibd/pdca', () => {
  it('returns in-memory repository in test environment', () => {
    const repo = getPdcaRepository();
    expect(repo).toBeTruthy();
  });

  it('caches repository instance across calls', () => {
    const first = getPdcaRepository();
    const second = getPdcaRepository();
    expect(first).toBe(second);
  });
});
