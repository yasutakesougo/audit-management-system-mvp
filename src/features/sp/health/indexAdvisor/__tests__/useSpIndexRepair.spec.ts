import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpIndexRepair } from '../useSpIndexRepair';
import * as executor from '../spIndexRepairExecutor';
import { useSP } from '@/lib/spClient';
import { type IndexFieldSpec } from '../spIndexKnownConfig';
import { type SpIndexedField } from '../spIndexLogic';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../spIndexRepairExecutor', () => ({
  executeRepairAction: vi.fn(),
}));

vi.mock('@/lib/spClient', () => ({
  useSP: vi.fn(),
}));

describe('useSpIndexRepair: Hook Contract', () => {
  const mockSpClient = { updateField: vi.fn() };
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSP).mockReturnValue(mockSpClient as any);
  });

  const additions: IndexFieldSpec[] = [
    { internalName: 'FieldA', displayName: 'Field A', reason: 'R1' },
  ];
  const deletions: SpIndexedField[] = [
    { internalName: 'FieldB', displayName: 'Field B', typeAsString: 'Text', deletionReason: 'R2' },
  ];

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useSpIndexRepair());
    expect(result.current.plan).toBeNull();
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it('should generate plan correctly', () => {
    const { result } = renderHook(() => useSpIndexRepair());
    
    act(() => {
      result.current.generatePlan('ListX', additions, deletions);
    });

    expect(result.current.plan).not.toBeNull();
    expect(result.current.plan?.actions.length).toBe(2);
  });

  it('should execute repair actions sequentially and track progress', async () => {
    const { result } = renderHook(() => useSpIndexRepair());
    
    // Preparation
    act(() => {
      result.current.generatePlan('ListX', additions, deletions);
    });

    // Mocking execution success
    vi.mocked(executor.executeRepairAction).mockImplementation(async (sp, action) => ({
      action,
      status: 'success',
      timestamp: 'now',
    }));

    // Start execution
    let repairPromise: Promise<void>;
    act(() => {
      repairPromise = result.current.executeRepair();
    });

    // Check intermediate state (Executing)
    expect(result.current.isExecuting).toBe(true);
    
    await act(async () => {
      await repairPromise;
    });

    // Check final state
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.results.length).toBe(2);
    expect(result.current.results.every(r => r.status === 'success')).toBe(true);
    expect(executor.executeRepairAction).toHaveBeenCalledTimes(2);
  });

  it('should continue sequential execution even if one action fails (Partial success)', async () => {
    const { result } = renderHook(() => useSpIndexRepair());
    
    act(() => {
      result.current.generatePlan('ListX', additions, deletions);
    });

    // First succeeded, second failed
    vi.mocked(executor.executeRepairAction)
      .mockResolvedValueOnce({ action: {} as any, status: 'success', timestamp: 'now' })
      .mockResolvedValueOnce({ action: {} as any, status: 'error', errorDetail: 'SP Error', timestamp: 'now' });

    await act(async () => {
      await result.current.executeRepair();
    });

    expect(result.current.results.length).toBe(2);
    expect(result.current.results[0].status).toBe('success');
    expect(result.current.results[1].status).toBe('error');
    expect(result.current.results[1].errorDetail).toBe('SP Error');
    expect(result.current.isExecuting).toBe(false);
  });

  it('should reset all states when reset() is called', () => {
    const { result } = renderHook(() => useSpIndexRepair());
    
    act(() => {
      result.current.generatePlan('ListX', additions, deletions);
    });
    expect(result.current.plan).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.plan).toBeNull();
    expect(result.current.results).toEqual([]);
  });
});
