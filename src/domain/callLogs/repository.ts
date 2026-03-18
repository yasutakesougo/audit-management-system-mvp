/**
 * CallLog Repository (Port) 定義
 *
 * DI の境界。UI / Hook 層はこの型にのみ依存する。
 * 具体実装は features/callLogs/data/ に置く。
 */

import type { CallLog, CallLogStatus, CreateCallLogInput } from './schema';

export type ListCallLogsOptions = {
  /** 対応状況でフィルタ */
  status?: CallLogStatus;
  /** 担当者名でフィルタ */
  targetStaffName?: string;
};

export interface CallLogRepository {
  /** ログ一覧を取得する */
  list(options?: ListCallLogsOptions): Promise<CallLog[]>;

  /** 新規ログを作成する */
  create(input: CreateCallLogInput, receivedByName: string): Promise<CallLog>;

  /** 対応状況を更新する */
  updateStatus(id: string, status: CallLogStatus): Promise<void>;
}
