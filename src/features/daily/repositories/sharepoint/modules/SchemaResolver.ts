/**
 * DailyRecord SchemaResolver — GenericSchemaResolver ラッパー
 *
 * 共通基盤 GenericSchemaResolver に Daily 固有の
 * candidates / essentials / フォールバックリストを注入。
 *
 * Daily 固有の `resolveRowAggregateSource()` はこのラッパーに残す。
 * これは子リスト (DailyRecordRows) の解決であり、
 * 他ドメインには存在しない Daily 固有の拡張。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import { GenericSchemaResolver } from '@/lib/sp/GenericSchemaResolver';
import {
  buildListPath,
  buildListTitleCandidates,
  normalizeListKey,
  type SharePointResponse,
  type SharePointFieldItem,
} from '@/lib/sp/schemaUtils';
import { type RowAggregateSource } from '../constants';
import {
  DAILY_RECORD_CANONICAL_CANDIDATES,
  DAILY_RECORD_CANONICAL_ESSENTIALS,
  DAILY_RECORD_ROW_AGGREGATE_CANDIDATES,
  DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS,
} from '@/sharepoint/fields/dailyFields';
import {
  resolveInternalNamesDetailed,
  areEssentialFieldsResolved,
} from '@/lib/sp/helpers';
import { defaultDriftEventHandler } from '@/lib/sp/onDriftEvent';

// 旧 Helpers.ts から移行。Daily 固有のフォールバックリスト。
const DAILY_RECORD_LIST_FALLBACKS = [
  'SupportRecord_Daily',
  'SupportProcedureRecord_Daily',
  'DailyActivityRecords',
  'TableDailyRecords',
  'TableDailyRecord',
  'DailyRecords',
  '日次記録',
  '支援記録',
] as const;

export class DailyRecordSchemaResolver {
  private readonly generic: GenericSchemaResolver;
  private readonly spFetch: SpFetchFn;
  private readonly listTitle: string;

  private resolvedRowAggregateSource: RowAggregateSource | null = null;
  private rowAggregateResolutionFailed = false;

  constructor(spFetch: SpFetchFn, listTitle: string) {
    this.spFetch = spFetch;
    this.listTitle = listTitle;

    this.generic = new GenericSchemaResolver(spFetch, {
      listTitle,
      listTitleFallbacks: DAILY_RECORD_LIST_FALLBACKS,
      candidates: DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>,
      essentials: DAILY_RECORD_CANONICAL_ESSENTIALS as unknown as string[],
      telemetryLabel: 'Daily',
      onDriftEvent: defaultDriftEventHandler,
    });
  }

  // ── 共通基盤に委譲 ────────────────────────────────────────────────────

  public resolveListPath(): Promise<string | null> {
    return this.generic.resolveListPath();
  }

  public getResolvedCanonicalNames(): Promise<Record<string, string | undefined>> {
    return this.generic.getResolvedCanonicalNames();
  }

  // ── Daily 固有: 子リスト (RowAggregate) 解決 ──────────────────────────

  public async resolveRowAggregateSource(): Promise<RowAggregateSource | null> {
    if (this.resolvedRowAggregateSource) return this.resolvedRowAggregateSource;
    if (this.rowAggregateResolutionFailed) return null;

    const availableTitles = await this.getAvailableListTitles();
    if (!availableTitles) {
      this.rowAggregateResolutionFailed = true;
      return null;
    }

    const lookup = new Map<string, string>();
    for (const title of availableTitles) {
      lookup.set(title.toLowerCase(), title);
      lookup.set(normalizeListKey(title), title);
    }

    const rowCandidates = [
      this.listTitle,
      ...buildListTitleCandidates(this.listTitle, DAILY_RECORD_LIST_FALLBACKS),
      'DailyBehaviorRecords（DO）',
    ];

    for (const candidate of [...new Set(rowCandidates)]) {
      const matched =
        lookup.get(candidate.toLowerCase()) ??
        lookup.get(normalizeListKey(candidate));
      if (!matched) continue;

      const listPath = buildListPath(matched);
      const fieldNames = await this.getListFieldNames(listPath);
      if (!fieldNames) continue;

      const res = resolveInternalNamesDetailed(
        fieldNames,
        DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>
      );
      const isOk = areEssentialFieldsResolved(
        res.resolved,
        DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS as unknown as string[]
      );

      if (!isOk) continue;

      this.resolvedRowAggregateSource = {
        listPath,
        listTitle: matched,
        dateField: res.resolved.recordDate!,
        selectFields: [
          'Id',
          'Title',
          ...Object.values(res.resolved).filter((v): v is string => !!v),
          'Created',
          'Modified',
        ],
      };
      return this.resolvedRowAggregateSource;
    }

    this.rowAggregateResolutionFailed = true;
    return null;
  }

  // ── Private helpers (RowAggregate 専用) ────────────────────────────────

  private async getAvailableListTitles(): Promise<string[] | null> {
    try {
      const response = await this.spFetch('lists?$select=Title&$top=5000');
      const payload = (await response.json()) as SharePointResponse<{ Title?: string }>;
      return (payload.value ?? [])
        .map((item) => item.Title?.trim())
        .filter((title): title is string => Boolean(title));
    } catch {
      return null;
    }
  }

  private async getListFieldNames(listPath: string): Promise<Set<string> | null> {
    try {
      const response = await this.spFetch(
        `${listPath}/fields?$select=InternalName&$top=500`
      );
      const payload = (await response.json()) as SharePointResponse<SharePointFieldItem>;
      return new Set(
        (payload.value ?? [])
          .map((field) => field.InternalName?.trim())
          .filter((name): name is string => Boolean(name))
      );
    } catch {
      return null;
    }
  }
}
