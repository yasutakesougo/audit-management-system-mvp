import { createDefaultAssessment, type UserAssessment } from '@/features/assessment/domain/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Dynamic import so we can reset modules between tests
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'assessmentDraft.v1';

function makeAssessment(userId: string, overrides?: Partial<UserAssessment>): UserAssessment {
  return {
    ...createDefaultAssessment(userId),
    id: `test-${userId}`,
    ...overrides,
  };
}

describe('assessmentStore localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('saves to localStorage and restores on reload', async () => {
    // 1. Import store, save data, flush
    const mod1 = await import('@/features/assessment/stores/assessmentStore');
    const assessment = makeAssessment('u1', {
      items: [{ id: '1', category: 'body', topic: 'test', status: 'neutral', description: 'desc' }],
    });
    // Directly call save via the exported function mechanism
    // We need to use the hook's save, but since we can't use hooks outside React,
    // we call the internal helpers
    mod1.__flushPersist(); // persist initial empty state first

    // Use the internal save approach: call clearAssessmentDraft to test it exists,
    // then manually set localStorage for the load test
    const payload = {
      version: 1,
      data: { u1: assessment },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    // 2. Reset modules to simulate "reload"
    vi.resetModules();
    const mod2 = await import('@/features/assessment/stores/assessmentStore');
    mod2.__resetStore();

    // 3. Verify: use renderHook is complex, so test internal snapshot
    // The __resetStore reloads from localStorage, and the module-level
    // `assessments` variable should now contain our data.
    // We can verify by flushing and reading back
    mod2.__flushPersist();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.data?.u1?.userId).toBe('u1');
    expect(stored.data?.u1?.items).toHaveLength(1);
    expect(stored.data?.u1?.items[0]?.topic).toBe('test');
  });

  it('handles corrupt JSON gracefully — returns empty and clears storage', async () => {
    // Plant corrupt data
    localStorage.setItem(STORAGE_KEY, '{{{INVALID JSON!!!');

    const mod = await import('@/features/assessment/stores/assessmentStore');
    mod.__resetStore();

    // Should have cleared the corrupt entry
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Store should be functional (empty)
    mod.__flushPersist();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.version).toBe(1);
    expect(Object.keys(stored.data ?? {})).toHaveLength(0);
  });

  it('rejects schema version mismatch — falls back to empty', async () => {
    // Plant data with wrong version
    const wrongVersion = {
      version: 999,
      data: { u1: makeAssessment('u1') },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrongVersion));

    const mod = await import('@/features/assessment/stores/assessmentStore');
    mod.__resetStore();

    // Should have cleared the mismatched entry
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Store functional with empty state
    mod.__flushPersist();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(Object.keys(stored.data ?? {})).toHaveLength(0);
  });

  it('clearAssessmentDraft removes specific user draft', async () => {
    // Plant two users
    const payload = {
      version: 1,
      data: {
        u1: makeAssessment('u1'),
        u2: makeAssessment('u2'),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    const mod = await import('@/features/assessment/stores/assessmentStore');
    mod.__resetStore();

    // Clear u1's draft
    mod.clearAssessmentDraft('u1');
    mod.__flushPersist();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.data?.u1).toBeUndefined();
    expect(stored.data?.u2?.userId).toBe('u2');
  });
});
