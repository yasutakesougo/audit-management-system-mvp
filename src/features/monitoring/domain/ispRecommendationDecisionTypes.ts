/**
 * @fileoverview ISP 見直し提案に対する「人の判断」を記録する型定義
 * @description
 * Phase 4-C:
 *   提案ロジック（Phase 4-A）が出した IspRecommendation に対して、
 *   担当者がどう判断したかを記録・追跡するための型。
 *
 * 設計方針:
 *   - 「ロジックの提案」と「人の判断」は別レイヤーで管理
 *   - evidence に提案時のスナップショットを保持し、後からロジックが変わっても追跡可能
 *   - 判断記録は不変レコードとして蓄積（上書きせず追記）
 *   - 監査証跡として decision + note + timestamp を保持
 *
 * 関連:
 *   - ispRecommendationTypes.ts (提案型)
 *   - ispRecommendationUtils.ts (提案ロジック)
 *   - docs/architecture/support-pdca-engine.md
 */

import type {
  IspRecommendationLevel,
} from './ispRecommendationTypes';

// ─── 判断ステータス ──────────────────────────────────────

/**
 * 提案に対する判断ステータス。
 *
 * | ステータス | 意味                                  |
 * |------------|---------------------------------------|
 * | pending    | 未判断（デフォルト）                     |
 * | accepted   | 提案を採用（ISP 見直しに反映する）         |
 * | dismissed  | 見送り（根拠を確認した上で対応不要と判断）  |
 * | deferred   | 保留（次回モニタリングで再確認する）        |
 */
export type DecisionStatus = 'pending' | 'accepted' | 'dismissed' | 'deferred';

// ─── 提案スナップショット ────────────────────────────────

/**
 * 判断時点の提案スナップショット。
 * 後からロジックが変更されても、当時の提案内容を正確に追跡できる。
 */
export interface RecommendationSnapshot {
  /** 提案レベル */
  level: IspRecommendationLevel;
  /** 提案理由テキスト */
  reason: string;
  /** 進捗レベル */
  progressLevel: string;
  /** 進捗率 */
  rate: number;
  /** 傾向 */
  trend: string;
  /** 根拠記録件数 */
  matchedRecordCount: number;
  /** 根拠タグ件数 */
  matchedTagCount: number;
}

// ─── 個別判断レコード ────────────────────────────────────

/**
 * 1件の ISP 見直し提案に対する判断記録。
 * 不変レコードとして蓄積する（上書きしない）。
 */
export interface IspRecommendationDecision {
  /** 判断を一意に識別する ID（UUID v4） */
  id: string;
  /** 対象目標 ID */
  goalId: string;
  /** 対象利用者 ID */
  userId: string;
  /** 判断ステータス */
  status: DecisionStatus;
  /** 判断者（アカウント名 = UPN / email） */
  decidedBy: string;
  /** 判断日時（ISO 8601） */
  decidedAt: string;
  /** 判断理由のメモ（任意） */
  note: string;
  /** 判断時点の提案スナップショット */
  snapshot: RecommendationSnapshot;
  /** このレコードが属するモニタリング期間の開始日 (YYYY-MM-DD) */
  monitoringPeriodFrom: string;
  /** このレコードが属するモニタリング期間の終了日 (YYYY-MM-DD) */
  monitoringPeriodTo: string;
}

// ─── 判断サマリー ────────────────────────────────────────

/**
 * 利用者単位の判断状況サマリー。
 * UI 表示用に最新状況を集約する。
 */
export interface DecisionSummary {
  /** 全目標数 */
  totalGoals: number;
  /** 判断済み件数 （accepted + dismissed + deferred） */
  decidedCount: number;
  /** 未判断件数 */
  pendingCount: number;
  /** ステータス別件数 */
  byStatus: Record<DecisionStatus, number>;
  /** 最終更新日時（ISO 8601、判断が1件もなければ null） */
  lastDecidedAt: string | null;
  /** 最終更新者 */
  lastDecidedBy: string | null;
}

// ─── 目標別判断履歴 ──────────────────────────────────────

/**
 * 1目標の判断履歴ビュー。
 * 過去のモニタリング周期を跨いだ提案→判断の時系列を表示する。
 */
export interface GoalDecisionHistory {
  goalId: string;
  goalName?: string;
  /** 時系列順の判断記録（新しい順） */
  decisions: IspRecommendationDecision[];
  /** 最新の判断（存在しない場合は undefined） */
  latestDecision?: IspRecommendationDecision;
}

// ─── 表示定数 ────────────────────────────────────────────

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  pending:   '未判断',
  accepted:  '採用',
  dismissed: '見送り',
  deferred:  '保留',
};

export const DECISION_STATUS_COLORS: Record<DecisionStatus, string> = {
  pending:   '#9ca3af', // gray
  accepted:  '#10b981', // green
  dismissed: '#6b7280', // dark gray
  deferred:  '#f59e0b', // amber
};

export const DECISION_STATUS_CHIP_COLOR: Record<DecisionStatus, 'default' | 'success' | 'warning' | 'info'> = {
  pending:   'default',
  accepted:  'success',
  dismissed: 'default',
  deferred:  'warning',
};
