import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
    expect(result.current.backTo).toBe('/daily/menu');
    expect(result.current.testId).toBe('daily-table-record-page');

    const payload = {
      date: '2026-02-07',
      reporter: { name: 'テスト', role: 'staff' },
      userRows: [
        {
          userId: 'U001',
          userName: '山田太郎',
          amActivity: '朝の活動',
          pmActivity: '午後の活動',
          lunchAmount: '完食',
          problemBehavior: { yelling: false },
          specialNotes: '特になし',
        },
      ],
    };

    await act(async () => {
      const savePromise = result.current.onSave(payload);
      vi.runAllTimers();
      await savePromise;
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/daily/menu', { replace: true });
    expect(result.current.open).toBe(false);

    alertSpy.mockRestore();
  });
});
