import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodayActionQueue } from '../useTodayActionQueue';

describe('useTodayActionQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期ロード時に actionQueue が生成される', () => {
    const { result } = renderHook(() => useTodayActionQueue());
    
    // 同期モックなので isLoading はすぐに false になる
    expect(result.current.isLoading).toBe(false);
    expect(result.current.actionQueue.length).toBeGreaterThan(0);
    
    // P0の vital_alert が先頭に来ているか確認
    expect(result.current.actionQueue[0]?.actionType).toBe('ACKNOWLEDGE');
    expect(result.current.actionQueue[0]?.priority).toBe('P0');
  });

  it('1分経過すると now が更新され、オブジェクトが再生成される', () => {
    const { result } = renderHook(() =>
      useTodayActionQueue({ pollingIntervalMs: 60000 })
    );

    const initialQueue = result.current.actionQueue;

    // 60秒進める
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    const newQueue = result.current.actionQueue;

    // 再計算が走っているためオブジェクト参照が異なるはず
    // ※今回はUrgencyScoreや値が変わらなくても常に新しい配列が生成される設計
    expect(newQueue).not.toBe(initialQueue);
  });
});
