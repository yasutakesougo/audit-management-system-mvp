/**
 * SharePointRemediationAuditRepository — SP リストへの修復監査ログ永続化
 *
 * DriftEventRepository と同じ原則:
 * - Fail-open: 書き込み失敗は握りつぶす
 * - フィールド名解決: REMEDIATION_AUDIT_CANDIDATES で drift 耐性を持つ
 * - セッション内重複排除: planId + phase の組み合わせで 1 日 1 回
 */

import { findListEntry } from '@/sharepoint/spListRegistry';
import { REMEDIATION_AUDIT_CANDIDATES } from '@/sharepoint/fields/diagnosticsFields';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { auditLog } from '@/lib/debugLogger';
import type { RemediationAuditEntry } from './audit';
import type { IRemediationAuditRepository, RemediationAuditFilter } from './RemediationAuditRepository';

// ── SP Client interface ──────────────────────────────────────────────────────

export interface ISpAuditOperations {
  createItem: (listTitle: string, payload: Record<string, unknown>) => Promise<unknown>;
  getListItemsByTitle: <T>(
    listTitle: string,
    select?: string[],
    filter?: string,
    orderby?: string,
    top?: number,
    signal?: AbortSignal,
  ) => Promise<T[]>;
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
}

// ── Repository ───────────────────────────────────────────────────────────────

type CandidateKey = keyof typeof REMEDIATION_AUDIT_CANDIDATES;

export class SharePointRemediationAuditRepository implements IRemediationAuditRepository {
  private sessionCache = new Set<string>();
  private resolvedFields: Record<string, string | undefined> = {};
  private writeDisabled = false;
  private initPromise: Promise<void> | null = null;

  constructor(private spClient: ISpAuditOperations) {}

  // ── Field resolution ─────────────────────────────────────────────────────

  private rf(key: CandidateKey): string | undefined {
    return this.resolvedFields[key];
  }

  private rfFallback(key: CandidateKey): string {
    return this.resolvedFields[key] || REMEDIATION_AUDIT_CANDIDATES[key][0];
  }

