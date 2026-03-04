/**
 * useNextAction — スケジュールから「次のアクション」を算出 + 進捗状態を合成
 *
 * P0: scheduleLanesToday から次予定を導出
 * P1-A: Start/Done 状態を合成、actions を提供
 */
import type { ScheduleItem } from '@/features/dashboard/selectors/useScheduleLanes';
import { OPS_FLOW_ORDER } from '@/features/dashboard/selectors/useScheduleLanes';
import { useMemo } from 'react';
import { toLocalDateISO } from '@/utils/getNow';
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
  opsStep?: string;
  minutesUntil: number;
};

export type Urgency = 'low' | 'medium' | 'high';

/** minutesUntil → urgency 境界値（B層ロジック） */
export function deriveUrgency(minutesUntil: number): Urgency {
  if (minutesUntil <= 10) return 'high';
  if (minutesUntil <= 30) return 'medium';
  return 'low';
}

export type NextActionWithProgress = {
  item: NextActionItem | null;
  progress: NextActionProgress | null;
  progressKey: string | null;
  status: 'idle' | 'started' | 'done';
  urgency: Urgency;
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

// ---------------------------------------------------------------------------
// buildNextActionViewModel — pure view-model builder (tested independently)
// ---------------------------------------------------------------------------

type NextActionViewModelEmpty = { kind: 'empty' };
type NextActionViewModelActive = {
  kind: 'active';
  time: string;
  title: string;
  owner: string | null;
  minutesUntilLabel: string;
  status: 'idle' | 'started' | 'done';
  urgency: Urgency;
  elapsedLabel: string | null;
  onStart: () => void;
  onDone: () => void;
};

export type NextActionViewModel = NextActionViewModelEmpty | NextActionViewModelActive;

function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours > 0 && mins > 0) return `${hours}時間${mins}分`;
  if (hours > 0) return `${hours}時間`;
  return `${mins}分`;
}

export function buildNextActionViewModel(
  input: Omit<NextActionWithProgress, 'viewModel'>,
): NextActionViewModel {
  if (!input.item) return { kind: 'empty' };

  const elapsedLabel =
    input.status === 'started' && input.elapsedMinutes != null
      ? `${formatMinutes(input.elapsedMinutes)}経過`
      : null;

  return {
    kind: 'active',
    time: input.item.time,
    title: input.item.title,
    owner: input.item.owner ?? null,
    minutesUntilLabel: `あと ${formatMinutes(input.item.minutesUntil)}`,
    status: input.status,
    urgency: input.urgency,
    elapsedLabel,
    onStart: input.actions.start,
    onDone: input.actions.done,
  };
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

  const effectiveDateKey = dateKey ?? toLocalDateISO();

  // Select next item, skipping any that are already 'done' in the progress store.
  // This ensures Done → 次予定 auto-advance works correctly.
  const nextItem = useMemo<NextActionItem | null>(() => {
    const current = nowMinutes();

    const allItems = [
      ...lanes.userLane,
      ...lanes.staffLane,
      ...lanes.organizationLane,
    ];

    const upcoming = allItems
      .map(item => {
        const eventId = buildStableEventId(item.id, item.time, item.title);
        const key = buildProgressKey(effectiveDateKey, eventId);
        return {
          ...item,
          minutesUntil: parseTimeToMinutes(item.time) - current,
          _progressKey: key,
        };
      })
      .filter(item => item.minutesUntil > 0)
      // Skip done items — this is the key P1-A fix
      .filter(item => {
        const p = progressStore.getProgress(item._progressKey);
        return !p?.doneAt;
      })
      .sort((a, b) => {
        const timeDiff = a.minutesUntil - b.minutesUntil;
        if (timeDiff !== 0) return timeDiff;
        // Tie-break: opsStep items by flow order, non-opsStep to end
        const orderA = a.opsStep != null ? (OPS_FLOW_ORDER[a.opsStep as keyof typeof OPS_FLOW_ORDER] ?? 99) : 99;
        const orderB = b.opsStep != null ? (OPS_FLOW_ORDER[b.opsStep as keyof typeof OPS_FLOW_ORDER] ?? 99) : 99;
        return orderA - orderB;
      });

    if (upcoming.length === 0) return null;

    // Strip internal field
    const { _progressKey, ...selected } = upcoming[0];
    void _progressKey; // suppress unused lint
    return selected;
  }, [lanes, effectiveDateKey, progressStore]);

  // Build stable key for the selected item
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

  // Urgency: derived from minutesUntil (B層 pure logic)
  const urgency: Urgency = nextItem ? deriveUrgency(nextItem.minutesUntil) : 'low';

  return {
    item: nextItem,
    progress,
    progressKey,
    status,
    urgency,
    elapsedMinutes,
    actions,
  };
}
