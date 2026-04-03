import { DriftEvent, DriftResolutionType, DriftType, getDriftEventDedupeKey } from '../domain/driftLogic';
import { IDriftEventRepository } from '../domain/DriftEventRepository';
import { findListEntry } from '@/sharepoint/spListRegistry';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';
import { DRIFT_LOG_CANDIDATES } from '@/sharepoint/fields/diagnosticsFields';
import { resolveInternalNamesDetailed, washRow } from '@/lib/sp/helpers';

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

  private async initializeResolvedFields(listTitle: string): Promise<void> {
    if (Object.keys(this.resolvedFields).length > 0) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        const availableFields = await this.spClient.getSchema?.(listTitle) || [];
        if (availableFields.length === 0) return;

        const res = resolveInternalNamesDetailed(new Set(availableFields), DRIFT_LOG_CANDIDATES as unknown as Record<string, string[]>);
        this.resolvedFields = res.resolved;
      } catch (err) {
        console.error('DriftEventRepository: Initialization failed.', err);
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
        [this.resolvedFields.listName || 'ListName']: event.listName,
        [this.resolvedFields.fieldName || 'FieldName']: event.fieldName,
        [this.resolvedFields.detectedAt || 'DetectedAt']: event.detectedAt,
        [this.resolvedFields.severity || 'Severity']: event.severity,
        [this.resolvedFields.resolutionType || 'ResolutionType']: event.resolutionType,
        [this.resolvedFields.driftType || 'DriftType']: event.driftType || 'unknown',
        [this.resolvedFields.resolved || 'Resolved']: event.resolved
      };

      await this.spClient.createItem(listTitle, washRow(payload));

      this.sessionCache.add(dedupeKey);
    } catch (err) {
      // ✅ Fail-Open: 書き込み失敗は、システム全体の業務に影響を与えないよう握りつぶす。
      console.error('DriftEventRepository: Failed to log drift event. (Fail-Open)', err);
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
      const listNameField = this.resolvedFields.listName || 'ListName';
      const resolvedField = this.resolvedFields.resolved || 'Resolved';

      if (filter?.listName) {
        filters.push(buildEq(listNameField, filter.listName));
      }
      if (filter?.resolved !== undefined) {
        filters.push(buildEq(resolvedField, filter.resolved));
      }

      const items = await this.spClient.getListItemsByTitle<Record<string, unknown>>(listTitle, undefined, joinAnd(filters) || undefined, 'DetectedAt desc', 100);

      return items.map(item => ({
        id: String(item.ID),
        listName: String(item.ListName || item.NameOfList || ''),
        fieldName: String(item.FieldName || item.InternalName || ''),
        detectedAt: String(item.DetectedAt || item.OccurredAt || ''),
        severity: (item.Severity as 'warn' | 'info') || 'info',
        resolutionType: (item.ResolutionType as DriftResolutionType) || 'fuzzy_match',
        driftType: (item.DriftType as DriftType) || 'unknown',
        resolved: !!item.Resolved
      }));

    } catch (err) {
      console.error('DriftEventRepository: Failed to fetch events.', err);
      return [];
    }
  }

  async markResolved(id: string): Promise<void> {
    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) return;

      const listTitle = entry.resolve();
      await this.spClient.updateItemByTitle(listTitle, Number(id), {
        Resolved: true
      });
    } catch (err) {
      console.error('DriftEventRepository: Failed to mark as resolved.', err);
    }
  }
}
