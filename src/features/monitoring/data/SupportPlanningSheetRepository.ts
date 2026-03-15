/**
 * @fileoverview SupportPlanningSheet Repository インターフェース
 * @description
 * SupportPlanningSheet_Master リストへの CRUD 抽象。
 * 実装を差し替えるだけで InMemory → SharePoint へ移行可能。
 *
 * 設計方針:
 * - IspDecisionRepository と同一パターン
 * - save は追記型（上書きしない）
 * - list は userId 必須、goalId オプション
 */
import type {
  SaveSupportPlanningSheetInput,
  SupportPlanningSheetFilter,
  SupportPlanningSheetRecord,
} from '../domain/supportPlanningSheetTypes';

// ────────────────────────────────────────────────────────

/**
 * SupportPlanningSheet Repository
 *
 * 実装: InMemorySupportPlanningSheetRepository, SharePointSupportPlanningSheetRepository
 */
export interface SupportPlanningSheetRepository {
  /**
   * 新しいレコードを保存する
   *
   * @param input - レコード（id なし、保存時に採番）
   * @returns 保存されたレコード（id 付き）
   */
  save(input: SaveSupportPlanningSheetInput): Promise<SupportPlanningSheetRecord>;

  /**
   * 条件に合うレコードを取得する
   *
   * @param filter - userId 必須、goalId オプション
   * @returns レコード配列（decisionAt 降順）
   */
  list(filter: SupportPlanningSheetFilter): Promise<SupportPlanningSheetRecord[]>;
}
