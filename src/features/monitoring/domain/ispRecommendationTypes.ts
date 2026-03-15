/**
 * @fileoverview ISP 見直し提案の型定義
 * @description
 * Phase 4-A:
 *   GoalProgressSummary から ISP 見直し候補を導出するための型。
 *
 * 設計方針:
 *   - 「自動提案」は補助であり、最終決定は人が行う
 *   - ProgressLevel → IspRecommendationLevel への変換は決定論的
 *   - evidence として GoalProgress のスナップショットを保持し監査証跡とする
 *
 * 関連: docs/architecture/support-pdca-engine.md
 */

import type { BehaviorTagCategory } from '../../daily/domain/behaviorTag';
import type { ProgressLevel, ProgressTrend } from './goalProgressTypes';

// ─── 提案レベル ──────────────────────────────────────────

/**
 * ISP 見直し提案レベル。
 *
 * | レベル          | 意味                               |
 * |-----------------|-----------------------------------|
 * | continue        | 現行支援を継続                      |
 * | adjust-support  | 支援方法の見直しを提案               |
 * | revise-goal     | 目標再設定を提案                    |
 * | urgent-review   | 緊急レビューを推奨                   |
 * | pending         | データ不足のため判定保留              |
 */
export type IspRecommendationLevel =
  | 'continue'
  | 'adjust-support'
  | 'revise-goal'
  | 'urgent-review'
  | 'pending';

// ─── 提案 ────────────────────────────────────────────────

/**
 * 1つの目標に対する ISP 見直し提案。
 * GoalProgressSummary から純粋関数で導出される。
 */
export interface IspRecommendation {
  /** 対象目標 ID */
  goalId: string;
  /** 提案レベル */
  level: IspRecommendationLevel;
  /** 日本語の提案理由テキスト */
  reason: string;
  /** 判定根拠（GoalProgress のスナップショット） */
  evidence: IspRecommendationEvidence;
}

/** 判定根拠 */
export interface IspRecommendationEvidence {
  progressLevel: ProgressLevel;
  rate: number;
  trend: ProgressTrend;
  matchedRecordCount: number;
  matchedTagCount: number;
  linkedCategories: BehaviorTagCategory[];
}

// ─── 全体要約 ────────────────────────────────────────────

/**
 * 利用者単位の ISP 見直し提案サマリー。
 * 全目標の提案を集約し、最も深刻なレベルを overallLevel として返す。
 */
export interface IspRecommendationSummary {
  /** 全目標の個別提案 */
  recommendations: IspRecommendation[];
  /** 最も深刻な提案レベル（urgent-review > revise-goal > adjust-support > continue > pending） */
  overallLevel: IspRecommendationLevel;
  /** 提案を含む目標数（pending を除く） */
  actionableCount: number;
  /** 全目標数 */
  totalGoalCount: number;
  /** 集約コメント（所見ドラフトに追記可能な1文） */
  summaryText: string;
}

// ─── 表示定数 ────────────────────────────────────────────

export const ISP_RECOMMENDATION_LABELS: Record<IspRecommendationLevel, string> = {
  continue:       '継続',
  'adjust-support': '支援方法の見直し',
  'revise-goal':    '目標再設定',
  'urgent-review':  '緊急レビュー',
  pending:        '判定保留',
};

export const ISP_RECOMMENDATION_COLORS: Record<IspRecommendationLevel, string> = {
  continue:       '#10b981', // green
  'adjust-support': '#f59e0b', // amber
  'revise-goal':    '#ef4444', // red
  'urgent-review':  '#dc2626', // deep red
  pending:        '#9ca3af', // gray
};

/**
 * 提案レベルの深刻度順（高い方が深刻）。
 * overallLevel の解決に使用。
 */
export const ISP_RECOMMENDATION_SEVERITY: Record<IspRecommendationLevel, number> = {
  pending:        0,
  continue:       1,
  'adjust-support': 2,
  'revise-goal':    3,
  'urgent-review':  4,
};
