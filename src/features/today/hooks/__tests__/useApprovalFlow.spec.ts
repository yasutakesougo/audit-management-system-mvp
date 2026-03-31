/**
 * useApprovalFlow — referential stability contract
 *
 * The hook must return the same object reference on rerenders when
 * no state has changed, and function references (open/close/approve)
 * must remain stable between rerenders.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useApprovalFlow } from '../useApprovalFlow';

vi.mock('@/features/daily/repositories/repositoryFactory', () => ({
  useDailyRecordRepository: vi.fn(),
}));

vi.mock('@/features/staff', () => ({
  useStaffStore: vi.fn(),
}));

vi.mock('@/utils/getNow', () => ({
  toLocalDateISO: () => '2026-03-31',
}));

import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
import { useStaffStore } from '@/features/staff';

const mockApprove = vi.fn();

describe('useApprovalFlow — referential stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDailyRecordRepository).mockReturnValue({
      approve: mockApprove,
    } as never);
    vi.mocked(useStaffStore).mockReturnValue({ staff: [] } as never);
    mockApprove.mockResolvedValue(undefined);
  });

  it('returns the same object reference on rerender when state is unchanged', () => {
    const { result, rerender } = renderHook(() => useApprovalFlow());

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('open/close/approve function references are stable across rerenders', () => {
    const { result, rerender } = renderHook(() => useApprovalFlow());

    const { open, close, approve } = result.current;
    rerender();

    expect(result.current.open).toBe(open);
    expect(result.current.close).toBe(close);
    expect(result.current.approve).toBe(approve);
  });

  it('returns a new reference only after state change (open)', () => {
    const { result } = renderHook(() => useApprovalFlow());

    const first = result.current;

    act(() => {
      result.current.open();
    });

    expect(result.current).not.toBe(first);
    expect(result.current.isOpen).toBe(true);
  });
});
