import { DriftEvent, DriftResolutionType, DriftType, getDriftEventDedupeKey } from '../domain/driftLogic';
import { IDriftEventRepository } from '../domain/DriftEventRepository';
import { findListEntry } from '@/sharepoint/spListRegistry';
import { buildDateTime, buildEq, buildGe, joinAnd } from '@/sharepoint/query/builders';
import { DRIFT_LOG_CANDIDATES } from '@/sharepoint/fields/diagnosticsFields';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { auditLog } from '@/lib/debugLogger';

/**
 * 依存関係の境界遵守のためのローカルインターフェース
 */
export interface ISpOperations {
  createItem: (listTitle: string, payload: Record<string, unknown>) => Promise<unknown>;
  updateItemByTitle: (listTitle: string, id: number, payload: Record<string, unknown>) => Promise<unknown>;
  getListItemsByTitle: <T>(listTitle: string, select?: string[], filter?: string, orderby?: string, top?: number) => Promise<T[]>;
}

/**
 * SharePointDriftEventRepository — SharePoint リストを使用したドリフト履歴リポジトリ
 * 
 * 原則「Fail-Open」を維持し、書き込み失敗はコンソールログに留める。
 */
export class SharePointDriftEventRepository implements IDriftEventRepository {
  /** 同一セッション内での重複ログ抑制用のキャッシュ ( dedupeKey -> 1 ) */
  private sessionCache = new Set<string>();

  /** 本番リストで使用されている物理内部名のキャッシュ */
  private resolvedFields: Record<string, string | undefined> = {};
  private initializationPromise: Promise<void> | null = null;

  constructor(private spClient: ISpOperations & { 
    getSchema?: (listTitle: string) => Promise<string[]> 
  }) {}

  private rf(key: keyof typeof DRIFT_LOG_CANDIDATES): string {
    return this.resolvedFields[key] || DRIFT_LOG_CANDIDATES[key][0];
  }

  private readRowValue<T = unknown>(
    row: Record<string, unknown>,
    key: keyof typeof DRIFT_LOG_CANDIDATES,
  ): T | undefined {
    const probe = [this.rf(key), ...DRIFT_LOG_CANDIDATES[key]];
    const candidates = Array.from(new Set(probe));
    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(row, candidate)) {
        return row[candidate] as T;
      }
    }
    return undefined;
  }

  private parseResolved(raw: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
  }

  private async initializeResolvedFields(listTitle: string): Promise<void> {
    if (Object.keys(this.resolvedFields).length > 0) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        const availableFields = await this.spClient.getSchema?.(listTitle) || [];
        if (availableFields.length === 0) return;

        const res = resolveInternalNamesDetailed(
          new Set(availableFields),
          DRIFT_LOG_CANDIDATES as unknown as Record<string, string[]>,
        );
        this.resolvedFields = res.resolved;
      } catch (err) {
        auditLog.warn('diagnostics:drift', 'DriftEventRepository initialization failed.', err);
      }
    })();

    return this.initializationPromise;
  }

  async logEvent(event: DriftEvent): Promise<void> {
    const dedupeKey = getDriftEventDedupeKey(event);

    // 1. 同一セッション内で本日既に記録済みであればスキップ
    if (this.sessionCache.has(dedupeKey)) {
      return;
    }

    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) {
        console.warn('DriftEventRepository: drift_events_log list not found in registry.');
        return;
      }

      const listTitle = entry.resolve();
      await this.initializeResolvedFields(listTitle);

      const payload: Record<string, unknown> = {
        Title: `${event.listName}:${event.fieldName}`,
        [this.rf('listName')]: event.listName,
        [this.rf('fieldName')]: event.fieldName,
        [this.rf('detectedAt')]: event.detectedAt,
        [this.rf('severity')]: event.severity,
        [this.rf('resolutionType')]: event.resolutionType,
        [this.rf('driftType')]: event.driftType || 'unknown',
        [this.rf('resolved')]: event.resolved
      };

      await this.spClient.createItem(listTitle, payload);

      this.sessionCache.add(dedupeKey);
    } catch (err) {
      // ✅ Fail-Open: 書き込み失敗は、システム全体の業務に影響を与えないよう握りつぶす。
      auditLog.error('diagnostics:drift', 'DriftEventRepository failed to log drift event (fail-open).', err);
    }
  }

  async getEvents(filter?: {
    listName?: string;
    resolved?: boolean;
    since?: string;
  }): Promise<DriftEvent[]> {
    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) return [];

      const listTitle = entry.resolve();
      await this.initializeResolvedFields(listTitle);
      
      // クエリビルド
      const filters: string[] = [];
      const listNameField = this.rf('listName');
      const resolvedField = this.rf('resolved');
      const detectedAtField = this.rf('detectedAt');

      if (filter?.listName) {
        filters.push(buildEq(listNameField, filter.listName));
      }
      if (filter?.resolved !== undefined) {
        filters.push(buildEq(resolvedField, filter.resolved));
      }
      if (filter?.since) {
        filters.push(buildGe(detectedAtField, buildDateTime(filter.since)));
      }

      const select = Array.from(
        new Set([
          'Id',
          'ID',
          this.rf('listName'),
          this.rf('fieldName'),
          this.rf('detectedAt'),
          this.rf('severity'),
          this.rf('resolutionType'),
          this.rf('driftType'),
          this.rf('resolved'),
        ]),
      );

      const items = await this.spClient.getListItemsByTitle<Record<string, unknown>>(
        listTitle,
        select,
        joinAnd(filters) || undefined,
        `${detectedAtField} desc`,
        100,
      );

      return items.map(item => ({
        id: String(item.Id ?? item.ID ?? ''),
        listName: String(this.readRowValue(item, 'listName') ?? ''),
        fieldName: String(this.readRowValue(item, 'fieldName') ?? ''),
        detectedAt: String(this.readRowValue(item, 'detectedAt') ?? ''),
        severity: (this.readRowValue(item, 'severity') as 'warn' | 'info') || 'info',
        resolutionType: (this.readRowValue(item, 'resolutionType') as DriftResolutionType) || 'fuzzy_match',
        driftType: (this.readRowValue(item, 'driftType') as DriftType) || 'unknown',
        resolved: this.parseResolved(this.readRowValue(item, 'resolved')),
      }));

    } catch (err) {
      auditLog.warn('diagnostics:drift', 'DriftEventRepository failed to fetch events (fail-open).', err);
      return [];
    }
  }

  async markResolved(id: string): Promise<void> {
    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) return;

      const listTitle = entry.resolve();
      await this.initializeResolvedFields(listTitle);
      await this.spClient.updateItemByTitle(listTitle, Number(id), {
        [this.rf('resolved')]: true
      });
    } catch (err) {
      auditLog.warn('diagnostics:drift', 'DriftEventRepository failed to mark event as resolved (fail-open).', err);
    }
  }
}
