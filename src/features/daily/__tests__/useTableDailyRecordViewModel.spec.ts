import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableDailyRecordViewModel } from '../useTableDailyRecordViewModel';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('useTableDailyRecordViewModel', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns expected shape and closes after save', async () => {
    vi.useFakeTimers();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { result } = renderHook(() => useTableDailyRecordViewModel());

    expect(result.current.open).toBe(true);
    expect(result.current.title).toBe('一覧形式ケース記録');
    expect(result.current.backTo).toBe('/dashboard');
    expect(result.current.testId).toBe('daily-table-record-page');

    const records = [
      {
        userId: 'U001',
        userName: '山田太郎',
        recordDate: '2026-02-07',
        activities: {
          am: '朝の活動',
          pm: '午後の活動',
        },
        lunchIntake: 'full' as const,
        problemBehaviors: [],
        notes: '特になし',
        submittedAt: new Date().toISOString(),
      },
    ];

    await act(async () => {
      const savePromise = result.current.onSave(records);
      await vi.advanceTimersByTimeAsync(800);
      await savePromise;
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    expect(result.current.open).toBe(false);

    alertSpy.mockRestore();
  });
});
