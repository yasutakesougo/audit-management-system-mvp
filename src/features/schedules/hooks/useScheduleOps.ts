/**
 * useScheduleOps — 運営ビュー全体の統合 Hook (Facade)
 *
 * 責務:
 * - 各種 state hooks を結合し、ページに渡す props の形を整える
 * - select UI state (PageState) -> url filter (FilterState) -> fetch (DataState) -> calc (SummaryState)
 */

import { addDays, endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns';
import { useMemo } from 'react';

import { DEFAULT_OPS_CAPACITY, type OpsCapacity } from '../domain/scheduleOps';
import { toDateKey } from '../lib/dateKey';
import { type DateRange } from './useSchedules';
import { useScheduleOpsData } from './useScheduleOpsData';
import { useScheduleOpsFilter } from './useScheduleOpsFilter';
import { useScheduleOpsPageState } from './useScheduleOpsPageState';
import { useScheduleOpsSummary } from './useScheduleOpsSummary';

export type UseScheduleOpsReturn = ReturnType<typeof useScheduleOpsPageState> &
  ReturnType<typeof useScheduleOpsFilter> &
  ReturnType<typeof useScheduleOpsSummary> & {
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
    staffOptions: readonly { id: string; name: string }[];
  };

export const useScheduleOps = (
  initialDate?: Date,
  capacity: OpsCapacity = DEFAULT_OPS_CAPACITY,
): UseScheduleOpsReturn => {
  // 1. Page State
  const pageState = useScheduleOpsPageState(initialDate);

  // 2. Query Filter State
  const filterState = useScheduleOpsFilter();

  // 3. Compute fetch range based on ViewMode
  const fetchRange = useMemo<DateRange>(() => {
    if (pageState.viewMode === 'daily') {
      return {
        from: startOfDay(pageState.selectedDate).toISOString(),
        to: endOfDay(pageState.selectedDate).toISOString(),
      };
    }
    // weekly or list view fetches the week
    const start = startOfWeek(pageState.selectedDate, { weekStartsOn: 1 }); // 月曜始まり想定
    return {
      from: start.toISOString(),
      to: endOfWeek(start, { weekStartsOn: 1 }).toISOString(),
    };
  }, [pageState.selectedDate, pageState.viewMode]);

  // 4. Data fetch
  const { rawItems, isLoading, error, refetch } = useScheduleOpsData(fetchRange);

  // 5. Build weekly date keys
  const weekDates = useMemo(() => {
    const start = startOfWeek(pageState.selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
  }, [pageState.selectedDate]);

  // 6. Compute summary
  const summaryState = useScheduleOpsSummary(rawItems, filterState.filter, weekDates, capacity);

  // 7. Extract staff options (from distinct items in range)
  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of rawItems) {
      if (item.assignedStaffId && item.assignedStaffName) {
        map.set(item.assignedStaffId, item.assignedStaffName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rawItems]);

  return {
    ...pageState,
    ...filterState,
    ...summaryState,
    isLoading,
    error,
    refetch,
    staffOptions,
  };
};
