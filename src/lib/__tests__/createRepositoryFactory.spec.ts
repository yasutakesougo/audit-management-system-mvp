import { describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing the factory
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ acquireToken: async () => 'mock-token' }),
}));

vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({ isDev: false }),
  isDemoModeEnabled: () => false,
  isForceDemoEnabled: () => false,
  isTestMode: () => true, // test mode → demo by default
  shouldSkipLogin: () => false,
}));

vi.mock('@/lib/runtime', () => ({
  hasSpfxContext: () => false,
}));

import {
  createRepositoryFactory,
  type BaseFactoryOptions,
} from '@/lib/createRepositoryFactory';

// ─── Dummy Types ──────────────────────────────────────────────────────────

interface TestRepo {
  kind: 'demo' | 'real';
  id: string;
}

// ─── Suite ────────────────────────────────────────────────────────────────

describe('createRepositoryFactory', () => {
  const demoRepo: TestRepo = { kind: 'demo', id: 'demo-1' };
  const realRepo: TestRepo = { kind: 'real', id: 'real-1' };

  function makeFactory(overrides?: {
    shouldUseDemo?: () => boolean;
    useAuthInHook?: boolean;
  }) {
    return createRepositoryFactory<TestRepo, BaseFactoryOptions>({
      name: 'Test',
      createDemo: () => ({ ...demoRepo }),
      createReal: (options) => {
        if (!options?.acquireToken) {
          throw new Error('acquireToken is required');
        }
        return { ...realRepo };
      },
      ...overrides,
    });
  }

  describe('getRepository', () => {
    it('returns demo repository when shouldUseDemo returns true', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const repo = factory.getRepository();
      expect(repo.kind).toBe('demo');
    });

    it('returns real repository when shouldUseDemo returns false and acquireToken is provided', () => {
      const factory = makeFactory({
        shouldUseDemo: () => false,
      });
      const repo = factory.getRepository({ acquireToken: async () => 'token' });
      expect(repo.kind).toBe('real');
    });

    it('throws when real repository requested without acquireToken', () => {
      const factory = makeFactory({
        shouldUseDemo: () => false,
        useAuthInHook: true,
      });
      expect(() => factory.getRepository()).toThrow('acquireToken is required');
    });

    it('forceKind overrides shouldUseDemo', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const repo = factory.getRepository({
        forceKind: 'real',
        acquireToken: async () => 'token',
      });
      expect(repo.kind).toBe('real');
    });

    it('caches repository when no options provided', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const first = factory.getRepository();
      const second = factory.getRepository();
      expect(first).toBe(second); // same instance
    });

    it('does not cache when options are provided', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const first = factory.getRepository({ forceKind: 'demo' } as BaseFactoryOptions);
      const second = factory.getRepository({ forceKind: 'demo' } as BaseFactoryOptions);
      expect(first).not.toBe(second); // different instances
    });
  });

  describe('override / reset', () => {
    it('override replaces returned repository', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const overrideRepo: TestRepo = { kind: 'demo', id: 'override' };
      factory.override(overrideRepo);
      expect(factory.getRepository().id).toBe('override');
    });

    it('override(null) clears the override', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const overrideRepo: TestRepo = { kind: 'demo', id: 'override' };
      factory.override(overrideRepo);
      factory.override(null);
      expect(factory.getRepository().id).not.toBe('override');
    });

    it('reset clears cache and override', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      const first = factory.getRepository();

      factory.override({ kind: 'demo', id: 'override' });
      factory.reset();

      const after = factory.getRepository();
      expect(after.id).not.toBe('override');
      expect(after).not.toBe(first); // cache was cleared
    });
  });

  describe('getCurrentKind', () => {
    it('returns demo when shouldUseDemo is true', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      expect(factory.getCurrentKind()).toBe('demo');
    });

    it('returns real when shouldUseDemo is false', () => {
      const factory = makeFactory({ shouldUseDemo: () => false });
      expect(factory.getCurrentKind()).toBe('real');
    });

    it('returns cached kind after getRepository call', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      factory.getRepository();
      expect(factory.getCurrentKind()).toBe('demo');
    });

    it('returns override kind when override is set', () => {
      const factory = makeFactory({ shouldUseDemo: () => true });
      factory.override({ kind: 'real', id: 'override' }, 'real');
      expect(factory.getCurrentKind()).toBe('real');
    });
  });
});
