// ---------------------------------------------------------------------------
// RestraintRepository — 身体拘束等記録の永続化インターフェース
//
// Ports & Adapters パターン: Domain 層にインターフェースを定義し、
// Infra 層 (LocalStorage / SharePoint) にアダプタを実装する。
// ---------------------------------------------------------------------------

import type { PhysicalRestraintRecord, RestraintStatus } from './physicalRestraint';

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

/**
 * 身体拘束等記録リポジトリ。
 * 実装は infra/ 層 (LocalStorage, SharePoint, etc.) に置く。
 */
export interface RestraintRepository {
  /** レコードを保存（新規 or 更新） */
  save(record: PhysicalRestraintRecord): Promise<PhysicalRestraintRecord>;

  /** 全レコードを取得（新しい順） */
  getAll(): Promise<PhysicalRestraintRecord[]>;

  /** ユーザー別にレコードを取得 */
  getByUserId(userId: string): Promise<PhysicalRestraintRecord[]>;

  /** ID でレコードを取得 */
  getById(id: string): Promise<PhysicalRestraintRecord | null>;

  /** レコードを削除 */
  delete(id: string): Promise<void>;

  /** ステータスを更新（承認ワークフロー用） */
  updateStatus(
    id: string,
    status: RestraintStatus,
    approvedBy?: string,
  ): Promise<PhysicalRestraintRecord | null>;
}
