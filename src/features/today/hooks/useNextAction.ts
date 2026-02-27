/**
 * useNextAction — スケジュールから「次のアクション」を算出
 *
 * scheduleLanesToday の全レーンから現在時刻以降の最初の予定を返す。
 * P1 auto-next 実装時にも再利用可能。
 */
import type { ScheduleItem } from '@/features/dashboard/selectors/useScheduleLanes';
import { useMemo } from 'react';

export type NextActionItem = {
  id: string;
  time: string;      // "HH:MM"
  title: string;
  location?: string;
  owner?: string;
  minutesUntil: number;
};

/**
 * Parse "HH:MM" into minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Get current time in minutes since midnight
 */
function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function useNextAction(
  lanes: {
    userLane: ScheduleItem[];
    staffLane: ScheduleItem[];
    organizationLane: ScheduleItem[];
  }
): NextActionItem | null {
  return useMemo(() => {
    const current = nowMinutes();

    const allItems = [
      ...lanes.userLane,
      ...lanes.staffLane,
      ...lanes.organizationLane,
    ];

    const upcoming = allItems
      .map(item => ({
        ...item,
        minutesUntil: parseTimeToMinutes(item.time) - current,
      }))
      .filter(item => item.minutesUntil > 0)
      .sort((a, b) => a.minutesUntil - b.minutesUntil);

    return upcoming[0] ?? null;
  }, [lanes]);
}
