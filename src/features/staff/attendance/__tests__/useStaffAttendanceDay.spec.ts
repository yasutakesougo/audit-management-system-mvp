import { result } from '@/shared/result';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffAttendance } from '../types';

// Mock the storage module
const mockListByDate = vi.fn();
vi.mock('../storage', () => ({
  getStaffAttendancePort: () => ({
    listByDate: mockListByDate,
  }),
  getStaffAttendanceStorageKind: () => 'local',
}));

// Import hook AFTER mocks
import { useStaffAttendanceDay } from '../hooks/useStaffAttendanceDay';

const mkAttendance = (staffId: string, status: StaffAttendance['status'] = '出勤'): StaffAttendance => ({
  staffId,
  recordDate: '2026-03-01',
  status,
});

describe('useStaffAttendanceDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns items on successful listByDate', async () => {
    const items = [mkAttendance('S001', '出勤'), mkAttendance('S002', '欠勤')];
    mockListByDate.mockResolvedValueOnce(result.ok(items));

    const { result: hookResult } = renderHook(() => useStaffAttendanceDay('2026-03-01'));

    // Initially loading
    expect(hookResult.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.items).toEqual(items);
    expect(hookResult.current.error).toBeNull();
    expect(hookResult.current.storageKind).toBe('local');
  });

  it('returns classified error on forbidden', async () => {
    mockListByDate.mockResolvedValueOnce(
      result.forbidden('SharePoint にアクセスできません。')
    );

    const { result: hookResult } = renderHook(() => useStaffAttendanceDay('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.items).toEqual([]);
    expect(hookResult.current.error).toBe('SharePoint にアクセスできません。');
  });

  it('returns classified error on unknown failure', async () => {
    mockListByDate.mockResolvedValueOnce(
      result.unknown('予期しないエラー')
    );

    const { result: hookResult } = renderHook(() => useStaffAttendanceDay('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.items).toEqual([]);
    expect(hookResult.current.error).toBeTruthy();
  });

  it('returns empty items when no records exist', async () => {
    mockListByDate.mockResolvedValueOnce(result.ok([]));

    const { result: hookResult } = renderHook(() => useStaffAttendanceDay('2026-03-01'));

    await waitFor(() => {
      expect(hookResult.current.isLoading).toBe(false);
    });

    expect(hookResult.current.items).toEqual([]);
    expect(hookResult.current.error).toBeNull();
  });
});
