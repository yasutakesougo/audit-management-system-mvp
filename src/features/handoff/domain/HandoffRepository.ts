/**
 * HandoffRepository — Port (Domain Interface)
 *
 * 申し送りモジュールのデータアクセス層のインターフェース。
 * UI / Hook 層はこのインターフェースのみに依存し、
 * 具体的な永続化先（localStorage / SharePoint / REST API）を知らない。
 *
 * ADR-1 (daily module) に準拠:
 * - Adapter は Plain Object で実装（class の this バインディング問題を回避）
 * - Store-backed Adapter にシングルトンキャッシュは使わない
 *
 * @see docs/architecture-daily-repository.md — 設計思想の詳細
 */

import type {
    HandoffDayScope,
    HandoffRecord,
    HandoffStatus,
    HandoffTimeFilter,
    NewHandoffInput,
} from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Port: HandoffRepository
// ────────────────────────────────────────────────────────────

/**
 * 申し送りデータアクセスのインターフェース (Port)
 *
 * 全メソッドは Promise を返す（localStorage 実装でも async で統一）。
 * これにより、将来の REST API 移行時に Hook 側の変更がゼロになる。
 */
export interface HandoffRepository {
  /**
   * 指定スコープの申し送り一覧を取得
   *
   * @param dayScope - 'today' | 'yesterday' | 'week'
   * @param timeFilter - 'all' | 'morning' | 'evening'
   * @returns 作成日時降順の HandoffRecord 配列
   */
  getRecords(
    dayScope: HandoffDayScope,
    timeFilter: HandoffTimeFilter,
  ): Promise<HandoffRecord[]>;

  /**
   * 新規申し送りを作成
   *
   * @param input - 作成データ（status は常に '未対応' で作成）
   * @returns 作成された HandoffRecord（id 付き）
   */
  createRecord(input: NewHandoffInput): Promise<HandoffRecord>;

  /**
   * 申し送りのステータスを更新
   *
   * @param id - 対象レコードの ID
   * @param newStatus - 新しいステータス
   * @param dayScope - 更新対象のスコープ（localStorage 実装で必要）
   * @param carryOverDate - 「明日へ持越」時の日付（ISO 形式）
   */
  updateStatus(
    id: number,
    newStatus: HandoffStatus,
    dayScope: HandoffDayScope,
    carryOverDate?: string,
  ): Promise<void>;
}

// ────────────────────────────────────────────────────────────
// Port: HandoffAuditRepository
// ────────────────────────────────────────────────────────────

/**
 * 申し送り監査ログのインターフェース (Port)
 *
 * ステータス変更と新規作成の監査証跡を記録する。
 * fire-and-forget で呼び出されることを前提とする。
 */
export interface HandoffAuditRepository {
  /**
   * ステータス変更を記録
   */
  recordStatusChange(
    handoffId: number,
    oldStatus: string,
    newStatus: string,
    changedBy: string,
    changedByAccount: string,
  ): Promise<void>;

  /**
   * 新規作成を記録
   */
  recordCreation(
    handoffId: number,
    createdBy: string,
    createdByAccount: string,
  ): Promise<void>;
}
