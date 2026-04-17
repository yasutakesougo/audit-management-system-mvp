import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodayActionQueue } from '../useTodayActionQueue';
import { useTodayQueueTelemetryStore } from '../../telemetry/todayQueueTelemetryStore';
import type { ActionSuggestion } from '@/features/action-engine/domain/types';
import type { RawActionSource } from '../../domain/models/queue.types';

vi.mock('@/features/action-engine/telemetry/useSuggestionVisibilityTelemetry', () => ({
  useSuggestionVisibilityTelemetry: () => {},
}));

const assessmentStaleSuggestion: ActionSuggestion = {
  id: 'assessment-stale-user-001-1711000000000',
  stableId: 'assessment-stale:user-001:2026-W12',
  type: 'assessment_update',
  priority: 'P2',
  targetUserId: 'user-001',
  title: 'アセスメント更新が停滞しています',
  reason: 'しばらく更新がありません。',
  evidence: {
    metric: 'アセスメント最終更新',
    currentValue: '21日',
    threshold: '14日超',
    period: '直近30日',
  },
  cta: {
    label: 'アセスメントを確認',
    route: '/assessment',
  },
  createdAt: '2026-03-21T09:00:00Z',
  ruleId: 'assessment-stale',
};

/** テスト用の例外アクションソース */
function buildTestExceptionActions(now: Date): RawActionSource[] {
  const tMinus1H = new Date(now.getTime() - 60 * 60 * 1000);
  const tPlus30M = new Date(now.getTime() + 30 * 60 * 1000);
  return [
    {
      id: 'exc-incident-1',
      sourceType: 'incident',
      title: '転倒インシデント未確認',
      targetTime: tMinus1H,
      slaMinutes: 15,
      isCompleted: false,
      payload: { incidentId: 'INC-111' },
    },
    {
      id: 'exc-vital-2',
      sourceType: 'vital_alert',
      title: '血圧異常検知',
      targetTime: new Date(now.getTime() - 5 * 60 * 1000),
      slaMinutes: 0,
      isCompleted: false,
      payload: { vitalId: 'VIT-444' },
    },
    {
      id: 'exc-schedule-3',
      sourceType: 'schedule',
      title: '入浴介助',
      targetTime: tPlus30M,
      slaMinutes: 30,
      isCompleted: false,
      assignedStaffId: 'staff-a',
      payload: { scheduleId: 'SCH-333' },
    },
  ];
}

describe('useTodayActionQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exceptionActions 経由で actionQueue が生成される', () => {
    const now = new Date('2026-03-18T10:00:00Z');
    const { result } = renderHook(() =>
      useTodayActionQueue({ exceptionActions: buildTestExceptionActions(now) }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.actionQueue.length).toBeGreaterThan(0);

    // P0の vital_alert が先頭に来ているか確認
    expect(result.current.actionQueue[0]?.actionType).toBe('ACKNOWLEDGE');
    expect(result.current.actionQueue[0]?.priority).toBe('P0');
  });

  it('exceptionActions が空なら actionQueue も空', () => {
    const { result } = renderHook(() =>
      useTodayActionQueue({ exceptionActions: [] }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.actionQueue).toHaveLength(0);
  });

  it('1分経過すると now が更新され、オブジェクトが再生成される', () => {
    const now = new Date('2026-03-18T10:00:00Z');
    const { result } = renderHook(() =>
      useTodayActionQueue({
        pollingIntervalMs: 60000,
        exceptionActions: buildTestExceptionActions(now),
      }),
    );

    const initialQueue = result.current.actionQueue;

    // 60秒進める
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    const newQueue = result.current.actionQueue;

    // 再計算が走っているためオブジェクト参照が異なるはず
    expect(newQueue).not.toBe(initialQueue);
  });

  it('assessment-stale は週初（月曜）では Today に表示しない', () => {
    vi.setSystemTime(new Date('2026-03-23T10:00:00Z')); // Monday
    const { result } = renderHook(() =>
      useTodayActionQueue({ correctiveActions: [assessmentStaleSuggestion] }),
    );

    const exists = result.current.actionQueue.some(
      (item) => item.id === `corrective:${assessmentStaleSuggestion.stableId}`,
    );
    expect(exists).toBe(false);
  });

  it('assessment-stale は平日中盤（水曜）では Today に表示する', () => {
    vi.setSystemTime(new Date('2026-03-25T10:00:00Z')); // Wednesday
    const { result } = renderHook(() =>
      useTodayActionQueue({ correctiveActions: [assessmentStaleSuggestion] }),
    );

    const exists = result.current.actionQueue.some(
      (item) => item.id === `corrective:${assessmentStaleSuggestion.stableId}`,
    );
    expect(exists).toBe(true);
  });

  describe('Telemetry Tracking', () => {
    beforeEach(() => {
      useTodayQueueTelemetryStore.setState({ samples: [] });
    });

    it('queue 確定時に sample を1件 push する', () => {
      const now = new Date('2026-03-18T10:00:00Z');
      renderHook(() =>
        useTodayActionQueue({ exceptionActions: buildTestExceptionActions(now) }),
      );

      const samples = useTodayQueueTelemetryStore.getState().samples;
      expect(samples).toHaveLength(1);

      const latest = samples[0];
      expect(latest.queueSize).toBeGreaterThan(0);
      expect(latest.timestamp).toBeGreaterThan(0);
    });

    it('同一 queue 再レンダーで重複 push しない', () => {
      const now = new Date('2026-03-18T10:00:00Z');
      const { rerender } = renderHook(() =>
        useTodayActionQueue({ exceptionActions: buildTestExceptionActions(now) }),
      );

      const stateBeforeRerender = useTodayQueueTelemetryStore.getState();
      expect(stateBeforeRerender.samples).toHaveLength(1);

      // 無関係な再レンダーを強制
      rerender();

      // 同じ要素で再レンダーされた場合でもシグネチャが変わらないため増えない
      const stateAfterRerender = useTodayQueueTelemetryStore.getState();
      expect(stateAfterRerender.samples).toHaveLength(1);
    });

    it('exceptionActions が空なら telemetry を push しない', () => {
      renderHook(() => useTodayActionQueue({ exceptionActions: [] }));

      const samples = useTodayQueueTelemetryStore.getState().samples;
      expect(samples).toHaveLength(0);
    });
  });
});
