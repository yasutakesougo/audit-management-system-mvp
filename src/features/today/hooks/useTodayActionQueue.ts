import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ActionCard, RawActionSource } from '../domain/models/queue.types';

const EMPTY_EXCEPTION_ACTIONS: RawActionSource[] = [];
import { buildTodayActionQueue } from '../domain/engine/buildTodayActionQueue';
import { summarizeTodayQueue } from '../telemetry/summarizeTodayQueue';
import { useTodayQueueTelemetryStore } from '../telemetry/todayQueueTelemetryStore';
import { mapSuggestionToActionSource } from '../domain/engine/mapSuggestionToActionSource';
import type { ActionSuggestion, ActionSuggestionState } from '../../action-engine/domain/types';
import { isSuggestionVisible } from '../../action-engine/domain/types';
import { filterSuggestionsByDisplayTiming } from '../../action-engine/domain/suggestionDisplayTiming';
import { useSuggestionVisibilityTelemetry } from '../../action-engine/telemetry/useSuggestionVisibilityTelemetry';

interface UseTodayActionQueueOptions {
  pollingIntervalMs?: number;
  currentStaffId?: string;
  /** Action Engine から注入する修正提案（省略可） */
  correctiveActions?: ActionSuggestion[];
  /** dismiss/snooze 状態マップ（省略可） */
  suggestionStates?: Record<string, ActionSuggestionState>;
  /** Exception Bridge から注入する例外アクション（省略可） */
  exceptionActions?: RawActionSource[];
}

interface UseTodayActionQueueReturn {
  actionQueue: ActionCard[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useTodayActionQueue(
  options: UseTodayActionQueueOptions = {}
): UseTodayActionQueueReturn {
  const {
    pollingIntervalMs = 60000,
    currentStaffId = 'staff-a',
    correctiveActions = [],
    suggestionStates,
  } = options;

  // 1. 状態管理
  const [now, setNow] = useState(new Date());
  const [sources, setSources] = useState<RawActionSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. 時刻のTick（再評価のトリガー）
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, pollingIntervalMs);
    return () => clearInterval(timer);
  }, [pollingIntervalMs]);

  // 3. データソースの初期化
  // 実データは exceptionActions / correctiveActions 経由で外部から注入される。
  // mock 固定データへの fallback は行わない。
  const refresh = useCallback(() => {
    setIsLoading(false);
    setSources([]);
  }, []);

  // 初回マウント時にフェッチ
  useEffect(() => {
    refresh();
  }, [refresh]);

  // corrective_action 提案の visible 遷移を観測して telemetry を送る
  const timedCorrectiveActions = useMemo(
    () => filterSuggestionsByDisplayTiming(correctiveActions, now),
    [correctiveActions, now],
  );

  useSuggestionVisibilityTelemetry({
    suggestions: timedCorrectiveActions,
    states: suggestionStates ?? {},
    sourceScreen: 'today',
    now,
  });

  // 4. Engineへの結合（純粋関数の呼び出し）
  // corrective_action を既存 sources に注入してから Engine に渡す
  const actionQueue = useMemo(() => {
    // 4a. dismiss / snooze 済みの提案を除外
    const visibleActions = timedCorrectiveActions.filter((s) =>
      isSuggestionVisible(suggestionStates?.[s.stableId], now),
    );

    // 4b. ActionSuggestion → RawActionSource に変換
    const correctiveSources = visibleActions.map(mapSuggestionToActionSource);

    // 4c. 既存 sources と corrective sources、および例外 sources を合流させてキュー構築
    const exceptionActions = options.exceptionActions ?? EMPTY_EXCEPTION_ACTIONS;
    const allSources = [...sources, ...correctiveSources, ...exceptionActions];
    if (allSources.length === 0) return [];
    return buildTodayActionQueue(allSources, now, currentStaffId);
  }, [sources, now, currentStaffId, timedCorrectiveActions, suggestionStates, options.exceptionActions]);

  // 5. Telemetry 観測と送信
  const pushSample = useTodayQueueTelemetryStore((s) => s.pushSample);
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    // データがフェッチされていない初期状態はスキップ
    if (sources.length === 0 && actionQueue.length === 0) return;

    // queueの意図的変更を判定する署名を生成
    const signature = JSON.stringify({
      ids: actionQueue.map((x) => x.id),
      priorities: actionQueue.map((x) => x.priority),
      overdue: actionQueue.map((x) => x.isOverdue),
    });

    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;

    const sample = summarizeTodayQueue(actionQueue, Date.now());
    pushSample(sample);
  }, [actionQueue, isLoading, pushSample, sources.length]);

  return useMemo(
    () => ({
      actionQueue,
      isLoading,
      error: null,
      refresh,
    }),
    [actionQueue, isLoading, refresh],
  );
}
