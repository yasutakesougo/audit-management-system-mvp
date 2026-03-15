/**
 * @fileoverview 個別支援計画書（ISP）判断記録のドメイン型定義
 * @description
 * Phase 5-B:
 *   SupportPlanningSheet_Master リストに永続化される、
 *   ISP 見直し判断レコードを表現するドメイン型。
 *
 * 設計方針:
 *   - IspRecommendationDecision の判断結果を「計画書向け」に構造化
 *   - 1レコード = 1目標の判断結果（追記型、上書きしない）
 *   - SnapshotJson に判断時点の提案内容を保持
 *   - UserId + GoalId + DecisionAt で論理的な Unique Key
 *   - 監査・国保連・履歴追跡に対応
 *
 * 関連:
 *   - ispRecommendationDecisionTypes.ts (判断型)
 *   - ispPlanDraftTypes.ts (ドラフト型)
 *   - SharePointSupportPlanningSheetRepository.ts (永続化)
 */

import type { DecisionStatus, RecommendationSnapshot } from './ispRecommendationDecisionTypes';
import type { IspRecommendationLevel } from './ispRecommendationTypes';

// ─── レコード型 ───────────────────────────────────────────

/**
 * SupportPlanningSheet_Master リストの1レコード。
 *
 * | フィールド            | 用途                                |
 * |-----------------------|-------------------------------------|
 * | id                    | SP 自動採番 ID                       |
 * | userId                | 利用者 ID（検索キー）                 |
 * | goalId                | 目標 ID（履歴紐付け）                 |
 * | goalLabel             | 目標表示名                           |
 * | decisionStatus        | 採用 / 保留 / 見送り / 未判断          |
 * | decisionNote          | 判断理由メモ                         |
 * | decisionBy            | 判断者 (UPN / email)                 |
 * | decisionAt            | 判断日時 (ISO 8601)                  |
 * | recommendationLevel   | 提案レベル                           |
 * | snapshotJson          | 判断時点のスナップショット (JSON)      |
 */
export interface SupportPlanningSheetRecord {
  /** SharePoint List Item ID (自動採番 UUID) */
  id: string;
  /** 対象利用者 ID */
  userId: string;
  /** 対象目標 ID */
  goalId: string;
  /** 目標の表示名 */
  goalLabel: string;
  /** 判断ステータス */
  decisionStatus: DecisionStatus;
  /** 判断理由メモ */
  decisionNote: string;
  /** 判断者 (UPN / email) */
  decisionBy: string;
  /** 判断日時 (ISO 8601) */
  decisionAt: string;
  /** 提案レベル */
  recommendationLevel: IspRecommendationLevel;
  /** 判断時点の提案スナップショット (JSON 文字列として保存) */
  snapshot: RecommendationSnapshot;
}

// ─── 保存入力型 ────────────────────────────────────────────

/**
 * 保存用の入力型。id は Repository 側で採番するため含まない。
 */
export type SaveSupportPlanningSheetInput = Omit<SupportPlanningSheetRecord, 'id'>;

// ─── フィルタ型 ────────────────────────────────────────────

/**
 * SupportPlanningSheet_Master 取得時のフィルタ。
 */
export interface SupportPlanningSheetFilter {
  /** 対象ユーザー ID（必須） */
  userId: string;
  /** 特定 goalId のみ取得 */
  goalId?: string;
  /** AbortSignal */
  signal?: AbortSignal;
}

// ─── サマリー型 ────────────────────────────────────────────

/**
 * 利用者単位の計画書判断サマリー。
 */
export interface SupportPlanningSheetSummary {
  /** 全レコード数 */
  totalRecords: number;
  /** ステータス別件数 */
  byStatus: Record<DecisionStatus, number>;
  /** 最終更新日時 */
  lastDecisionAt: string | null;
  /** 最終更新者 */
  lastDecisionBy: string | null;
}
