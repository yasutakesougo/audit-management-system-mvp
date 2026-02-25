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
  const alertSpy = vi.fn();

  beforeEach(() => {
    navigateMock.mockClear();
    vi.useFakeTimers();
    vi.stubGlobal('alert', alertSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns expected shape and closes after save', async () => {
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
      // ✅ CI(Linux/headless) 安定化: タイマー + microtask を確実に消化
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await savePromise;
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    expect(result.current.open).toBe(false);
  });
});
