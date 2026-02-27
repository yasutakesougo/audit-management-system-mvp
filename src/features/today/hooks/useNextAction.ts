/**
 * useNextAction — スケジュールから「次のアクション」を算出 + 進捗状態を合成
 *
 * P0: scheduleLanesToday から次予定を導出
 * P1-A: Start/Done 状態を合成、actions を提供
 */
import type { ScheduleItem } from '@/features/dashboard/selectors/useScheduleLanes';
import { useMemo } from 'react';
import {
    buildProgressKey,
    buildStableEventId,
    useNextActionProgress,
    type NextActionProgress,
} from './useNextActionProgress';

export type NextActionItem = {
  id: string;
  time: string;      // "HH:MM"
  title: string;
  location?: string;
  owner?: string;
  minutesUntil: number;
};

export type NextActionWithProgress = {
  item: NextActionItem | null;
  progress: NextActionProgress | null;
  progressKey: string | null;
  status: 'idle' | 'started' | 'done';
  elapsedMinutes: number | null;  // minutes since start (null if not started)
  actions: {
    start: () => void;
    done: () => void;
    reset: () => void;
  };
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

/**
 * Calculate elapsed minutes from ISO timestamp to now
 */
function calcElapsedMinutes(isoString: string): number {
  const started = new Date(isoString).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - started) / 60000));
}

export function useNextAction(
  lanes: {
    userLane: ScheduleItem[];
    staffLane: ScheduleItem[];
    organizationLane: ScheduleItem[];
  },
  dateKey?: string,
): NextActionWithProgress {
  const progressStore = useNextActionProgress();

  const effectiveDateKey = dateKey ?? new Date().toISOString().split('T')[0];

  const nextItem = useMemo<NextActionItem | null>(() => {
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

  // Build stable key and get progress
  const progressKey = useMemo(() => {
    if (!nextItem) return null;
    const eventId = buildStableEventId(nextItem.id, nextItem.time, nextItem.title);
    return buildProgressKey(effectiveDateKey, eventId);
  }, [nextItem, effectiveDateKey]);

  const progress = progressKey ? progressStore.getProgress(progressKey) : null;

  // Derive status
  const status: 'idle' | 'started' | 'done' = progress?.doneAt
    ? 'done'
    : progress?.startedAt
      ? 'started'
      : 'idle';

  const elapsedMinutes = progress?.startedAt
    ? calcElapsedMinutes(progress.startedAt)
    : null;

  // Bound actions
  const actions = useMemo(() => ({
    start: () => {
      if (progressKey) progressStore.start(progressKey);
    },
    done: () => {
      if (progressKey) {
        progressStore.done(progressKey);
        // Emit event for auto-next integration (#631)
        window.dispatchEvent(
          new CustomEvent('todayops:nextaction:done', {
            detail: { key: progressKey },
          })
        );
      }
    },
    reset: () => {
      if (progressKey) progressStore.reset(progressKey);
    },
  }), [progressKey, progressStore]);

  return {
    item: nextItem,
    progress,
    progressKey,
    status,
    elapsedMinutes,
    actions,
  };
}
