import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableDailyRecordViewModel } from '../components/table/useTableDailyRecordViewModel';

const navigateMock = vi.fn();

vi.mock('@/lib/nav/useCancelToDashboard', () => ({
  useCancelToToday: () => navigateMock,
}));

// Mock repository
const mockSave = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/daily/repositories/repositoryFactory', () => ({
  useDailyRecordRepository: () => ({
    save: mockSave,
  }),
}));

describe('useTableDailyRecordViewModel', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    mockSave.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns expected shape and exposes dependencies for orchestrator', () => {
    const { result } = renderHook(() => useTableDailyRecordViewModel());

    expect(result.current.open).toBe(true);
    expect(result.current.title).toBe('一覧形式ケース記録');
    expect(result.current.backTo).toBe('/today');
    expect(result.current.testId).toBe('daily-table-record-page');

    expect(result.current.repository).toBeDefined();
    expect(result.current.repository.save).toBe(mockSave);
  });

  it('closes screen and navigates back to today when onSuccess is called', async () => {
    const { result } = renderHook(() => useTableDailyRecordViewModel());

    act(() => {
      result.current.onSuccess();
    });

    expect(navigateMock).toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it('closes screen and navigates back to today when onClose is called', async () => {
    const { result } = renderHook(() => useTableDailyRecordViewModel());

    act(() => {
      result.current.onClose();
    });

    expect(navigateMock).toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });
});
