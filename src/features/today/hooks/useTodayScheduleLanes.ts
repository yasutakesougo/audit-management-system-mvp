/**
 * useTodayScheduleLanes — Real-data-backed schedule lanes for /today
 *
 * This hook bridges the gap between:
 * - /schedules (real SharePoint data via useSchedulesToday)
 * - /today (thin execution view model via TodayScheduleLanes)
 *
 * It reuses the existing schedule repository / useSchedulesToday hook,
 * transforming the result through mapSchedulesToTodayLanes.
 *
 * Rules:
 * - Does NOT duplicate SharePoint fetch logic
 * - Does NOT create a second schedule source of truth
 * - Does NOT fetch from TodayOpsPage directly
 * - Exposes only the lane data needed by /today
 *
 * @module features/today/hooks/useTodayScheduleLanes
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */

import { useSchedulesToday } from '@/features/schedules/hooks/useSchedulesToday';
import { useMemo } from 'react';
import { mapSchedulesToTodayLanes } from '../domain/mapSchedulesToTodayLanes';
import type { TodayScheduleLanes } from '../domain/todayScheduleLane';

/** Number of schedule items to fetch for /today context */
const TODAY_SCHEDULE_LIMIT = 10;

export type UseTodayScheduleLanesResult = {
  /** Real-data schedule lanes mapped to /today thin view model */
  lanes: TodayScheduleLanes;
  /** Whether schedule data is currently loading */
  isLoading: boolean;
  /** Fetch error, if any */
  error: Error | null;
  /** Data source indicator (for monitoring/debug) */
  source: 'demo' | 'sharepoint';
  /** Manual refresh for kiosk/background sync */
  refetch: () => void;
};

/**
 * Hook: Provides real-data-backed schedule lanes for /today execution context.
 *
 * Consumes the existing useSchedulesToday hook (which uses ScheduleRepository)
 * and transforms the result into TodayScheduleLanes via a pure mapper.
 *
 * This eliminates the mock-data dependency for /today NextAction.
 */
export function useTodayScheduleLanes(): UseTodayScheduleLanesResult {
  const { data, loading, error, source, refetch } = useSchedulesToday(TODAY_SCHEDULE_LIMIT);

  const lanes = useMemo(
    () => mapSchedulesToTodayLanes(data),
    [data],
  );

  return useMemo(
    () => ({
      lanes,
      isLoading: loading,
      error,
      source,
      refetch,
    }),
    [lanes, loading, error, source, refetch],
  );
}
