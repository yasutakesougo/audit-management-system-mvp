
/**
 * HybridRemediationAuditRepository — SP と InMemory のハイブリッド永続化
 * 
 * 戦略:
 * 1. 基本は SP リストへの保存を試みる。
 * 2. リストが不在、または検証未完了の間は InMemory にも記録する。
 * 3. 物理的なリスト存在が確認できたら SP への保存に一本化し、InMemory からの昇格（同期）も検討する。
 *    (今回は単純化のため、存在確認後は SP を優先する形にする)
 */

import { auditLog } from '@/lib/debugLogger';
import { checkSingleList, SpFetcher } from '@/sharepoint/spListHealthCheck';
import { findListEntry } from '@/sharepoint/spListRegistry';
import type { RemediationAuditEntry } from './audit';
import { IRemediationAuditRepository, InMemoryRemediationAuditRepository, RemediationAuditFilter } from './RemediationAuditRepository';
import { SharePointRemediationAuditRepository, ISpAuditOperations } from './SharePointRemediationAuditRepository';

export class HybridRemediationAuditRepository implements IRemediationAuditRepository {
  private inMemory: InMemoryRemediationAuditRepository;
  private sp: SharePointRemediationAuditRepository;
  private isSpAvailable: boolean = false;
  private checking: boolean = false;
  private lastCheck: number = 0;

  constructor(
    private spClient: ISpAuditOperations & { spFetch: SpFetcher }
  ) {
    this.inMemory = new InMemoryRemediationAuditRepository({ maxEntries: 500 });
    this.sp = new SharePointRemediationAuditRepository(spClient);
  }

  /**
   * SP リストの存在を物理的に確認する
   */
  private async ensureSpConnection(): Promise<boolean> {
    if (this.isSpAvailable) return true;
    if (this.checking) return false;
    
    // 5分に1回のみ再試行
    if (Date.now() - this.lastCheck < 5 * 60 * 1000) return false;

    this.checking = true;
    this.lastCheck = Date.now();

    try {
      const entry = findListEntry('remediation_audit_log');
      if (!entry) return false;

      const result = await checkSingleList(entry, this.spClient.spFetch);
      if (result.status === 'ok') {
        this.isSpAvailable = true;
        auditLog.info('sp:remediation:audit', 'RemediationAuditLog list found and connected.');
      }
    } catch (err) {
      auditLog.warn('sp:remediation:audit', 'Failed to check RemediationAuditLog presence.', err);
    } finally {
      this.checking = false;
    }

    return this.isSpAvailable;
  }

  async logEntry(entry: RemediationAuditEntry): Promise<void> {
    // 常に InMemory には残す（直近の UI 表示用・デバッグ用）
    await this.inMemory.logEntry(entry);

    // SP が利用可能なら書き込む
    const connected = await this.ensureSpConnection();
    if (connected) {
      await this.sp.logEntry(entry);
    }
  }

  async getEntries(filter?: RemediationAuditFilter): Promise<RemediationAuditEntry[]> {
    const connected = await this.ensureSpConnection();
    
    if (connected) {
      // SP から取得を試みる
      const spEntries = await this.sp.getEntries(filter);
      if (spEntries.length > 0) return spEntries;
    }

    // SP がない、または空なら InMemory から返す
    return this.inMemory.getEntries(filter);
  }
}
