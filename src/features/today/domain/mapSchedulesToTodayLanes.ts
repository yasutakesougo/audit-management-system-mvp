/**
 * mapSchedulesToTodayLanes — Pure mapper from real schedule data to TodayScheduleLane
 *
 * Converts MiniSchedule[] (from useSchedulesToday) into TodayScheduleLanes
 * grouped for /today execution context.
 *
 * Design constraints:
 * - Pure function — no React, no side effects
 * - No routing or UI logic
 * - Stable ordering (by start time)
 * - Safe fallback when data is missing
 * - Only today-relevant entries (no multi-day planning)
 *
 * @module features/today/domain/mapSchedulesToTodayLanes
 */

import type { MiniSchedule } from '@/features/schedules/hooks/useSchedulesToday';
import type { TodayScheduleLane, TodayScheduleLanes } from './todayScheduleLane';

/**
 * Convert a MiniSchedule item to a TodayScheduleLane item.
 *
 * Maps the minimal MiniSchedule shape (from useSchedulesToday)
 * to the lane shape expected by useNextAction.
 */
function toTodayLane(item: MiniSchedule): TodayScheduleLane {
  return {
    id: String(item.id),
    time: item.startText ?? '00:00',
    title: item.title ?? '予定',
    // MiniSchedule doesn't carry location/owner/opsStep;
    // these remain undefined (safe for NextAction)
  };
}

/**
 * Sort comparator: by time string (HH:MM), stable.
 */
function byTime(a: TodayScheduleLane, b: TodayScheduleLane): number {
  return a.time.localeCompare(b.time);
}

/**
 * Build TodayScheduleLanes from MiniSchedule[].
 *
 * Current strategy:
 * - All real schedule items go into staffLane (operational focus)
 * - userLane and organizationLane are empty (not available from MiniSchedule)
 * - This matches /today's execution-layer role:
 *   NextAction prioritizes staffLane operations
 *
 * Future: When MiniSchedule carries category info, split into lanes.
 */
export function mapSchedulesToTodayLanes(
  items: MiniSchedule[] | undefined | null,
): TodayScheduleLanes {
  if (!items || items.length === 0) {
    return { userLane: [], staffLane: [], organizationLane: [] };
  }

  // Filter out all-day events — they don't have actionable start times
  const actionable = items.filter((item) => !item.allDay && item.startText !== '—');

  const lanes = actionable.map(toTodayLane).sort(byTime);

  return {
    userLane: [],
    staffLane: lanes,
    organizationLane: [],
  };
}
