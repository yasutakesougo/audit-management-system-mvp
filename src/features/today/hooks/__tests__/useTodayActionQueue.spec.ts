import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodayActionQueue } from '../useTodayActionQueue';
import { useTodayQueueTelemetryStore } from '../../telemetry/todayQueueTelemetryStore';

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

  describe('Telemetry Tracking', () => {
    beforeEach(() => {
      useTodayQueueTelemetryStore.setState({ samples: [] });
    });

    it('queue 確定時に sample を1件 push する', () => {
      renderHook(() => useTodayActionQueue());

      const samples = useTodayQueueTelemetryStore.getState().samples;
      // 最初のデータのフェッチ後に1回記録されるはず
      expect(samples).toHaveLength(1);
      
      const latest = samples[0];
      expect(latest.queueSize).toBeGreaterThan(0);
      expect(latest.timestamp).toBeGreaterThan(0);
    });

    it('同一 queue 再レンダーで重複 push しない', () => {
      const { rerender } = renderHook(() => useTodayActionQueue());

      const stateBeforeRerender = useTodayQueueTelemetryStore.getState();
      expect(stateBeforeRerender.samples).toHaveLength(1);

      // 無関係な再レンダーを強制
      rerender();

      // 同じ要素で再レンダーされた場合でもシグネチャが変わらないため増えない
      const stateAfterRerender = useTodayQueueTelemetryStore.getState();
      expect(stateAfterRerender.samples).toHaveLength(1);
    });

    it('loading 中は push しない', () => {
      renderHook(() => useTodayActionQueue());

      // 今回、モックは同期的にすぐ完了してしまう。
      // ただし Hook の初期ステートとして isLoading = true が挟まる。
      // もし isLoading = true の状態で評価されていれば、samples に空要素等が混ざる可能性がある。
      // しかしガードが入っているため、正常な 1回だけの記録となっていることを確認する
      const samples = useTodayQueueTelemetryStore.getState().samples;
      expect(samples).toHaveLength(1);
    });
  });
});
