import { AuditLogEntry, AuditActionStatus } from '@/lib/telemetry/auditLogger';

/**
 * AuditRepository
 * 監査ログの永続化を担うインターフェース。
 */
export interface AuditRepository {
  /**
   * 監査ログを永続化する
   */
  save(entry: AuditLogEntry): Promise<string | undefined>;

  /**
   * 監査ログの解決状態を更新する
   */
  resolve(args: {
    firestoreId: string;
    governanceStatus: AuditActionStatus;
    resolution: {
      resolvedAt: string;
      resolvedBy: string;
      note: string;
    };
  }): Promise<void>;
}
