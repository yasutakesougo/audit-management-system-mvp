/**
 * useScheduleOpsSummary — domain関数の Memo 化・Selectors
 *
 * 責務:
 * - 取得したデータに対してフィルタリングとサマリー計算を行う
 * - computeOpsSummary, computeWeeklySummary, filterOpsItems を連携
 * - Phase 3-A: computeWeeklyLoadScores で負荷スコアを算出
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
import type { DayLoadScore } from '../domain/scheduleOpsLoadScore';
import { computeWeeklyLoadScores } from '../domain/scheduleOpsLoadScore';
import type { ScheduleOpsItem } from '../domain/scheduleOpsSchema';

export type ScheduleOpsSummaryReturn = {
  filteredItems: ScheduleOpsItem[];
  dailySummary: OpsSummary;
  weeklySummary: DaySummaryEntry[];
  weeklyLoadScores: DayLoadScore[];
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

  return { filteredItems, dailySummary, weeklySummary, weeklyLoadScores };
};

