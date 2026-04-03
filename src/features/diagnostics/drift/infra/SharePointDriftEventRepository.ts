import { DriftEvent, DriftResolutionType, DriftType, getDriftEventDedupeKey } from '../domain/driftLogic';
import { IDriftEventRepository } from '../domain/DriftEventRepository';
import { findListEntry } from '@/sharepoint/spListRegistry';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';

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
  
  /** 連続エラーによる記録停止フラグとカウンタ */
  private errorCount = 0;
  private circuitOpenUntil = 0;
  private verifiedFields: Set<string> | null = null;

  constructor(private spClient: ISpOperations) {}

  async logEvent(event: DriftEvent): Promise<void> {
    const dedupeKey = getDriftEventDedupeKey(event);

    // 1. 同一セッション内で本日既に記録済みであればスキップ
    if (this.sessionCache.has(dedupeKey)) {
      return;
    }

    // 2. サーキットブレーカー（連続失敗時はスキップ）
    if (this.circuitOpenUntil > Date.now()) {
      return;
    }
    
    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) {
        console.warn('DriftEventRepository: drift_events_log list not found in registry.');
        return;
      }

      const listTitle = entry.resolve();
      
      // 3. フィールド検証 (初回のみ)
      if (!this.verifiedFields) {
        try {
          await this.spClient.getListItemsByTitle(listTitle, ['Id'], undefined, undefined, 1);
          // getListFieldInternalNames が DataProvider にあるはずだが、ここでは createItem 時のエラーで判断するか
          // getListItemsByTitle が成功すればリストは存在する
          this.verifiedFields = new Set(['Title', 'DetectedAt', 'Severity', 'ResolutionType', 'DriftType', 'Resolved', 'ListName', 'FieldName']);
        } catch {
          console.warn('DriftEventRepository: DriftEventsLog list seems missing or inaccessible. Disabling logs for 5 min.');
          this.circuitOpenUntil = Date.now() + 5 * 60 * 1000;
          return;
        }
      }

      const payload: Record<string, unknown> = {
        Title: `${event.listName}:${event.fieldName}`, // デバッグ用キー
        DetectedAt: event.detectedAt,
        Severity: event.severity,
        ResolutionType: event.resolutionType,
        DriftType: event.driftType || 'unknown',
        Resolved: event.resolved
      };

      // 現状の問題となっている ListName / FieldName の動的チェック（擬似フェイルオープン）
      // プロビジョニングが追いついていない環境への配慮
      if (event.listName) payload.ListName = event.listName;
      if (event.fieldName) payload.FieldName = event.fieldName;

      await this.spClient.createItem(listTitle, payload);

      // 成功時はエラーカウンタリセット
      this.errorCount = 0;
      this.sessionCache.add(dedupeKey);
    } catch (err) {
      this.errorCount++;
      // 5回連続失敗で5分間停止 (Circuit Breaker)
      if (this.errorCount >= 5) {
        console.error('DriftEventRepository: Multiple failures detected. Opening circuit for 5 minutes.');
        this.circuitOpenUntil = Date.now() + 5 * 60 * 1000;
      }
      
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
      
      // クエリビルド
      const filters: string[] = [];
      if (filter?.listName) {
        filters.push(buildEq('ListName', filter.listName));
      }
      if (filter?.resolved !== undefined) {
        filters.push(buildEq('Resolved', filter.resolved));
      }

      const items = await this.spClient.getListItemsByTitle<Record<string, unknown>>(listTitle, undefined, joinAnd(filters) || undefined, 'DetectedAt desc', 100);

      return items.map(item => ({
        id: String(item.ID),
        listName: String(item.ListName),
        fieldName: String(item.FieldName),
        detectedAt: String(item.DetectedAt),
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
