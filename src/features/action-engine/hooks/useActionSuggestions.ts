// ---------------------------------------------------------------------------
// useActionSuggestions — Action Engine React Hook
//
// 分析データから修正提案を生成するための ViewModel レイヤーフック。
// behaviorStore + interventionStore + AnalysisDashboardViewModel から
// CorrectiveActionInput を組み立て、buildCorrectiveActions に渡す。
// ---------------------------------------------------------------------------

import type { ABCRecord } from '@/domain/behavior';
import type { DailyBehaviorStat } from '@/features/analysis/hooks/useBehaviorAnalytics';
import type { HeatmapCell } from '@/features/analysis/hooks/useAnalysisDashboardViewModel';
import { useMemo } from 'react';
import { buildCorrectiveActions } from '../domain/buildCorrectiveActions';
import type {
  ActionSuggestion,
  CorrectiveActionInput,
  ExecutionSummary,
  HeatmapPeak,
  HighIntensityEvent,
  TrendSummary,
} from '../domain/types';

// ---------------------------------------------------------------------------
// Pure helpers for building CorrectiveActionInput from raw data
// ---------------------------------------------------------------------------

/** 高強度閾値 */
const HIGH_INTENSITY_THRESHOLD = 4;

/** DailyBehaviorStat[] からトレンドサマリーを構築 */
export function buildTrendSummary(dailyStats: DailyBehaviorStat[]): TrendSummary {
  if (dailyStats.length === 0) {
    return { recentAvg: 0, previousAvg: 0, changeRate: 1 };
  }

  const midpoint = Math.floor(dailyStats.length / 2);
  const recentHalf = dailyStats.slice(midpoint);
  const olderHalf = dailyStats.slice(0, midpoint);

  const recentAvg =
    recentHalf.length > 0
      ? recentHalf.reduce((sum, d) => sum + d.count, 0) / recentHalf.length
      : 0;
  const previousAvg =
    olderHalf.length > 0
      ? olderHalf.reduce((sum, d) => sum + d.count, 0) / olderHalf.length
      : 0;

  const changeRate = previousAvg > 0 ? recentAvg / previousAvg : 1;

  return {
    recentAvg: Number(recentAvg.toFixed(2)),
    previousAvg: Number(previousAvg.toFixed(2)),
    changeRate: Number(changeRate.toFixed(2)),
  };
}

/** HeatmapCell[] からピーク情報を構築 */
export function buildHeatmapPeak(heatmap: HeatmapCell[]): HeatmapPeak {
  const totalEvents = heatmap.reduce((sum, cell) => sum + cell.count, 0);

  if (totalEvents === 0) {
    return { hour: 0, count: 0, totalEvents: 0, concentration: 0 };
  }

  const peak = heatmap.reduce(
    (max, cell) => (cell.count > max.count ? cell : max),
    heatmap[0]!,
  );

  return {
    hour: peak.hour,
    count: peak.count,
    totalEvents,
    concentration: Number((peak.count / totalEvents).toFixed(2)),
  };
}

/** ABCRecord[] から高強度イベントを抽出 */
export function extractHighIntensityEvents(
  records: ABCRecord[],
  days = 7,
  now = new Date(),
): HighIntensityEvent[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  return records
    .filter((r) => {
      const date = new Date(r.recordedAt);
      return r.intensity >= HIGH_INTENSITY_THRESHOLD && date >= cutoff;
    })
    .map((r) => ({
      id: r.id,
      intensity: r.intensity,
      recordedAt: r.recordedAt,
    }));
}

/** 最終記録日を取得 */
export function getLastRecordDate(records: ABCRecord[]): string | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  return sorted[0]!.recordedAt;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseActionSuggestionsOptions {
  targetUserId: string;
  analysisData: ABCRecord[];
  dailyStats: DailyBehaviorStat[];
  executionStats: { completed: number; triggered: number; skipped: number; total: number };
  heatmap: HeatmapCell[];
  activeBipCount: number;
  analysisDays?: number;
}

export interface UseActionSuggestionsReturn {
  suggestions: ActionSuggestion[];
  hasCritical: boolean;
  counts: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
  };
}

/**
 * 分析結果から修正提案を生成するフック。
 *
 * `buildCorrectiveActions` 純粋関数を useMemo でラップし、
 * 依存データが変わるたびに自動再計算する。
 */
export function useActionSuggestions(
  options: UseActionSuggestionsOptions,
): UseActionSuggestionsReturn {
  const {
    targetUserId,
    analysisData,
    dailyStats,
    executionStats,
    heatmap,
    activeBipCount,
    analysisDays = 30,
  } = options;

  const suggestions = useMemo(() => {
    const trend = buildTrendSummary(dailyStats);
    const heatmapPeak = buildHeatmapPeak(heatmap);
    const highIntensityEvents = extractHighIntensityEvents(analysisData);
    const lastRecordDate = getLastRecordDate(analysisData);

    const completionRate =
      executionStats.total > 0
        ? (executionStats.completed / executionStats.total) * 100
        : 0;

    const execution: ExecutionSummary = {
      ...executionStats,
      completionRate,
    };

    const input: CorrectiveActionInput = {
      targetUserId,
      trend,
      execution,
      highIntensityEvents,
      heatmapPeak,
      activeBipCount,
      totalIncidents: analysisData.length,
      lastRecordDate,
      analysisDays,
    };

    return buildCorrectiveActions(input);
  }, [targetUserId, analysisData, dailyStats, executionStats, heatmap, activeBipCount, analysisDays]);

  const counts = useMemo(() => ({
    total: suggestions.length,
    p0: suggestions.filter((s) => s.priority === 'P0').length,
    p1: suggestions.filter((s) => s.priority === 'P1').length,
    p2: suggestions.filter((s) => s.priority === 'P2').length,
  }), [suggestions]);

  return {
    suggestions,
    hasCritical: counts.p0 > 0,
    counts,
  };
}
