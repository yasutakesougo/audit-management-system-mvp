import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDriftRepair } from '../useDriftRepair';
import { useSP } from '@/lib/spClient';
import { usePersistentDrift } from '../usePersistentDrift';
import { DriftRepairDispatcher } from '../../infra/DriftRepairDispatcher';

// Mock dependencies
vi.mock('@/lib/spClient', () => ({
  useSP: vi.fn(),
}));

vi.mock('../usePersistentDrift', () => ({
  usePersistentDrift: vi.fn(),
}));

vi.mock('../../infra/DriftRepairDispatcher');

describe('useDriftRepair', () => {
  const mockRefetch = vi.fn();
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSP as any).mockReturnValue({ spFetch: vi.fn() });
    (usePersistentDrift as any).mockReturnValue({ refetch: mockRefetch });
    (DriftRepairDispatcher as any).prototype.dispatch = mockDispatch;
  });

  it('manages loading and success states', async () => {
    const successResult = { success: true, message: '修復成功', reScanRequired: true };
    mockDispatch.mockResolvedValue(successResult);

    const { result } = renderHook(() => useDriftRepair());

    expect(result.current.isRepairing).toBe(false);

    // Act
    await act(async () => {
      await result.current.repair('fix-case', 'TestList', 'TestField');
    });

    expect(result.current.isRepairing).toBe(false);
    expect(result.current.lastSuccessMessage).toBe('修復成功');
    expect(result.current.lastError).toBeNull();
    expect(mockRefetch).toHaveBeenCalled(); // Re-scan was required
  });

  it('manages error state on dispatch failure', async () => {
    const errorResult = { success: false, message: '修復に失敗しました', reScanRequired: false };
    mockDispatch.mockResolvedValue(errorResult);

    const { result } = renderHook(() => useDriftRepair());

    // Act
    await act(async () => {
      await result.current.repair('fix-case', 'TestList', 'TestField');
    });

    expect(result.current.lastError).toBe('修復に失敗しました');
    expect(result.current.lastSuccessMessage).toBeNull();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('handles exceptions during the repair process', async () => {
    mockDispatch.mockRejectedValue(new Error('Unexpected Crash'));

    const { result } = renderHook(() => useDriftRepair());

    // Act
    await act(async () => {
      await result.current.repair('fix-case', 'TestList', 'TestField');
    });

    expect(result.current.lastError).toBe('Unexpected Crash');
    expect(result.current.isRepairing).toBe(false);
  });
});
