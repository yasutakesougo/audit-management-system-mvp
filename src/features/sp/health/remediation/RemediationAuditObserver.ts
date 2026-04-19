/**
 * RemediationAuditObserver — AuditBus と Repository の橋渡し
 *
 * DriftObserver と同じパターン:
 * - start() で Bus を購読し、全エントリを Repository に委譲する
 * - stop() で購読を解除する
 * - Fail-open: Repository の書き込み失敗は握りつぶす
 *
 * アプリケーション起動時に1回 start() を呼ぶだけで、
 * 以降の全修復判断・実行が自動的に記録される。
 */

import { remediationAuditBus } from './audit';
import type { IRemediationAuditRepository } from './RemediationAuditRepository';
import { auditLog } from '@/lib/debugLogger';

export class RemediationAuditObserver {
  private unsubscribe?: () => void;

  constructor(private repository: IRemediationAuditRepository) {}

  /**
   * 監視を開始する
   */
  start(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = remediationAuditBus.subscribe((entry) => {
      // 非同期で記録（Fail-Open: 呼び出しを待たせずに実行）
      this.repository.logEntry(entry).catch((err) => {
        auditLog.warn(
          'sp:remediation:audit',
          'Failed to persist remediation audit entry (fail-open).',
          { planId: entry.planId, phase: entry.phase, err },
        );
      });
    });

    auditLog.info('sp:remediation:audit', 'RemediationAuditObserver started.');
  }

  /**
   * 監視を停止する
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
      auditLog.info('sp:remediation:audit', 'RemediationAuditObserver stopped.');
    }
  }
}
