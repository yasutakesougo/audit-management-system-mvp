import { result } from '@/shared/result';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffAttendance } from '../types';

// ── Mocks ──

const mockListByDate = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../storage', () => ({
  getStaffAttendancePort: () => ({
    listByDate: mockListByDate,
    upsert: mockUpsert,
    remove: vi.fn(),
    getByKey: vi.fn(),
    listByDateRange: vi.fn(),
    countByDate: vi.fn(),
    finalizeDay: vi.fn(),
    unfinalizeDay: vi.fn(),
    getDayFinalizedState: vi.fn(),
  }),
  getStaffAttendanceStorageKind: () => 'local',
  getStaffAttendanceWriteEnabled: () => true,
}));

// Import AFTER mocks
import { useStaffAttendanceWrite } from '../hooks/useStaffAttendanceWrite';

const mkAtt = (staffId: string, status: StaffAttendance['status'] = '出勤'): StaffAttendance => ({
  staffId,
  recordDate: '2026-03-01',
  status,
});

describe('useStaffAttendanceWrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty success
    mockListByDate.mockResolvedValue(result.ok([]));
    mockUpsert.mockResolvedValue(result.ok(undefined));
  });

  it('initial load: returns items from port.listByDate', async () => {
    const items = [mkAtt('S001', '出勤'), mkAtt('S002', '欠勤')];
    mockListByDate.mockResolvedValue(result.ok(items));

    const { result: hookResult } = renderHook(() => useStaffAttendanceWrite('2026-03-01'));

    expect(hookResult.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.items).toEqual(items);
    expect(hookResult.current.error).toBeNull();
    expect(hookResult.current.storageKind).toBe('local');
  });

  it('upsertOne: calls port.upsert then reloads', async () => {
    const initial = [mkAtt('S001', '出勤')];
    mockListByDate.mockResolvedValue(result.ok(initial));

    const { result: hookResult } = renderHook(() => useStaffAttendanceWrite('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    const updated = [mkAtt('S001', '欠勤')];
    mockListByDate.mockResolvedValue(result.ok(updated));

    await act(async () => {
      await hookResult.current.upsertOne({ ...initial[0], status: '欠勤' });
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 'S001', status: '欠勤' }),
    );
    // After upsert, reload was called (initial load + reload after upsert = at least 2)
    expect(mockListByDate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('saving: true while upsert is in-flight', async () => {
    mockListByDate.mockResolvedValue(result.ok([mkAtt('S001')]));
    mockUpsert.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(result.ok(undefined)), 50)),
    );

    const { result: hookResult } = renderHook(() => useStaffAttendanceWrite('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    // Fire upsert but don't await (to observe saving=true)
    let upsertPromise: Promise<void>;
    act(() => {
      upsertPromise = hookResult.current.upsertOne(mkAtt('S001', '欠勤'));
    });

    // saving should be true during flight
    await waitFor(() => {
      expect(hookResult.current.saving).toBe(true);
    });

    // Wait for completion
    await act(async () => {
      await upsertPromise!;
    });

    await waitFor(() => {
      expect(hookResult.current.saving).toBe(false);
    });
  });

  it('writeEnabled reflects config', async () => {
    mockListByDate.mockResolvedValue(result.ok([]));

    const { result: hookResult } = renderHook(() => useStaffAttendanceWrite('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.writeEnabled).toBe(true);
    expect(hookResult.current.readOnlyReason).toBeNull();
  });

  it('returns error on port.listByDate failure', async () => {
    mockListByDate.mockResolvedValue(
      result.forbidden('アクセス権限がありません。'),
    );

    const { result: hookResult } = renderHook(() => useStaffAttendanceWrite('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.items).toEqual([]);
    expect(hookResult.current.error).toBe('アクセス権限がありません。');
  });

  it('returns error on upsert failure', async () => {
    mockListByDate.mockResolvedValue(result.ok([mkAtt('S001')]));

    const { result: hookResult } = renderHook(() => useStaffAttendanceWrite('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    mockUpsert.mockResolvedValueOnce(result.unknown('保存に失敗しました'));

    await act(async () => {
      await hookResult.current.upsertOne(mkAtt('S001', '欠勤'));
    });

    expect(hookResult.current.error).toBeTruthy();
  });
});
