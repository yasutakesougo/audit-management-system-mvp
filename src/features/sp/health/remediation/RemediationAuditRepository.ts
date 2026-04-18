/**
 * IRemediationAuditRepository — 修復判断の永続化インターフェース
 *
 * DriftEventRepository と同じ Fail-Open 原則に準拠:
 * 永続化の失敗を業務ロジックの停止原因としてはならない。
 *
 * 実装:
 * - InMemoryRemediationAuditRepository: 開発/テスト/セッション内監査
 * - (将来) SharePointRemediationAuditRepository: SP リストへの永続化
 */

import type { RemediationAuditEntry } from './audit';

// ── Repository Interface ─────────────────────────────────────────────────────

export interface IRemediationAuditRepository {
  /**
   * 監査エントリを記録する
   * Fail-open: 書き込み失敗は呼び出し元に伝播しない
   */
  logEntry(entry: RemediationAuditEntry): Promise<void>;

  /**
   * 監査エントリを取得する
   */
  getEntries(filter?: RemediationAuditFilter): Promise<RemediationAuditEntry[]>;
}

export interface RemediationAuditFilter {
  /** plan ID でフィルタ */
  planId?: string;
  /** phase でフィルタ */
  phase?: RemediationAuditEntry['phase'];
  /** 対象リスト名でフィルタ */
  listKey?: string;
  /** この日時以降のエントリのみ */
  since?: string;
  /** 取得上限 */
  limit?: number;
}

// ── InMemory Implementation ──────────────────────────────────────────────────

/**
 * セッション内の監査ログ永続化
 *
 * 用途:
 * - 開発時のデバッグ
 * - テスト時の assertion
 * - SP リスト未構築環境での暫定運用
 * - UI からの監査ログ表示（セッション内）
 */
export class InMemoryRemediationAuditRepository implements IRemediationAuditRepository {
  private entries: RemediationAuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(options?: { maxEntries?: number }) {
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  async logEntry(entry: RemediationAuditEntry): Promise<void> {
    // 1. 不変性チェック（同一 correlationId かつ同一 phase の重複記録を防止）
    const isDuplicate = this.entries.some(
      e => e.correlationId === entry.correlationId && e.phase === entry.phase
    );
    if (isDuplicate) {
      // eslint-disable-next-line no-console
      console.warn(`[AuditRepo] Duplicate entry ignored for trust: ${entry.correlationId} (${entry.phase})`);
      return;
    }

    this.entries.push({ ...entry });

    // 上限超過時は古いエントリを刈り込む
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  async getEntries(filter?: RemediationAuditFilter): Promise<RemediationAuditEntry[]> {
    let result = this.entries;

    if (filter?.planId) {
      result = result.filter(e => e.planId === filter.planId);
    }
    if (filter?.phase) {
      result = result.filter(e => e.phase === filter.phase);
    }
    if (filter?.listKey) {
      result = result.filter(e => e.listKey === filter.listKey);
    }
    if (filter?.since) {
      const sinceTime = Date.parse(filter.since);
      if (!Number.isNaN(sinceTime)) {
        result = result.filter(e => Date.parse(e.timestamp) >= sinceTime);
      }
    }

    // 新しい順で返す
    result = [...result].reverse();

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /** @internal テスト・デバッグ用 */
  _clear(): void {
    this.entries = [];
  }

  /** @internal テスト・デバッグ用 */
  _size(): number {
    return this.entries.length;
  }
}
