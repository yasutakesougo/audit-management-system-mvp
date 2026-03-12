/**
 * useNextAction — Scene-Based NextAction (#852)
 *
 * 「いま何時か」ではなく「いまどの業務場面にいるか」で NextAction を決定。
 *
 * 時計ベース (旧):
 *   nowMinutes() - itemTime > 0 → skip → 遅延タスクが消える
 *
 * 場面ベース (新):
 *   active > overdue > pending の優先度で NextAction を選択。
 *   遅延タスクは消えずに残り、urgency=high で強調表示。
 *
 * ナビゲーション型 UI:
 *   Start/Done ボタンを撤去し、opsStep に基づく遷移先へのリンクに特化。
 *   完了判定は対象ページでの記録保存時にシステムが自動判定する。
 *
 * @see #852
 */
import { OPS_FLOW_ORDER } from '@/features/dashboard/selectors/useScheduleLanes';
import { toLocalDateISO } from '@/utils/getNow';
import { useMemo } from 'react';
import {
    deriveSceneState,
    nowMinutes,
    parseTimeToMinutes,
    selectNextScene,
    type SceneEntryWithState,
    type SceneState,
} from '../domain/deriveCurrentScene';
import {
    buildProgressKey,
    buildStableEventId,
    useNextActionProgress,
} from './useNextActionProgress';

/**
 * Structural lane item type — accepted by useNextAction.
 * Both dashboard ScheduleItem and TodayScheduleLane satisfy this shape.
 */
type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  location?: string;
  owner?: string;
  opsStep?: string;
};

export type ScheduleLaneCategory = 'User' | 'Staff' | 'Org';

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

/**
 * Scene-based urgency: overdue items are always high urgency,
 * active items use time-based urgency, pending items use time-based.
 */
function deriveSceneUrgency(sceneState: SceneState, minutesUntil: number): Urgency {
  if (sceneState === 'overdue') return 'high';
  return deriveUrgency(minutesUntil);
}

export type NextActionWithProgress = {
  item: NextActionItem | null;
  urgency: Urgency;
  /** Scene state from scene-based logic (#852) */
  sceneState: SceneState | null;
  /** Which lane the selected item came from (for deep-link to /schedules) */
  sourceLane: ScheduleLaneCategory | null;
};

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
  urgency: Urgency;
  sceneState: SceneState;
};

export type NextActionViewModel = NextActionViewModelEmpty | NextActionViewModelActive;

function formatMinutes(m: number): string {
  const abs = Math.abs(m);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours > 0 && mins > 0) return `${hours}時間${mins}分`;
  if (hours > 0) return `${hours}時間`;
  return `${mins}分`;
}

export function buildNextActionViewModel(
  input: NextActionWithProgress,
): NextActionViewModel {
  if (!input.item) return { kind: 'empty' };

  // Scene-based label: overdue items show soft wording, others show "あと X分"
  const minutesUntilLabel = input.sceneState === 'overdue'
    ? `予定時刻を${formatMinutes(Math.abs(input.item.minutesUntil))}過ぎています`
    : `あと ${formatMinutes(input.item.minutesUntil)}`;

  return {
    kind: 'active',
    time: input.item.time,
    title: input.item.title,
    owner: input.item.owner ?? null,
    minutesUntilLabel,
    urgency: input.urgency,
    sceneState: input.sceneState ?? 'pending',
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

  // Build scene entries and select via scene-based logic (#852)
  const sceneResult = useMemo<{ selected: SceneEntryWithState | null; minutesUntil: number; sourceLane: ScheduleLaneCategory | null }>(() => {
    const current = nowMinutes();

    const taggedItems: (ScheduleItem & { _lane: ScheduleLaneCategory })[] = [
      ...lanes.userLane.map(i => ({ ...i, _lane: 'User' as const })),
      ...lanes.staffLane.map(i => ({ ...i, _lane: 'Staff' as const })),
      ...lanes.organizationLane.map(i => ({ ...i, _lane: 'Org' as const })),
    ];

    // Build scene entries with state for each item
    const entries: (SceneEntryWithState & { _lane: ScheduleLaneCategory })[] = taggedItems.map(item => {
      const eventId = buildStableEventId(item.id, item.time, item.title);
      const key = buildProgressKey(effectiveDateKey, eventId);
      const scheduledMinutes = parseTimeToMinutes(item.time);
      const progress = progressStore.getProgress(key);

      return {
        item,
        _lane: item._lane,
        progressKey: key,
        progress,
        scheduledMinutes,
        sceneState: deriveSceneState(progress, scheduledMinutes, current),
      };
    });

    // Tie-break within same scheduledMinutes: opsStep items by flow order
    const sortedEntries = entries.sort((a, b) => {
      const timeDiff = a.scheduledMinutes - b.scheduledMinutes;
      if (timeDiff !== 0) return timeDiff;
      const orderA = a.item.opsStep != null ? (OPS_FLOW_ORDER[a.item.opsStep as keyof typeof OPS_FLOW_ORDER] ?? 99) : 99;
      const orderB = b.item.opsStep != null ? (OPS_FLOW_ORDER[b.item.opsStep as keyof typeof OPS_FLOW_ORDER] ?? 99) : 99;
      return orderA - orderB;
    });

    const selected = selectNextScene(sortedEntries);
    const selectedWithLane = selected
      ? sortedEntries.find(e => e === selected) ?? null
      : null;
    const minutesUntil = selected
      ? selected.scheduledMinutes - current
      : 0;

    return { selected, minutesUntil, sourceLane: selectedWithLane?._lane ?? null };
  }, [lanes, effectiveDateKey, progressStore]);

  // Extract the selected item
  const nextItem = useMemo<NextActionItem | null>(() => {
    if (!sceneResult.selected) return null;
    const { item } = sceneResult.selected;
    return {
      ...item,
      minutesUntil: sceneResult.minutesUntil,
    };
  }, [sceneResult]);

  // Scene state for the selected item
  const sceneState = sceneResult.selected?.sceneState ?? null;

  // Scene-based urgency (#852): overdue items are always high priority
  const urgency: Urgency = nextItem && sceneState
    ? deriveSceneUrgency(sceneState, nextItem.minutesUntil)
    : 'low';

  return {
    item: nextItem,
    urgency,
    sceneState,
    sourceLane: sceneResult.sourceLane,
  };
}
