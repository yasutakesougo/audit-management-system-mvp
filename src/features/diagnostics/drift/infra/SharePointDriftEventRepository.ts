import { DriftEvent, DriftResolutionType, DriftType, getDriftEventDedupeKey } from '../domain/driftLogic';
import { IDriftEventRepository } from '../domain/DriftEventRepository';
import { findListEntry } from '@/sharepoint/spListRegistry';
import { buildDateTime, buildEq, buildGe, joinAnd } from '@/sharepoint/query/builders';
import { DRIFT_LOG_CANDIDATES } from '@/sharepoint/fields/diagnosticsFields';
import { extractMissingField, resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { auditLog } from '@/lib/debugLogger';
import { summarizeSpError } from '@/lib/errors';

/**
 * 依存関係の境界遵守のためのローカルインターフェース
 */
export interface ISpOperations {
  createItem: (listTitle: string, payload: Record<string, unknown>) => Promise<unknown>;
  updateItemByTitle: (listTitle: string, id: number, payload: Record<string, unknown>) => Promise<unknown>;
  getListItemsByTitle: <T>(listTitle: string, select?: string[], filter?: string, orderby?: string, top?: number, signal?: AbortSignal) => Promise<T[]>;
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
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
  private missingLogicalFields = new Set<keyof typeof DRIFT_LOG_CANDIDATES>();
  private blockedPhysicalFields = new Set<string>();
  private writeDisabled = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private spClient: ISpOperations & { 
    getSchema?: (listTitle: string) => Promise<string[]> 
  }) {}

  private rf(key: keyof typeof DRIFT_LOG_CANDIDATES): string | undefined {
    return this.resolvedFields[key];
  }

  private rfWithFallback(key: keyof typeof DRIFT_LOG_CANDIDATES): string {
    return this.resolvedFields[key] || DRIFT_LOG_CANDIDATES[key][0];
  }

  private readRowValue<T = unknown>(
    row: Record<string, unknown>,
    key: keyof typeof DRIFT_LOG_CANDIDATES,
  ): T | undefined {
    const rf = this.rf(key);
    const probe = rf ? [rf, ...DRIFT_LOG_CANDIDATES[key]] : DRIFT_LOG_CANDIDATES[key];
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

  private isHttp400(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'status' in err && (err as { status?: number }).status === 400;
  }

  private isListViewThresholdError(err: unknown): boolean {
    const { httpStatus, message } = summarizeSpError(err);
    if (httpStatus !== 500) return false;
    
    return (
      /list view threshold/i.test(message) ||
      /リストビュー.*しきい値/.test(message) ||
      /しきい値を超えている/.test(message) ||
      message.includes('5000')
    );
  }

  private isRequiredFieldKey(key: keyof typeof DRIFT_LOG_CANDIDATES): boolean {
    return key === 'listName' || key === 'fieldName' || key === 'detectedAt';
  }

  private isRequiredPhysicalField(fieldName: string): boolean {
    return [
      this.rfWithFallback('listName'), 
      this.rfWithFallback('fieldName'), 
      this.rfWithFallback('detectedAt')
    ].includes(fieldName);
  }

  private buildCreatePayload(event: DriftEvent, includeOptional: boolean): Record<string, unknown> | null {
    const payload: Record<string, unknown> = {
      Title: `${event.listName}:${event.fieldName}`,
    };

    const pushField = (
      key: keyof typeof DRIFT_LOG_CANDIDATES,
      value: unknown,
    ): boolean => {
      const resolvedName = this.rf(key);
      const isRequired = this.isRequiredFieldKey(key);

      // 1. 必須フィールドは読み込めなければフォールバック（Title等は確実に存在する想定）
      // 2. 任意フィールドは解決されていない場合は書き込まない（HTTP 400 回避）
      const physicalName = resolvedName || (isRequired ? DRIFT_LOG_CANDIDATES[key][0] : undefined);

      if (!physicalName || this.blockedPhysicalFields.has(physicalName)) {
        return !isRequired;
      }
      if (this.missingLogicalFields.has(key)) {
        return !this.isRequiredFieldKey(key);
      }
      payload[physicalName] = value;
      return true;
    };

    const requiredOk =
      pushField('listName', String(event.listName)) &&
      pushField('fieldName', String(event.fieldName)) &&
      pushField('detectedAt', String(event.detectedAt));

    if (!requiredOk) {
      return null;
    }

    if (includeOptional) {
      pushField('severity', String(event.severity));
      pushField('resolutionType', String(event.resolutionType));
      pushField('driftType', String(event.driftType || 'unknown'));
      pushField('resolved', Boolean(event.resolved));
    }

    return payload;
  }

  private mapItemToEvent(item: Record<string, unknown>): DriftEvent {
    return {
      id: String(item.Id ?? item.ID ?? ''),
      listName: String(this.readRowValue(item, 'listName') ?? ''),
      fieldName: String(this.readRowValue(item, 'fieldName') ?? ''),
      detectedAt: String(this.readRowValue(item, 'detectedAt') ?? ''),
      severity: (this.readRowValue(item, 'severity') as 'warn' | 'info') || 'info',
      resolutionType: (this.readRowValue(item, 'resolutionType') as DriftResolutionType) || 'fuzzy_match',
      driftType: (this.readRowValue(item, 'driftType') as DriftType) || 'unknown',
      resolved: this.parseResolved(this.readRowValue(item, 'resolved')),
    };
  }

  private matchesFilter(
    event: DriftEvent,
    filter?: {
      listName?: string;
      resolved?: boolean;
      since?: string;
    },
  ): boolean {
    if (!filter) return true;
    if (filter.listName && event.listName !== filter.listName) return false;
    if (filter.resolved !== undefined && event.resolved !== filter.resolved) return false;
    if (filter.since) {
      const eventTime = Date.parse(event.detectedAt);
      const sinceTime = Date.parse(filter.since);
      if (!Number.isNaN(eventTime) && !Number.isNaN(sinceTime) && eventTime < sinceTime) return false;
    }
    return true;
  }

  private async fetchEventsWithThresholdFallback(
    listTitle: string,
    select: string[],
    filterQuery: string | undefined,
    detectedAtField: string,
    filter?: {
      listName?: string;
      resolved?: boolean;
      since?: string;
    },
    signal?: AbortSignal,
  ): Promise<DriftEvent[]> {
    try {
      const items = await this.spClient.getListItemsByTitle<Record<string, unknown>>(
        listTitle,
        select,
        filterQuery,
        `${detectedAtField} desc`,
        100,
        signal,
      );
      return items.map((item) => this.mapItemToEvent(item));
    } catch (err) {
      if (!this.isListViewThresholdError(err)) {
        throw err;
      }

      const { sprequestguid } = summarizeSpError(err);
      auditLog.warn(
        'diagnostics:drift',
        'DriftEventRepository threshold fallback: retrying with Id-desc scan.',
        {
          listTitle,
          filterQuery,
          orderBy: `${detectedAtField} desc`,
          sprequestguid
        },
      );

      const fallbackItems = await this.spClient.getListItemsByTitle<Record<string, unknown>>(
        listTitle,
        select,
        undefined,
        'Id desc',
        200,
        signal,
      );

      return fallbackItems
        .map((item) => this.mapItemToEvent(item))
        .filter((event) => this.matchesFilter(event, filter))
        .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
        .slice(0, 100);
    }
  }

  private async initializeResolvedFields(listTitle: string): Promise<void> {
    if (Object.keys(this.resolvedFields).length > 0) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        let availableFields: string[] = [];
        try {
          availableFields = await this.spClient.getSchema?.(listTitle) || [];
        } catch (err) {
          auditLog.warn('diagnostics:drift', 'DriftEventRepository getSchema failed.', err);
        }

        if (availableFields.length === 0) {
          try {
            const fieldSet = await this.spClient.getListFieldInternalNames?.(listTitle);
            availableFields = fieldSet ? Array.from(fieldSet) : [];
          } catch (err) {
            auditLog.warn('diagnostics:drift', 'DriftEventRepository getListFieldInternalNames failed.', err);
          }
        }

        if (availableFields.length === 0) return;

        const res = resolveInternalNamesDetailed(
          new Set(availableFields),
          DRIFT_LOG_CANDIDATES as unknown as Record<string, string[]>,
        );
        this.resolvedFields = res.resolved;
        this.missingLogicalFields = new Set(
          res.missing as Array<keyof typeof DRIFT_LOG_CANDIDATES>,
        );

        auditLog.debug('diagnostics:drift', 'DriftEventRepository initialized.', {
          listTitle,
          resolvedCount: Object.values(res.resolved).filter(Boolean).length,
          missingCount: res.missing.length,
          missingFields: res.missing,
        });
      } catch (err) {
        auditLog.warn('diagnostics:drift', 'DriftEventRepository initialization failed.', err);
      }
    })();

    return this.initializationPromise;
  }

  async logEvent(event: DriftEvent): Promise<void> {
    const dedupeKey = getDriftEventDedupeKey(event);

    if (this.writeDisabled) {
      return;
    }

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

      const payload = this.buildCreatePayload(event, true);
      if (!payload) {
        this.writeDisabled = true;
        auditLog.warn('diagnostics:drift', 'DriftEventRepository disabled writing due to missing required drift-log fields.');
        return;
      }
      let activePayload: Record<string, unknown> = payload;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.spClient.createItem(listTitle, activePayload);
          this.sessionCache.add(dedupeKey);
          return;
        } catch (err) {
          if (!this.isHttp400(err)) throw err;

          const missingPhysicalField = extractMissingField(
            err instanceof Error ? err.message : String(err),
          );

          if (missingPhysicalField && Object.prototype.hasOwnProperty.call(activePayload, missingPhysicalField)) {
            const nextPayload: Record<string, unknown> = { ...activePayload };
            delete nextPayload[missingPhysicalField];
            activePayload = nextPayload;
            this.blockedPhysicalFields.add(missingPhysicalField);

            if (this.isRequiredPhysicalField(missingPhysicalField)) {
              this.writeDisabled = true;
              auditLog.warn('diagnostics:drift', 'DriftEventRepository disabled writing: required field missing.', {
                missingPhysicalField,
              });
              return;
            }
            continue;
          }

          // フィールド名が特定できない 400 は、任意列を外した最小ペイロードで 1 回だけ再試行する
          if (attempt === 0) {
            const minimalPayload = this.buildCreatePayload(event, false);
            if (!minimalPayload) {
              this.writeDisabled = true;
              return;
            }
            activePayload = minimalPayload;
            continue;
          }

          throw err;
        }
      }

      throw new Error('DriftEventRepository failed to log drift event after fallback retries.');
    } catch (err) {
      // ✅ Fail-Open: 書き込み失敗は、システム全体の業務に影響を与えないよう握りつぶす。
      auditLog.error('diagnostics:drift', 'DriftEventRepository failed to log drift event (fail-open).', err);
    }
  }

  async getEvents(filter?: {
    listName?: string;
    resolved?: boolean;
    since?: string;
  }, signal?: AbortSignal): Promise<DriftEvent[]> {
    try {
      const entry = findListEntry('drift_events_log');
      if (!entry) return [];

      const listTitle = entry.resolve();
      await this.initializeResolvedFields(listTitle);
      
      // クエリビルド (実在するフィールドのみ使用)
      const filters: string[] = [];
      const listNameField = this.rf('listName');
      const resolvedField = this.rf('resolved');
      const detectedAtField = this.rf('detectedAt');

      if (filter?.listName && listNameField) {
        filters.push(buildEq(listNameField, filter.listName));
      }
      if (filter?.resolved !== undefined && resolvedField) {
        filters.push(buildEq(resolvedField, filter.resolved));
      }
      if (filter?.since && detectedAtField) {
        filters.push(buildGe(detectedAtField, buildDateTime(filter.since)));
      }

      const selectRaw = [
        'Id',
        'ID',
        this.rf('listName'),
        this.rf('fieldName'),
        this.rf('detectedAt'),
        this.rf('severity'),
        this.rf('resolutionType'),
        this.rf('driftType'),
        this.rf('resolved'),
      ];

      // リストに実在しないフィールドを $select から完全に除外する (400エラー防止)
      const select = selectRaw.filter((f): f is string => !!f);

      const events = await this.fetchEventsWithThresholdFallback(
        listTitle,
        select,
        joinAnd(filters) || undefined,
        // 解決済みの DetectedAt があれば優先する。
        // 未解決（新規リスト等）の場合は時系列の厳密性よりも可用性（400エラー回避）を優先し、
        // 常に存在する 'ID' でフォールバックする。
        detectedAtField || 'ID',
        filter,
        signal,
      );

      return events;

    } catch (err) {
      // Abortエラー時は静かに終了（ログノイズ抑制）
      const isAbort = (err as Error)?.name === 'AbortError' || 
                      (err as { code?: number | string })?.code === 20 ||
                      (err as { code?: number | string })?.code === 'ABORT_ERR';
      if (isAbort) return [];

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
      const resolvedField = this.rf('resolved');
      if (resolvedField) {
        await this.spClient.updateItemByTitle(listTitle, Number(id), {
          [resolvedField]: true
        });
      }
    } catch (err) {
      auditLog.warn('diagnostics:drift', 'DriftEventRepository failed to mark event as resolved (fail-open).', err);
    }
  }
}
