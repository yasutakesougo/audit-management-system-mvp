import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Test: repositoryFactory demo/SP switching
//
// Strategy: Use `overrideUserRepository` + `resetUserRepository` to test
// the factory's caching and kind-resolution logic. For the env-based
// switching, we test `getCurrentUserRepositoryKind` after mocking env.
// ---------------------------------------------------------------------------

let mockIsDev = false;
let mockHasSpfxContext = true;

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({
    isDev: mockIsDev,
    VITE_SP_RESOURCE: 'https://example.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/test',
  }),
  isDemoModeEnabled: () => false,
  isForceDemoEnabled: () => false,
  isTestMode: () => false,
  readBool: () => false,
  shouldSkipLogin: () => false,
}));

vi.mock('@/lib/runtime', () => ({
  hasSpfxContext: () => mockHasSpfxContext,
}));

vi.mock('@/lib/audit', () => ({
  pushAudit: vi.fn(),
}));

// Mock PnP SP to prevent real connections
vi.mock('@pnp/sp', () => ({
  spfi: () => ({ using: () => ({}) }),
  SPFx: () => ({}),
}));

import { InMemoryUserRepository } from '../../src/features/users/infra/InMemoryUserRepository';
import {
    getCurrentUserRepositoryKind,
    getUserRepository,
    resetUserRepository,
} from '../../src/features/users/repositoryFactory';

describe('repositoryFactory', () => {
  afterEach(() => {
    resetUserRepository();
    mockIsDev = false;
    mockHasSpfxContext = true;
  });

  it('returns InMemoryUserRepository when isDev=true', () => {
    mockIsDev = true;
    resetUserRepository();

    const repo = getUserRepository();

    expect(repo).toBeInstanceOf(InMemoryUserRepository);
    expect(getCurrentUserRepositoryKind()).toBe('demo');
  });

  it('returns InMemoryUserRepository when no SPFx context', () => {
    mockIsDev = false;
    mockHasSpfxContext = false;
    resetUserRepository();

    const repo = getUserRepository();

    expect(repo).toBeInstanceOf(InMemoryUserRepository);
    expect(getCurrentUserRepositoryKind()).toBe('demo');
  });

  it('returns SP repository kind when forced via forceKind', () => {
    // Provide SPFx context so SP constructor doesn't throw
    (globalThis as Record<string, unknown>).__SPFX_CONTEXT__ = {
      pageContext: { web: { absoluteUrl: 'https://example.sharepoint.com/sites/test' } },
    };

    resetUserRepository();
    const repo = getUserRepository({ forceKind: 'sharepoint' });

    // Should not be InMemory
    expect(repo).not.toBeInstanceOf(InMemoryUserRepository);

    delete (globalThis as Record<string, unknown>).__SPFX_CONTEXT__;
  });

  it('caches repository instance on repeated calls', () => {
    mockIsDev = true;
    resetUserRepository();

    const repo1 = getUserRepository();
    const repo2 = getUserRepository();

    expect(repo1).toBe(repo2); // same reference
  });
});
