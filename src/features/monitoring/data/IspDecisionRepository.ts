/**
 * @fileoverview ISP 判断記録 Repository インターフェース
 * @description
 * ISP 見直し提案に対する判断（採用 / 保留 / 見送り）を永続化するための
 * データアクセス抽象。実装を差し替えるだけで InMemory → SharePoint へ移行可能。
 *
 * 設計方針:
 * - 1判断 = 1レコード（追記型）
 * - 同じ goal に対して再判断した場合は新レコードを追加
 * - 最新レコードが現行判断として扱われる
 * - snapshot は JSON 文字列として保存
 */
import type { IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';

// ────────────────────────────────────────────────────────

/**
 * 判断レコード保存用の入力型
 * id は repository 側で採番する想定のため含まない
 */
export type SaveDecisionInput = Omit<IspRecommendationDecision, 'id'>;

/**
 * 判断レコード取得時のフィルタ
 */
export type DecisionListFilter = {
  /** 対象ユーザー ID */
  userId: string;
  /** モニタリング期間（from / to で範囲指定） */
  monitoringPeriod?: {
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
  };
  /** 特定 goalId のみ取得 */
  goalId?: string;
  /** AbortSignal */
  signal?: AbortSignal;
};

// ────────────────────────────────────────────────────────

/**
 * ISP 判断記録 Repository
 *
 * 実装: InMemoryIspDecisionRepository, SharePointIspDecisionRepository
 */
export interface IspDecisionRepository {
  /**
   * 新しい判断レコードを保存する
   *
   * @param input - 判断レコード（id なし、保存時に採番）
   * @returns 保存されたレコード（id 付き）
   */
  save(input: SaveDecisionInput): Promise<IspRecommendationDecision>;

  /**
   * 条件に合う判断レコードを取得する
   *
   * @param filter - userId 必須、期間 / goalId オプション
   * @returns 判断レコード配列（decidedAt 降順）
   */
  list(filter: DecisionListFilter): Promise<IspRecommendationDecision[]>;
}
