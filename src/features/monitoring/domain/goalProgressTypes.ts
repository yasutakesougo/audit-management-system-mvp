/**
 * @fileoverview ISP 目標と行動タグの紐付け・進捗判定の型定義
 * @description
 * Phase 3-A:
 *   GoalItem.domains → BehaviorTagCategory への推論と、
 *   記録データを用いた進捗レベル判定に必要な型を定義する。
 *
 * SSOT:
 *   - GoalDomainId は goalTypes.ts の DOMAINS.id と一致させる
 *   - BehaviorTagCategory は behaviorTag.ts から再エクスポートする
 */

import type { BehaviorTagCategory } from '../../daily/domain/behaviorTag';

// ─── Goal 側の型 ────────────────────────────────────────

/**
 * DOMAINS 定数の id をリテラル型化。
 * goalTypes.ts の DOMAINS 配列と同期させること。
 */
export type GoalDomainId =
  | 'health'
  | 'motor'
  | 'cognitive'
  | 'language'
  | 'social';

/**
 * inferGoalTagLinks の入力用。
 * GoalItem から必要なフィールドだけ抜いた最小形。
 */
export type GoalLike = {
  id: string;
  domains?: string[];
  /** Phase 4: 手動上書きカテゴリ */
  overrideCategories?: string[];
};

// ─── 推論結果 ───────────────────────────────────────────

/** Goal と BehaviorTag カテゴリの紐付け結果 */
export type GoalTagLink = {
  goalId: string;
  /** domains から推論されたカテゴリ一覧 */
  inferredCategories: BehaviorTagCategory[];
  /** 将来の個別タグ指定用（Phase 3-A では空配列） */
  inferredTags: string[];
  /** 推論元の追跡 */
  source: 'domain-inference' | 'manual';
};

// ─── 進捗判定 ───────────────────────────────────────────

export type ProgressTrend = 'improving' | 'stable' | 'declining';

export type ProgressLevel =
  | 'achieved'
  | 'progressing'
  | 'stagnant'
  | 'regressing'
  | 'noData';

/** assessGoalProgress の入力 */
export type GoalProgressInput = {
  goalId: string;
  linkedCategories: BehaviorTagCategory[];
  matchedRecordCount: number;
  matchedTagCount: number;
  totalRecordCount: number;
  trend: ProgressTrend;
};

/** assessGoalProgress の出力 */
export type GoalProgressSummary = {
  goalId: string;
  level: ProgressLevel;
  /** matchedRecordCount / totalRecordCount */
  rate: number;
  trend: ProgressTrend;
  matchedRecordCount: number;
  matchedTagCount: number;
  linkedCategories: BehaviorTagCategory[];
  /** 判定根拠テキスト（所見ドラフト用） */
  note?: string;
  /** Phase 4: 判定の推論元（自動 or 手動） */
  source?: 'domain-inference' | 'manual';
};

// ─── 判定レベルの表示定数 ────────────────────────────────

export const PROGRESS_LEVEL_LABELS: Record<ProgressLevel, string> = {
  achieved:    '達成',
  progressing: '進捗あり',
  stagnant:    '停滞',
  regressing:  '後退',
  noData:      'データなし',
};

export const PROGRESS_LEVEL_COLORS: Record<ProgressLevel, string> = {
  achieved:    '#10b981',
  progressing: '#3b82f6',
  stagnant:    '#f59e0b',
  regressing:  '#ef4444',
  noData:      '#9ca3af',
};
