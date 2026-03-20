/**
 * useScheduleOpsSummary — domain関数の Memo 化・Selectors
 *
 * 責務:
 * - 取得したデータに対してフィルタリングとサマリー計算を行う
 * - computeOpsSummary, computeWeeklySummary, filterOpsItems を連携
 * - Phase 3-A: computeWeeklyLoadScores で負荷スコアを算出
 * - Phase 3-B: suggestBestLeaveDays で年休推奨日を提示
 */

import { useMemo } from 'react';

import {
  type DaySummaryEntry,
  DEFAULT_OPS_CAPACITY,
  type OpsCapacity,
  type OpsFilterState,
  type OpsSummary,
  computeOpsSummary,
  computeWeeklySummary,
  filterOpsItems,
} from '../domain/scheduleOps';
import type { DayLoadScore, HighLoadWarning, LeaveSuggestion } from '../domain/scheduleOpsLoadScore';
import { computeHighLoadWarnings, computeWeeklyLoadScores, suggestBestLeaveDays } from '../domain/scheduleOpsLoadScore';
import type { ScheduleOpsItem } from '../domain/scheduleOpsSchema';

export type ScheduleOpsSummaryReturn = {
  filteredItems: ScheduleOpsItem[];
  dailySummary: OpsSummary;
  weeklySummary: DaySummaryEntry[];
  weeklyLoadScores: DayLoadScore[];
  leaveSuggestions: LeaveSuggestion[];
  highLoadWarnings: HighLoadWarning[];
};

export const useScheduleOpsSummary = (
  rawItems: readonly ScheduleOpsItem[],
  filter: OpsFilterState,
  weekDates: readonly string[], // YYYY-MM-DD
  capacity: OpsCapacity = DEFAULT_OPS_CAPACITY,
): ScheduleOpsSummaryReturn => {
  // 1. Filtered UI Items
  const filteredItems = useMemo(
    () => filterOpsItems(rawItems, filter),
    [rawItems, filter]
  );

  // 2. Daily Summary (Calculated from *all* raw daily items, regardless of filter)
  const dailySummary = useMemo(
    () => computeOpsSummary(rawItems, capacity),
    [rawItems, capacity]
  );

  // 3. Weekly Summary (if weekDates are provided)
  const weeklySummary = useMemo(
    () => computeWeeklySummary(rawItems, weekDates, capacity),
    [rawItems, weekDates, capacity]
  );

  // 4. Weekly Load Scores (Phase 3-A: 負荷スコアと年休可否判定)
  const weeklyLoadScores = useMemo(
    () => computeWeeklyLoadScores(weeklySummary),
    [weeklySummary]
  );

  // 5. Leave Suggestions (Phase 3-B: 年休推奨日 + Phase 3-C: 推奨理由)
  const leaveSuggestions = useMemo(
    () => suggestBestLeaveDays(weeklyLoadScores, 3, weeklySummary),
    [weeklyLoadScores, weeklySummary]
  );

  // 6. High Load Warnings (Phase 4-A-1: 高負荷日警告)
  const highLoadWarnings = useMemo(
    () => computeHighLoadWarnings(weeklyLoadScores, weeklySummary),
    [weeklyLoadScores, weeklySummary]
  );

  return { filteredItems, dailySummary, weeklySummary, weeklyLoadScores, leaveSuggestions, highLoadWarnings };
};

