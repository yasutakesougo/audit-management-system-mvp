/**
 * @fileoverview ISP 計画書ドラフトの型定義
 * @description
 * Phase 5-A:
 *   Phase 1〜4 で蓄積した分析結果・提案・判断を
 *   「ISP 計画書」の制度書式へ再構成するための型。
 *
 * 設計方針:
 *   - 新しい分析ロジックは追加しない（既存出力の書式変換のみ）
 *   - 出力は section 配列で UI 非依存
 *   - 入力は既存型を束ねる薄い shape
 *   - pure function で生成、テスト容易
 *
 * 関連:
 *   - monitoringDailyAnalytics.ts (集計)
 *   - ispRecommendationTypes.ts (提案)
 *   - ispRecommendationDecisionTypes.ts (判断)
 */

import type { GoalProgressSummary } from './goalProgressTypes';
import type { IspRecommendationSummary } from './ispRecommendationTypes';
import type { DecisionSummary, IspRecommendationDecision } from './ispRecommendationDecisionTypes';

// ─── セクション種別 ──────────────────────────────────────

/**
 * ドラフトのセクション種別。
 *
 * | 種別               | 内容                        |
 * |--------------------|-----------------------------|
 * | overview           | 期間概要                     |
 * | monitoring-findings| モニタリング所見               |
 * | goal-assessment    | 目標別評価                    |
 * | decision-summary   | 判断結果まとめ                |
 * | plan-revision      | 計画見直し案                  |
 * | next-actions       | 次期アクション                |
 */
export type IspPlanDraftSectionKind =
  | 'overview'
  | 'monitoring-findings'
  | 'goal-assessment'
  | 'decision-summary'
  | 'plan-revision'
  | 'next-actions';

// ─── セクション ──────────────────────────────────────────

/**
 * ドラフトの1セクション。
 * 所見・提案・結論など、論理的なまとまりごとに分離。
 */
export interface IspPlanDraftSection {
  /** セクション種別 */
  kind: IspPlanDraftSectionKind;
  /** セクションタイトル */
  title: string;
  /** 本文（行単位、Markdown 形式） */
  lines: string[];
}

// ─── ドラフト全体 ────────────────────────────────────────

/**
 * ISP 計画書ドラフト — 1利用者分。
 * セクションごとに分離し、UI 側で柔軟に表示・編集可能。
 */
export interface IspPlanDraft {
  /** セクション群（6セクション順序保証） */
  sections: IspPlanDraftSection[];
}

// ─── 入力型 ──────────────────────────────────────────────

/**
 * buildIspPlanDraft の入力。
 * 既存型の出力を束ねる薄い shape。UI 型には依存しない。
 */
export interface BuildIspPlanDraftInput {
  /** 期間サマリー */
  periodSummary?: {
    from?: string;
    to?: string;
    recordedDays?: number;
    totalDays?: number;
    recordRate?: number;
  };

  /** モニタリング所見（buildMonitoringInsightText の出力） */
  monitoringFindings?: string[];

  /** 目標ごとの進捗判定 */
  goalProgress?: GoalProgressSummary[];

  /** ISP 見直し提案 */
  ispRecommendations?: IspRecommendationSummary;

  /** 判断レコード（SharePoint から復元済み） */
  decisions?: IspRecommendationDecision[];

  /** 判断サマリー（buildDecisionSummary の出力） */
  decisionSummary?: DecisionSummary;

  /** goalId → 表示名マップ */
  goalNames?: Record<string, string>;
}

// ─── セクションタイトル定数 ──────────────────────────────

export const ISP_PLAN_DRAFT_SECTION_TITLES: Record<IspPlanDraftSectionKind, string> = {
  'overview':            '期間概要',
  'monitoring-findings': 'モニタリング所見',
  'goal-assessment':     '目標別評価',
  'decision-summary':    '判断結果まとめ',
  'plan-revision':       '計画見直し案',
  'next-actions':        '次期アクション',
};