  private async initFields(listTitle: string): Promise<void> {
    if (Object.keys(this.resolvedFields).length > 0) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const fieldSet = await this.spClient.getListFieldInternalNames?.(listTitle);
        if (!fieldSet || fieldSet.size === 0) return;

        const res = resolveInternalNamesDetailed(
          fieldSet,
          REMEDIATION_AUDIT_CANDIDATES as unknown as Record<string, string[]>,
        );
        this.resolvedFields = res.resolved;

        auditLog.debug('sp:remediation:audit', 'SP field resolution complete.', {
          resolvedCount: Object.values(res.resolved).filter(Boolean).length,
          missingCount: res.missing.length,
        });
      } catch (err) {
        auditLog.warn('sp:remediation:audit', 'Field resolution failed.', err);
      }
    })();

    return this.initPromise;
  }

  // ── Resolve list title ───────────────────────────────────────────────────

  private resolveListTitle(): string | undefined {
    const entry = findListEntry('remediation_audit_log');
    if (!entry) {
      auditLog.warn('sp:remediation:audit', 'remediation_audit_log not found in registry.');
      return undefined;
    }
    return entry.resolve();
  }

  // ── Write ────────────────────────────────────────────────────────────────

  async logEntry(entry: RemediationAuditEntry): Promise<void> {
    if (this.writeDisabled) return;

    const dedupeKey = `${entry.planId}:${entry.phase}:${entry.timestamp.split('T')[0]}`;
    if (this.sessionCache.has(dedupeKey)) return;

    try {
      const listTitle = this.resolveListTitle();
      if (!listTitle) return;

      await this.initFields(listTitle);

      const payload: Record<string, unknown> = {
        Title: `${entry.phase}:${entry.planId}`,
        [this.rfFallback('correlationId')]: entry.correlationId,
        [this.rfFallback('planId')]: entry.planId,
        [this.rfFallback('phase')]: entry.phase,
        [this.rfFallback('targetType')]: entry.targetType,
        [this.rfFallback('listKey')]: entry.listKey,
        [this.rfFallback('fieldName')]: entry.fieldName,
        [this.rfFallback('action')]: entry.action,
        [this.rfFallback('risk')]: entry.risk,
        [this.rfFallback('autoExecutable')]: entry.autoExecutable,
        [this.rfFallback('requiresApproval')]: entry.requiresApproval,
        [this.rfFallback('reason')]: entry.reason,
        [this.rfFallback('source')]: entry.source,
        [this.rfFallback('timestamp')]: entry.timestamp,
      };

      // Execution fields (only for executed phase)
      if (entry.executionStatus) {
        payload[this.rfFallback('executionStatus')] = entry.executionStatus;
      }
      if (entry.executionError) {
        payload[this.rfFallback('executionError')] = JSON.stringify(entry.executionError);
      }

      await this.spClient.createItem(listTitle, payload);
      this.sessionCache.add(dedupeKey);
    } catch (err) {
      auditLog.error('sp:remediation:audit', 'Failed to log remediation audit entry (fail-open).', err);
    }
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async getEntries(filter?: RemediationAuditFilter, signal?: AbortSignal): Promise<RemediationAuditEntry[]> {
    try {
      const listTitle = this.resolveListTitle();
      if (!listTitle) return [];

      await this.initFields(listTitle);

      const filters: string[] = [];
      const planIdField = this.rf('planId');
      const phaseField = this.rf('phase');
      const listKeyField = this.rf('listKey');
      const timestampField = this.rf('timestamp');

      if (filter?.planId && planIdField) {
        filters.push(`${planIdField} eq '${filter.planId}'`);
      }
      if (filter?.phase && phaseField) {
        filters.push(`${phaseField} eq '${filter.phase}'`);
      }
      if (filter?.listKey && listKeyField) {
        filters.push(`${listKeyField} eq '${filter.listKey}'`);
      }
      if (filter?.since && timestampField) {
        filters.push(`${timestampField} ge datetime'${filter.since}'`);
      }

      const selectFields = [
        'Id', 'Title',
        this.rf('correlationId'),
        this.rf('planId'),
        this.rf('phase'),
        this.rf('targetType'),
        this.rf('listKey'),
        this.rf('fieldName'),
        this.rf('action'),
        this.rf('risk'),
        this.rf('autoExecutable'),
        this.rf('requiresApproval'),
        this.rf('reason'),
        this.rf('source'),
        this.rf('executionStatus'),
        this.rf('executionError'),
        this.rf('timestamp'),
      ].filter((f): f is string => !!f);

      const filterQuery = filters.length > 0 ? filters.join(' and ') : undefined;
      const orderBy = timestampField ? `${timestampField} desc` : 'Id desc';
      const top = filter?.limit ?? 100;

      const items = await this.spClient.getListItemsByTitle<Record<string, unknown>>(
        listTitle,
        selectFields,
        filterQuery,
        orderBy,
        top,
        signal,
      );

      return items.map(item => this.mapItemToEntry(item));
    } catch (err) {
      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) return [];

      auditLog.warn('sp:remediation:audit', 'Failed to fetch remediation audit entries (fail-open).', err);
      return [];
    }
  }

  // ── Mapping ──────────────────────────────────────────────────────────────

  private readField<T = unknown>(row: Record<string, unknown>, key: CandidateKey): T | undefined {
    const rf = this.rf(key);
    const candidates = rf ? [rf, ...REMEDIATION_AUDIT_CANDIDATES[key]] : [...REMEDIATION_AUDIT_CANDIDATES[key]];
    for (const c of candidates) {
      if (Object.prototype.hasOwnProperty.call(row, c)) {
        return row[c] as T;
      }
    }
    return undefined;
  }

  private parseBoolean(raw: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') return raw.toLowerCase() === 'true' || raw === '1';
    if (typeof raw === 'number') return raw !== 0;
    return false;
  }

  private mapItemToEntry(item: Record<string, unknown>): RemediationAuditEntry {
    let executionError: RemediationAuditEntry['executionError'];
    const rawError = this.readField<string>(item, 'executionError');
    if (rawError) {
      try {
        executionError = JSON.parse(rawError);
      } catch {
        executionError = { code: 'UNKNOWN', message: rawError, retryable: false };
      }
    }

    return {
      correlationId: String(this.readField(item, 'correlationId') ?? ''),
      planId: String(this.readField(item, 'planId') ?? ''),
      phase: (this.readField(item, 'phase') as RemediationAuditEntry['phase']) || 'planned',
      targetType: (this.readField(item, 'targetType') as RemediationAuditEntry['targetType']) || 'index',
      listKey: String(this.readField(item, 'listKey') ?? ''),
      fieldName: String(this.readField(item, 'fieldName') ?? ''),
      action: (this.readField(item, 'action') as RemediationAuditEntry['action']) || 'delete_index',
      risk: (this.readField(item, 'risk') as RemediationAuditEntry['risk']) || 'safe',
      autoExecutable: this.parseBoolean(this.readField(item, 'autoExecutable')),
      requiresApproval: this.parseBoolean(this.readField(item, 'requiresApproval')),
      reason: String(this.readField(item, 'reason') ?? ''),
      source: (this.readField(item, 'source') as RemediationAuditEntry['source']) || 'realtime',
      executionStatus: this.readField(item, 'executionStatus') as RemediationAuditEntry['executionStatus'],
      executionError,
      timestamp: String(this.readField(item, 'timestamp') ?? ''),
    };
  }
}
