// ---------------------------------------------------------------------------
// useTimeFlowState – 軽量 safety‐net テスト (3 tests)
// ---------------------------------------------------------------------------
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useTimeFlowState } from '../useTimeFlowState';

// Router wrapper（useNavigate / useSearchParams を使うため）
function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useTimeFlowState (safety net)', () => {
  // -----------------------------------------------------------------------
  // Test 1: recordKey がユーザー×日付の組み合わせで一意に決まる
  // -----------------------------------------------------------------------
  it('recordKey changes when user or date changes', () => {
    const { result } = renderHook(() => useTimeFlowState(), { wrapper });

    // 初期状態: ユーザー未選択 → recordKey は null
    expect(result.current.selectedUser).toBe('');

    // ユーザー選択
    act(() => {
      result.current.handleUserSelect('001');
    });
    const key1 = `${result.current.selectedUser}-${result.current.selectedDate}`;
    expect(result.current.selectedUser).toBe('001');

    // 日付変更 → recordKey が変わる
    act(() => {
      result.current.setSelectedDate('2026-04-01');
    });
    const key2 = `${result.current.selectedUser}-${result.current.selectedDate}`;
    expect(key2).not.toBe(key1);

    // ユーザー変更 → recordKey が変わる
    act(() => {
      result.current.handleUserSelect('005');
    });
    const key3 = `${result.current.selectedUser}-${result.current.selectedDate}`;
    expect(key3).not.toBe(key2);
    expect(key3).not.toBe(key1);
  });

  // -----------------------------------------------------------------------
  // Test 2: handleUserSelect が activeTab='input' にリセットし、
  //         selectionClearedNotice を false にする
  // -----------------------------------------------------------------------
  it('handleUserSelect resets activeTab to "input" and clears notice', () => {
    const { result } = renderHook(() => useTimeFlowState(), { wrapper });

    // activeTab を 'review' に切り替える
    act(() => {
      result.current.handleTabChange({} as React.SyntheticEvent, 'review');
    });
    expect(result.current.activeTab).toBe('review');

    // ユーザー選択 → activeTab が 'input' にリセットされる
    act(() => {
      result.current.handleUserSelect('001');
    });
    expect(result.current.activeTab).toBe('input');
    expect(result.current.selectionClearedNotice).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Test 3: handleMarkComplete で isComplete が true になる
  // -----------------------------------------------------------------------
  it('handleMarkComplete sets isComplete to true', () => {
    const { result } = renderHook(() => useTimeFlowState(), { wrapper });

    // ユーザー選択 → currentDailyRecord が生成される
    act(() => {
      result.current.handleUserSelect('001');
    });
    expect(result.current.currentDailyRecord).not.toBeNull();
    expect(result.current.isComplete).toBe(false);

    // 完了マーク
    act(() => {
      result.current.handleMarkComplete();
    });
    expect(result.current.isComplete).toBe(true);
    expect(result.current.currentDailyRecord?.status).toBe('完了');
    expect(result.current.currentDailyRecord?.completedAt).toBeTruthy();
  });
});
