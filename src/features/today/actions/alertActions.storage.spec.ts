/**
 * alertActions.storage — Persistence resilience tests
 *
 * Tests that storage failures are classified and don't crash the UI.
 *
 * @skill @testing-patterns @error-handling-patterns
 * @sprint Night Autonomous Sprint (Fortress Safe Mode)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these survive vi.mock hoisting
const { mockLogBriefingActionError, mockClassifyStorageError } = vi.hoisted(() => ({
  mockLogBriefingActionError: vi.fn(),
  mockClassifyStorageError: vi.fn((err: unknown) => {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') return 'persist_failed_quota';
    if (err instanceof SyntaxError) return 'persist_failed_parse';
    return 'persist_failed_unknown';
  }),
}));

vi.mock('./alertActions.logger', () => ({
  classifyStorageError: mockClassifyStorageError,
  logBriefingActionError: mockLogBriefingActionError,
}));

vi.mock('@/lib/debugLogger', () => ({
  auditLog: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn(), enabled: false },
}));

vi.mock('@/lib/persistentLogger', () => ({
  persistentLogger: { error: vi.fn(), getLogs: vi.fn(() => []), clear: vi.fn() },
}));

import { buildStorageKey, createLocalStorageRepo } from './alertActions.storage';

describe('createLocalStorageRepo', () => {
  const YMD = '2026-02-28';
  const USER = 'test@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('setState — success path', () => {
    it('persists state and returns true', () => {
      const repo = createLocalStorageRepo(YMD, USER);
      const result = repo.setState('absent:user-001:2026-02-28', 'done');

      expect(result).toBe(true);
      expect(repo.getState('absent:user-001:2026-02-28')).toBe('done');
    });

    it('overwrites existing state', () => {
      const repo = createLocalStorageRepo(YMD, USER);
      repo.setState('absent:user-001:2026-02-28', 'doing');
      repo.setState('absent:user-001:2026-02-28', 'done');

      expect(repo.getState('absent:user-001:2026-02-28')).toBe('done');
    });
  });

  describe('setState — failure path (non-crashing UI)', () => {
    it('returns false and logs error on QuotaExceededError', () => {
      const repo = createLocalStorageRepo(YMD, USER);

      const original = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = vi.fn(() => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      });

      const result = repo.setState('absent:user-001:2026-02-28', 'done');

      expect(result).toBe(false);
      expect(mockLogBriefingActionError).toHaveBeenCalledWith(
        expect.objectContaining({
          ymd: YMD,
          alertType: 'absent',
          userId: 'user-001',
          errorClass: 'persist_failed_quota',
        }),
      );

      window.localStorage.setItem = original;
    });

    it('returns false and logs error on generic error', () => {
      const repo = createLocalStorageRepo(YMD, USER);

      const original = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = vi.fn(() => {
        throw new TypeError('SecurityError or other');
      });

      const result = repo.setState('late:user-002:2026-02-28', 'snoozed');

      expect(result).toBe(false);
      expect(mockLogBriefingActionError).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'late',
          userId: 'user-002',
          errorClass: 'persist_failed_unknown',
        }),
      );

      window.localStorage.setItem = original;
    });

    it('does not throw — exception never escapes setState', () => {
      const repo = createLocalStorageRepo(YMD, USER);

      const original = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = vi.fn(() => { throw new Error('unexpected'); });

      // This must NOT throw — Fortress requirement
      expect(() => repo.setState('early:user-003:2026-02-28', 'done')).not.toThrow();

      window.localStorage.setItem = original;
    });
  });

  describe('load — corrupted data', () => {
    it('returns empty state on corrupted JSON', () => {
      const key = buildStorageKey(YMD, USER);
      window.localStorage.setItem(key, '{corrupted json!!!');

      const repo = createLocalStorageRepo(YMD, USER);
      expect(repo.load()).toEqual({});
    });
  });

  describe('clear', () => {
    it('removes storage key', () => {
      const repo = createLocalStorageRepo(YMD, USER);
      repo.setState('absent:user-001:2026-02-28', 'done');
      repo.clear();

      expect(repo.load()).toEqual({});
    });
  });

  describe('getState — defaults', () => {
    it('returns todo for unknown keys', () => {
      const repo = createLocalStorageRepo(YMD, USER);
      expect(repo.getState('nonexistent:key:2026-02-28')).toBe('todo');
    });
  });
});
