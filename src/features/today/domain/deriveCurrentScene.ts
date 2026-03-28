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

/**
 * Scene-based scoring context.
 * currentMinutes: current time as minutes since midnight.
 * hasOverdueEntries: whether any entry is overdue in the current candidate set.
 * now: wall-clock timestamp for startedAt age calculation (test-injectable).
 */
export type SceneScoringContext = {
  currentMinutes: number;
  hasOverdueEntries: boolean;
  now?: Date;
};

const SCENE_BASE_SCORE: Record<SceneState, number> = {
  done: -9999,
  active: 3000,
  overdue: 2000,
  pending: 1000,
};

const OPS_STEP_ORDER: Record<string, number> = {
  intake: 0,
  temperature: 1,
  amRecord: 2,
  lunchCheck: 3,
  pmRecord: 4,
  discharge: 5,
};

const MAX_OVERDUE_BONUS = 240;
const PENDING_NEAR_WINDOW = 120;
const ACTIVE_STALE_THRESHOLD_MINUTES = 120;
const ACTIVE_STALE_PENALTY = 1400;

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

function getOpsStepBonus(step: string | undefined): number {
  if (!step) return 0;
  const order = OPS_STEP_ORDER[step];
  if (order == null) return 0;
  return (6 - order) * 5;
}

function getElapsedStartedMinutes(
  progress: NextActionProgress | null,
  now: Date,
): number | null {
  const startedAt = progress?.startedAt;
  if (!startedAt) return null;
  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) return null;
  return Math.floor((now.getTime() - startedMs) / 60000);
}

/**
 * スコアで場面優先度を数値化する。
 *
 * 誤判定しやすいケースに対応:
 * 1. stale active が overdue を塞ぐ（長時間 active は減点）
 * 2. overdue 同士の優先度（遅延分を加点）
 * 3. pending 同士の曖昧さ（直近予定を加点）
 * 4. 同時刻の曖昧さ（opsStep で微差をつける）
 */
export function scoreSceneEntry(
  entry: SceneEntryWithState,
  context: SceneScoringContext,
): number {
  const baseScore = SCENE_BASE_SCORE[entry.sceneState];
  if (entry.sceneState === 'done') return baseScore;

  const stepBonus = getOpsStepBonus(entry.item.opsStep);

  if (entry.sceneState === 'overdue') {
    const overdueMinutes = Math.max(0, context.currentMinutes - entry.scheduledMinutes);
    return baseScore + Math.min(overdueMinutes, MAX_OVERDUE_BONUS) + stepBonus;
  }

  if (entry.sceneState === 'pending') {
    const minutesUntil = Math.max(0, entry.scheduledMinutes - context.currentMinutes);
    const proximityBonus = Math.max(0, PENDING_NEAR_WINDOW - minutesUntil);
    return baseScore + proximityBonus + stepBonus;
  }

  // active
  let stalePenalty = 0;
  if (context.hasOverdueEntries) {
    const elapsed = getElapsedStartedMinutes(entry.progress, context.now ?? new Date());
    if (elapsed != null && elapsed > ACTIVE_STALE_THRESHOLD_MINUTES) {
      stalePenalty = ACTIVE_STALE_PENALTY;
    }
  }

  return baseScore + stepBonus - stalePenalty;
}

function compareByOpsStep(
  a: SceneEntryWithState,
  b: SceneEntryWithState,
): number {
  const orderA = a.item.opsStep ? OPS_STEP_ORDER[a.item.opsStep] ?? 99 : 99;
  const orderB = b.item.opsStep ? OPS_STEP_ORDER[b.item.opsStep] ?? 99 : 99;
  return orderA - orderB;
}

/**
 * 場面ベースで「次にやるべきアイテム」を選択する。
 *
 * スコア優先度:
 * - sceneState の基本重み: active > overdue > pending
 * - 状態内加点: overdue 遅延分, pending 直近性
 * - 補正: stale active（長時間 started）は overdue 存在時に減点
 * - 同点時: scheduledMinutes → opsStep → id で安定化
 */
export function selectNextScene(
  entries: SceneEntryWithState[],
  currentMinutes: number,
  now: Date = new Date(),
): SceneEntryWithState | null {
  const actionable = entries.filter(e => e.sceneState !== 'done');
  if (actionable.length === 0) return null;

  const hasOverdueEntries = actionable.some(e => e.sceneState === 'overdue');

  return actionable
    .map(entry => ({
      entry,
      score: scoreSceneEntry(entry, { currentMinutes, hasOverdueEntries, now }),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.entry.scheduledMinutes !== b.entry.scheduledMinutes) {
        return a.entry.scheduledMinutes - b.entry.scheduledMinutes;
      }
      const stepDiff = compareByOpsStep(a.entry, b.entry);
      if (stepDiff !== 0) return stepDiff;
      return a.entry.item.id.localeCompare(b.entry.item.id);
    })[0]?.entry ?? null;
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
