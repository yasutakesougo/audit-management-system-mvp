/**
 * useDailyIntegrityExceptions — referential stability contract
 *
 * The hook must return the same object reference when its async state
 * has not changed, preventing TodayOpsPage / ExceptionCenter from
 * triggering unnecessary re-renders.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDailyIntegrityExceptions } from '../useDailyIntegrityExceptions';

vi.mock('@/features/daily/repositoryFactory', () => ({
  useDailyRecordRepository: vi.fn(),
}));

import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';

const mockScanIntegrity = vi.fn();

describe('useDailyIntegrityExceptions — referential stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDailyRecordRepository).mockReturnValue({
      scanIntegrity: mockScanIntegrity,
      list: vi.fn(),
      approve: vi.fn(),
    } as never);
    mockScanIntegrity.mockResolvedValue([]);
  });

  it('returns the same object reference on rerender when state has not changed', async () => {
    const { result, rerender } = renderHook(() =>
      useDailyIntegrityExceptions('2026-03-31'),
    );

    // Wait for the async scan to settle
    await act(async () => {});

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('returns a stable empty items array (not new []) before scan completes', () => {
    mockScanIntegrity.mockReturnValue(new Promise(() => {})); // never resolves

    const { result, rerender } = renderHook(() =>
      useDailyIntegrityExceptions('2026-03-31'),
    );

    const firstItems = result.current.items;
    rerender();

    expect(result.current.items).toBe(firstItems);
    expect(firstItems).toEqual([]);
  });
});
