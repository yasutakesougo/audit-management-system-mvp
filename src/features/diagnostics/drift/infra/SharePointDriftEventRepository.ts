import { DriftEvent, DriftResolutionType, DriftType, getDriftEventDedupeKey } from '../domain/driftLogic';
import { IDriftEventRepository } from '../domain/DriftEventRepository';
import { findListEntry } from '@/sharepoint/spListRegistry';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';

/**
 * 依存関係の境界遵守のためのローカルインターフェース
 */
export interface ISpOperations {
  createItem: (listTitle: string, payload: Record<string, unknown>) => Promise<unknown>;
  updateItemByTitle: (listTitle: string, id: number, payload: Record<string, unknown>) => Promise<unknown>;
  getListItemsByTitle: <T>(listTitle: string, select?: string[], filter?: string, orderby?: string, top?: number) => Promise<T[]>;
  getListFieldInternalNames: (listTitle: string) => Promise<string[]>;
}

/**
 * 各環境間の物理列名差異を吸収するための候補定義
 */
export const DRIFT_LOG_CANDIDATES = {
  id: ['Id', 'ID'],
  title: ['Title', 'title'],
  listName: ['ListName', 'List_x0020_Name', 'listName', 'List_Name'],
  fieldName: ['FieldName', 'Field_x0020_Name', 'fieldName', 'Field_Name'],
  detectedAt: ['DetectedAt', 'Detected_x0020_At', 'detectedAt', 'Detected_At'],
  severity: ['Severity', 'Severity0', 'DriftSeverity', 'Severity_x0020_Level', 'severity'],
  resolutionType: ['ResolutionType', 'Resolution_x0020_Type', 'resolutionType', 'ResolutionType0'],
  driftType: ['DriftType', 'driftType', 'DriftType0'],
  resolved: ['Resolved', 'resolved', 'IsResolved', 'Resolved0'],
} as const;

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
  private resolvedFieldsByList = new Map<string, Record<string, string | undefined>>();

  constructor(private spClient: ISpOperations) {}

  private async resolveFields(listTitle: string): Promise<Record<string, string | undefined> | null> {
    const cached = this.resolvedFieldsByList.get(listTitle);
    if (cached) return cached;

    try {
      const raw = await this.spClient.getListFieldInternalNames(listTitle);
      const { resolved } = resolveInternalNamesDetailed(
        new Set(raw),
        DRIFT_LOG_CANDIDATES as unknown as Record<string, string[]>
      );
      const result = resolved as Record<string, string | undefined>;
      this.resolvedFieldsByList.set(listTitle, result);
      return result;
    } catch {
      return null;
    }
  }

  async logEvent(event: DriftEvent): Promise<void> {
    const dedupeKey = getDriftEventDedupeKey(event);

    if (this.sessionCache.has(dedupeKey)) return;
    if (this.circuitOpenUntil > Date.now()) return;
    
    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) return;

      const listTitle = entry.resolve();
      const fields = await this.resolveFields(listTitle);
      if (!fields) {
        console.warn('DriftEventRepository: Could not resolve fields for DriftEventsLog. Fail-Open.');
        return;
      }

      // 動的に解決されたフィールド名のみを使用してペイロードを構築
      // 解決できなかったフィールドは含めないことで、400 Bad Request を回避する
      const payload: Record<string, unknown> = {};

      if (fields.title) {
        payload[fields.title] = `${event.listName}:${event.fieldName}`;
      } else {
        // Title はリストの基本列なので、解決できなくても Title を試みる
        payload['Title'] = `${event.listName}:${event.fieldName}`;
      }

      if (fields.detectedAt) payload[fields.detectedAt] = event.detectedAt;
      if (fields.severity) payload[fields.severity] = event.severity;
      if (fields.resolutionType) payload[fields.resolutionType] = event.resolutionType;
      if (fields.driftType) payload[fields.driftType] = event.driftType || 'unknown';
      if (fields.resolved !== undefined) payload[fields.resolved] = event.resolved;
      if (event.listName && fields.listName) payload[fields.listName] = event.listName;
      if (event.fieldName && fields.fieldName) payload[fields.fieldName] = event.fieldName;

      await this.spClient.createItem(listTitle, payload);
      this.errorCount = 0;
      this.sessionCache.add(dedupeKey);
    } catch (err) {
      this.errorCount++;
      if (this.errorCount >= 5) {
        this.circuitOpenUntil = Date.now() + 5 * 60 * 1000;
      }
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
      const fields = await this.resolveFields(listTitle);
      if (!fields) return [];
      
      const filters: string[] = [];
      if (filter?.listName && fields.listName) {
        filters.push(buildEq(fields.listName, filter.listName));
      }
      if (filter?.resolved !== undefined && fields.resolved) {
        filters.push(buildEq(fields.resolved, filter.resolved));
      }

      const select = Object.values(fields).filter((v): v is string => !!v);
      const items = await this.spClient.getListItemsByTitle<Record<string, unknown>>(listTitle, select, joinAnd(filters) || undefined, `${fields.detectedAt || 'DetectedAt'} desc`, 100);

      return items.map(item => ({
        id: String(item[fields.id || 'Id'] || item.ID || item.Id),
        listName: String(item[fields.listName || 'ListName'] || ''),
        fieldName: String(item[fields.fieldName || 'FieldName'] || ''),
        detectedAt: String(item[fields.detectedAt || 'DetectedAt'] || ''),
        severity: (item[fields.severity || 'Severity'] as 'warn' | 'info') || 'info',
        resolutionType: (item[fields.resolutionType || 'ResolutionType'] as DriftResolutionType) || 'fuzzy_match',
        driftType: (item[fields.driftType || 'DriftType'] as DriftType) || 'unknown',
        resolved: !!item[fields.resolved || 'Resolved']
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
      const fields = await this.resolveFields(listTitle);
      if (!fields || !fields.resolved) return;

      await this.spClient.updateItemByTitle(listTitle, Number(id), {
        [fields.resolved]: true
      });
    } catch (err) {
      console.error('DriftEventRepository: Failed to mark as resolved.', err);
    }
  }
}
