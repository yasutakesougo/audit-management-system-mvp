/**
 * useNextActionProgress — Store unit tests
 *
 * Tests: start/done/reset actions, localStorage persistence
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProgressKey, buildStableEventId, useNextActionProgress } from './useNextActionProgress';

describe('useNextActionProgress', () => {
  const STORAGE_KEY = 'today.nextAction.v1';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with empty store when localStorage is empty', () => {
    const { result } = renderHook(() => useNextActionProgress());

    expect(result.current.getProgress('any-key')).toBeNull();
  });

  it('start() sets startedAt and persists to localStorage', () => {
    const { result } = renderHook(() => useNextActionProgress());
    const key = 'test-key';

    act(() => {
      result.current.start(key);
    });

    const progress = result.current.getProgress(key);
    expect(progress).not.toBeNull();
    expect(progress!.startedAt).toBeTruthy();
    expect(progress!.doneAt).toBeNull();

    // Verify localStorage persistence
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored[key]).toBeDefined();
    expect(stored[key].startedAt).toBeTruthy();
  });

  it('done() sets doneAt while preserving startedAt', () => {
    const { result } = renderHook(() => useNextActionProgress());
    const key = 'test-key';

    act(() => {
      result.current.start(key);
    });

    const startedAt = result.current.getProgress(key)!.startedAt;

    act(() => {
      result.current.done(key);
    });

    const progress = result.current.getProgress(key);
    expect(progress!.startedAt).toBe(startedAt);
    expect(progress!.doneAt).toBeTruthy();
  });

  it('done() without prior start() sets both timestamps', () => {
    const { result } = renderHook(() => useNextActionProgress());
    const key = 'direct-done';

    act(() => {
      result.current.done(key);
    });

    const progress = result.current.getProgress(key);
    expect(progress!.startedAt).toBeTruthy();
    expect(progress!.doneAt).toBeTruthy();
  });

  it('reset() removes the entry', () => {
    const { result } = renderHook(() => useNextActionProgress());
    const key = 'reset-test';

    act(() => {
      result.current.start(key);
    });
    expect(result.current.getProgress(key)).not.toBeNull();

    act(() => {
      result.current.reset(key);
    });
    expect(result.current.getProgress(key)).toBeNull();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored[key]).toBeUndefined();
  });

  it('hydrates from localStorage on mount', () => {
    const key = 'hydrated-key';
    const data = { [key]: { startedAt: '2026-01-01T00:00:00Z', doneAt: null } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const { result } = renderHook(() => useNextActionProgress());

    const progress = result.current.getProgress(key);
    expect(progress).not.toBeNull();
    expect(progress!.startedAt).toBe('2026-01-01T00:00:00Z');
  });
});

describe('buildProgressKey', () => {
  it('creates a key with date and event ID', () => {
    const key = buildProgressKey('2026-02-27', 'staff-1|09:00|朝会');
    expect(key).toBe('today.nextAction.v1:2026-02-27:staff-1|09:00|朝会');
  });
});

describe('buildStableEventId', () => {
  it('combines id, time, and title', () => {
    const eventId = buildStableEventId('staff-1', '09:00', '朝会');
    expect(eventId).toBe('staff-1|09:00|朝会');
  });
});
