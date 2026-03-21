/**
 * useWeeklyHighLoadStatus — Today用 高負荷警告ステータス
 *
 * 責務:
 *   1. 今週の weekDates を算出（月〜日、7日分）
 *   2. Schedule Ops データを useScheduleOpsData 経由で取得
 *   3. computeWeeklySummary → computeWeeklyLoadScores → computeHighLoadWarnings
 *   4. buildHighLoadTileViewModel で ViewModel に変換
 *
 * TodayOpsPage はこの hook から HighLoadTileViewModel を受け取るだけ。
 * Todayが集約ロジックを持たないようにするための分離（ADR-002 準拠）。
 *
 * @see useScheduleOps — Schedule Ops ページ用のフル Facade（こちらはそのサブセット）
 * @see buildHighLoadTileViewModel — ViewModel 変換
 */

import { addDays, endOfWeek, startOfWeek } from 'date-fns';
import { useMemo } from 'react';

import { DEFAULT_OPS_CAPACITY } from '@/features/schedules/domain/scheduleOps';
import { computeWeeklySummary } from '@/features/schedules/domain/scheduleOps';
import {
  computeHighLoadWarnings,
  computeWeeklyLoadScores,
} from '@/features/schedules/domain/scheduleOpsLoadScore';
import { toDateKey } from '@/features/schedules/lib/dateKey';
import { useScheduleOpsData } from '@/features/schedules/hooks/useScheduleOpsData';

import {
  buildHighLoadTileViewModel,
  type HighLoadTileViewModel,
} from '../domain/buildHighLoadTileViewModel';

// ── Hook ─────────────────────────────────────────────────────

/**
 * Today ページ用: 今週の高負荷警告を取得し TileViewModel に変換する。
 *
 * @returns HighLoadTileViewModel — visible: false ならタイル非表示
 */
export function useWeeklyHighLoadStatus(): HighLoadTileViewModel {
  // 1. 今週の日付範囲を算出（月曜始まり）
  const today = useMemo(() => new Date(), []);

  const weekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );

  const fetchRange = useMemo(
    () => ({
      from: weekStart.toISOString(),
      to: endOfWeek(weekStart, { weekStartsOn: 1 }).toISOString(),
    }),
    [weekStart],
  );

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i))),
    [weekStart],
  );

  // 2. データ取得（useScheduleOpsData = useSchedules の薄いラッパー）
  const { rawItems, isLoading } = useScheduleOpsData(fetchRange);

  // 3. 集約計算 → ViewModel 変換
  return useMemo(() => {
    // ロード中または空の場合は非表示
    if (isLoading || rawItems.length === 0) {
      return { visible: false } as const;
    }

    const weeklySummary = computeWeeklySummary(rawItems, weekDates, DEFAULT_OPS_CAPACITY);
    const loadScores = computeWeeklyLoadScores(weeklySummary);
    const warnings = computeHighLoadWarnings(loadScores, weeklySummary);

    return buildHighLoadTileViewModel(warnings);
  }, [rawItems, weekDates, isLoading]);
}
