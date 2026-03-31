/**
 * useTodayScheduleLanes — referential stability contract
 *
 * Ensures the hook returns the same object reference when its inputs
 * have not changed (prevents cascading useMemo invalidations in TodayOpsPage).
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useTodayScheduleLanes } from '../useTodayScheduleLanes';

vi.mock('@/features/schedules/hooks/useSchedulesToday', () => ({
  useSchedulesToday: vi.fn(),
}));

import { useSchedulesToday } from '@/features/schedules/hooks/useSchedulesToday';

const mockRefetch = vi.fn();

function makeSchedulesResult(overrides = {}) {
  return {
    data: [],
    loading: false,
    error: null,
    source: 'demo' as const,
    fallbackKind: null,
    fallbackError: null,
    dateISO: '2026-03-31',
    refetch: mockRefetch,
    isFetching: false,
    failureCount: 0,
    retryAfter: 0,
    cooldownUntil: 0,
    ...overrides,
  };
}

describe('useTodayScheduleLanes — referential stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSchedulesToday).mockReturnValue(makeSchedulesResult());
  });

  it('returns the same object reference on rerender when inputs are unchanged', () => {
    const { result, rerender } = renderHook(() => useTodayScheduleLanes());

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('returns the same lanes reference when data is empty on every render', () => {
    const { result, rerender } = renderHook(() => useTodayScheduleLanes());

    const firstLanes = result.current.lanes;
    rerender();
    rerender();

    expect(result.current.lanes).toBe(firstLanes);
  });

  it('returns a new reference only when underlying data changes', () => {
    const { result, rerender } = renderHook(() => useTodayScheduleLanes());

    const first = result.current;

    // Simulate data arrival
    vi.mocked(useSchedulesToday).mockReturnValue(
      makeSchedulesResult({
        data: [{ id: 's-1', title: 'Morning Stand-up', date: '2026-03-31', time: '09:00' }],
      }),
    );
    rerender();

    expect(result.current).not.toBe(first);
  });
});
