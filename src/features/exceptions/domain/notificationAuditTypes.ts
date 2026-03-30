/**
 * @fileoverview 通知監査ログ (Notification Audit Log) の型定義
 */
import type { EscalationLevel } from './escalationTypes';
import type { NotificationChannel } from './notificationTypes';

/**
 * 送信ステータス
 * sent: 送信成功
 * failed: 送信失敗
 * suppressed: 重複抑制期間につきスキップ
 * skipped: 条件不一致につきスキップ
 */
export type NotificationAuditStatus = 'sent' | 'failed' | 'suppressed' | 'skipped';

/**
 * 通知監査ログ (NotificationAuditLog)
 * 「いつ・誰に・何を・なぜ通知したか」の事実記録。
 */
export interface NotificationAuditLog {
  id: string;               // ログ自体のユニークID
  traceId: string;          // 送信処理のトレースID

  // タイムスタンプ
  createdAt: string;

  // 配送情報
  channel: NotificationChannel;
  status: NotificationAuditStatus;

  // エスカレーションメタデータ
  escalationLevel: EscalationLevel;
  targetRoles: string[];    // 通知対象ロールのリスト

  // 対象利用者情報
  userId: string;
  userName: string;

  // 出典情報
  sourceExceptionId: string;
  sourceExceptionCategory: string;

  // 内容
  title: string;
  message: string;

  // 理由 (Why Escalated)
  reasons: string[];        // 理由コードのリスト

  // メタデータスナップショット
  payloadSnapshot: unknown;
  errorMessage?: string;
}

/**
 * リポジトリのインターフェース
 */
export interface NotificationAuditRepository {
  save(log: NotificationAuditLog): Promise<void>;
  getAll(): Promise<NotificationAuditLog[]>;
  getByExceptionId(exceptionId: string): Promise<NotificationAuditLog[]>;
  clearLegacyLogs(days: number): Promise<number>;
}
