/**
 * deriveCurrentScene — 場面ベースの NextAction 選択ロジック
 *
 * 「いま何時か」ではなく「いまどの業務場面にいるか」で NextAction を決定する。
 *
 * Clock-Based (旧): nowMinutes() - itemTime > 0 → skip
 * Scene-Based (新): opsStep + progress 状態 → 遅延中 / 待機中 / 実行中 / 完了
 *
 * Pure functions — no React, no side effects, independently testable.
 *
 * @module features/today/domain/deriveCurrentScene
 * @see #852
 */

import type { NextActionProgress } from '../hooks/useNextActionProgress';
import type { TodayScheduleLane } from './todayScheduleLane';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 各アイテムの場面状態 */
export type SceneState = 'done' | 'active' | 'overdue' | 'pending';

/** 場面判定の入力（1 アイテム + 進捗情報） */
export type SceneEntry = {
  item: TodayScheduleLane;
  progressKey: string;
  progress: NextActionProgress | null;
  /** Minutes past midnight for this item's scheduled time */
  scheduledMinutes: number;
};

/** 場面判定の結果 */
export type SceneEntryWithState = SceneEntry & {
  sceneState: SceneState;
};

// ---------------------------------------------------------------------------
// Scene State Derivation
// ---------------------------------------------------------------------------

/**
 * 単一アイテムの場面状態を判定する。
 *
 * 優先度:
 * 1. doneAt 存在 → done
 * 2. startedAt 存在 → active
 * 3. 時刻超過 → overdue
 * 4. それ以外 → pending
 */
export function deriveSceneState(
  progress: NextActionProgress | null,
  scheduledMinutes: number,
  currentMinutes: number,
): SceneState {
  if (progress?.doneAt) return 'done';
  if (progress?.startedAt) return 'active';
  if (currentMinutes >= scheduledMinutes) return 'overdue';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Scene Selection
// ---------------------------------------------------------------------------

/**
 * 場面ベースで「次にやるべきアイテム」を選択する。
 *
 * 選択優先度:
 * 1. active — いま実行中のものがあればそれを表示
 * 2. overdue — 遅れているもの（opsStep 順で最も早いもの）
 * 3. pending — 次にやるべきもの（opsStep 順で最も早いもの）
 * 4. すべて done → null
 *
 * 同一状態内のソート: scheduledMinutes 昇順（時刻順）
 */
export function selectNextScene(
  entries: SceneEntryWithState[],
): SceneEntryWithState | null {
  // 1. active — 作業中のものを最優先
  const activeEntries = entries.filter(e => e.sceneState === 'active');
  if (activeEntries.length > 0) {
    return activeEntries.sort((a, b) => a.scheduledMinutes - b.scheduledMinutes)[0];
  }

  // 2. overdue — 遅れているもの（時刻順で最も早いもの）
  const overdueEntries = entries.filter(e => e.sceneState === 'overdue');
  if (overdueEntries.length > 0) {
    return overdueEntries.sort((a, b) => a.scheduledMinutes - b.scheduledMinutes)[0];
  }

  // 3. pending — 次にやるべきもの（時刻順で最も早いもの）
  const pendingEntries = entries.filter(e => e.sceneState === 'pending');
  if (pendingEntries.length > 0) {
    return pendingEntries.sort((a, b) => a.scheduledMinutes - b.scheduledMinutes)[0];
  }

  // 4. すべて done
  return null;
}

// ---------------------------------------------------------------------------
// Parse Helper (re-export for use by useNextAction)
// ---------------------------------------------------------------------------

/**
 * Parse "HH:MM" into minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Get current time in minutes since midnight.
 */
export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
