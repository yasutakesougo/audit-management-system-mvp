import { get as getEnv } from '@/env';
import { fromSpItem, type SpDailyItem } from '@/domain/daily/spMap';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { toSafeError } from '@/lib/errors';
import type { SpFetchFn } from '@/lib/sp/spLists';
import type {
    ApproveRecordInput,
    DailyRecordItem,
    DailyRecordRepository,
    DailyRecordRepositoryListParams,
    DailyRecordRepositoryMutationParams,
    SaveDailyRecordInput,
} from '../../domain/legacy/DailyRecordRepository';
import { DailyRecordItemSchema } from '../../domain/schema';
import { buildDailyRecordPayload } from '../../domain/builders/buildDailyRecordPayload';
import { auditLog } from '@/lib/debugLogger';

import { 
  scanDailyRecordIntegrity, 
  type DailyIntegrityException,
  type ScanSourceParent,
  type ScanSourceChild,
  type ScanSourceAccessory
} from '../../domain/integrity/dailyIntegrityChecker';

import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

/**
 * SharePoint List Name for Daily Records
 * Can be overridden via environment variable
 */
const readNonEmptyEnv = (key: string): string | undefined => {
  const value = getEnv(key, '').trim();
  return value.length > 0 ? value : undefined;
};

const getListTitle = (): string => {
  return (
    readNonEmptyEnv('VITE_SP_DAILY_RECORDS_LIST') ??
    readNonEmptyEnv('VITE_SP_LIST_DAILY') ??
    'SupportRecord_Daily'
  );
};

/**
 * SharePoint field names for daily records
 */
const DAILY_RECORD_FIELDS = {
  title: 'Title',              // YYYY-MM-DD
  recordDate: 'RecordDate',    // Date type
  reporterName: 'ReporterName', // Text
  reporterRole: 'ReporterRole', // Text
  userRowsJSON: 'UserRowsJSON', // Multi-line text (DEPRECATED fallback)
  userCount: 'UserCount',       // Number
  latestVersion: 'LatestVersion', // NEW: Atomic version control
  isDeleted: 'IsDeleted',       // NEW: Logical delete support
  created: 'Created',
  modified: 'Modified',
} as const;

const DAILY_RECORD_ROWS_FIELDS = {
  parentId: 'ParentID',
  userId: 'UserID',
  version: 'Version',           // NEW: Matches Parent's LatestVersion
  status: 'Status',
  payload: 'Payload',
  recordedAt: 'RecordedAt',
} as const;

/**
 * SharePoint response type
 */
type SharePointResponse<T> = {
  value?: T[];
};

type SharePointFieldItem = {
  InternalName?: string;
};

type RowAggregateSource = {
  listPath: string;
  listTitle: string;
  dateField: string;
  selectFields: string[];
};

/**
 * Minimal interface for SharePoint items during save/update operations
 */
interface SharePointItem {
  Id: number;
  Title?: string;
  RecordDate?: string;
  ReporterName?: string;
  ReporterRole?: string;
  UserRowsJSON?: string;
  UserCount?: number;
  LatestVersion?: number;
  IsDeleted?: boolean;
  Created?: string;
  Modified?: string;
  __metadata?: {
    etag?: string;
  };
}

// readSpErrorMessage 削除: spFetch (throwOnError: true) が自動 throw する

/**
 * Parse SharePoint item to DailyRecordItem using Zod schema
 */
const parseSpItem = (item: unknown): DailyRecordItem | null => {
  const result = DailyRecordItemSchema.safeParse(item);
  if (!result.success) {
    console.error('[SharePointDailyRecordRepository] Failed to validate item', {
      itemId: (item && typeof item === 'object' && 'Id' in item) ? (item as Record<string, unknown>).Id : 'unknown',
      errors: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
};

/**
 * Build list path for API requests (relative path — baseUrl は spFetch が付与)
 */
const buildListPath = (listTitle: string): string => {
  const escaped = listTitle.replace(/'/g, "''");
  return `lists/getbytitle('${escaped}')`;
};

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
const DAILY_RECORD_SUGGESTION_TOKENS = ['daily', 'record', 'table', 'report', '日次', '記録', '支援', 'ケース', '報告'] as const;

const normalizeListKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s_\-\u3000]+/gu, '');

const buildListTitleCandidates = (primary: string): string[] => {
  const normalizedPrimary = primary.trim();
  const values = [
    normalizedPrimary,
    ...DAILY_RECORD_LIST_FALLBACKS,
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
};

const suggestListTitles = (titles: string[], requested: string, tried: string[]): string[] => {
  const triedSet = new Set(tried.map(normalizeListKey));
  const requestedKey = normalizeListKey(requested);

  const scored = titles
    .filter((title) => !triedSet.has(normalizeListKey(title)))
    .map((title) => {
      const titleKey = normalizeListKey(title);
      let score = 0;

      if (requestedKey && (titleKey.includes(requestedKey) || requestedKey.includes(titleKey))) {
        score += 6;
      }
      for (const token of DAILY_RECORD_SUGGESTION_TOKENS) {
        if (title.includes(token) || title.toLowerCase().includes(token)) {
          score += 2;
        }
      }
      return { title, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8)
    .map((entry) => entry.title);

  return scored;
};

const getHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const obj = error as Record<string, unknown>;
  if (typeof obj.status === 'number') return obj.status;
  if (obj.cause && typeof obj.cause === 'object') {
    const cause = obj.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') return cause.status;
  }
  return undefined;
};

const normalizeDateToYmd = (raw: unknown): string | null => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  return null;
};

const EMPTY_PROBLEM_BEHAVIOR = {
  selfHarm: false,
  otherInjury: false,
  loudVoice: false,
  pica: false,
  other: false,
};

const mergeSpecialNotes = (current: string, incoming: string): string => {
  if (!incoming.trim()) return current;
  if (!current.trim()) return incoming;
  if (current.includes(incoming)) return current;
  return `${current}\n${incoming}`;
};

/**
 * Build OData filter for date range
 */
const buildDateRangeFilter = (startDate: string, endDate: string): string => {
  return `Title ge '${startDate}' and Title le '${endDate}'`;
};

/**
 * SharePoint repository options
 */
type SharePointDailyRecordRepositoryOptions = {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
  /** DI: spFetch (createSpClient 経由で生成) */
  spFetch?: SpFetchFn;
};

/**
 * SharePoint implementation of DailyRecordRepository
 *
 * Uses "Single Item" strategy:
 * - One SharePoint item per day
 * - Multiple user rows stored as JSON in UserRowsJSON field
 * - Provides better transaction consistency and performance
 *
 * SharePoint List Schema:
 * - Title (Single line text): YYYY-MM-DD format date
 * - RecordDate (Date): Date field for filtering
 * - ReporterName (Single line text): Name of reporter
 * - ReporterRole (Single line text): Role of reporter
 * - UserRowsJSON (Multiple lines text): JSON array of UserRowData
 * - UserCount (Number): Count of users for quick filtering
 */
export class SharePointDailyRecordRepository implements DailyRecordRepository {
  private readonly spFetch: SpFetchFn;
  private readonly listTitle: string;
  private readonly listTitleCandidates: string[];
  private resolvedListPath: string | null = null;
  private listPathResolutionFailed = false;
  private resolvedRowAggregateSource: RowAggregateSource | null = null;
  private rowAggregateResolutionFailed = false;

  constructor(options: SharePointDailyRecordRepositoryOptions = {}) {
    if (!options.spFetch) {
      throw new Error(
        '[SharePointDailyRecordRepository] spFetch is required. Use factory to create instances.',
      );
    }
    this.spFetch = options.spFetch;
    this.listTitle = options.listTitle ?? getListTitle();
    this.listTitleCandidates = buildListTitleCandidates(this.listTitle);
  }

  private getRowsListTitle(): string {
    return readNonEmptyEnv('VITE_SP_LIST_PROCEDURE_RECORD_ROWS') ?? 'DailyRecordRows';
  }

  private async getAvailableListTitles(): Promise<string[] | null> {
    try {
      const response = await this.spFetch("lists?$select=Title&$top=5000");
      const payload = (await response.json()) as SharePointResponse<{ Title?: string }>;
      const titles = (payload.value ?? [])
        .map((item) => item.Title?.trim())
        .filter((title): title is string => Boolean(title));
      return titles;
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async getListFieldNames(listPath: string): Promise<Set<string> | null> {
    const params = new URLSearchParams();
    params.set('$select', 'InternalName');
    params.set('$top', '500');

    try {
      const response = await this.spFetch(`${listPath}/fields?${params.toString()}`);
      const payload = (await response.json()) as SharePointResponse<SharePointFieldItem>;
      return new Set(
        (payload.value ?? [])
          .map((field) => field.InternalName?.trim())
          .filter((name): name is string => Boolean(name)),
      );
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 400 || status === 403 || status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async probeDailyRecordSchema(
    listPath: string,
  ): Promise<{ matches: boolean; missingFields: string[] }> {
    const names = await this.getListFieldNames(listPath);
    if (!names) {
      return { matches: false, missingFields: [] };
    }
    const required = [
      DAILY_RECORD_FIELDS.title,
      DAILY_RECORD_FIELDS.recordDate,
      DAILY_RECORD_FIELDS.reporterName,
      DAILY_RECORD_FIELDS.reporterRole,
      DAILY_RECORD_FIELDS.userRowsJSON,
      DAILY_RECORD_FIELDS.userCount,
    ];
    const missingFields = required.filter((field) => !names.has(field));
    return { matches: missingFields.length === 0, missingFields };
  }

  private async resolveRowAggregateSource(availableTitlesInput?: string[] | null): Promise<RowAggregateSource | null> {
    if (this.resolvedRowAggregateSource) {
      return this.resolvedRowAggregateSource;
    }
    if (this.rowAggregateResolutionFailed) {
      return null;
    }

    const availableTitles = availableTitlesInput ?? await this.getAvailableListTitles();
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
      ...this.listTitleCandidates,
      'SupportRecord_Daily',
      'DailyActivityRecords',
      'SupportProcedureRecord_Daily',
      'DailyBehaviorRecords（DO）',
    ];

    for (const candidate of [...new Set(rowCandidates)]) {
      const matched = lookup.get(candidate.toLowerCase()) ?? lookup.get(normalizeListKey(candidate));
      if (!matched) continue;

      const listPath = buildListPath(matched);
      const fieldNames = await this.getListFieldNames(listPath);
      if (!fieldNames) continue;

      const dateField = ['cr013_date', 'cr013_recorddate', 'RecordDate', 'Date']
        .find((name) => fieldNames.has(name));
      const userIdField = ['cr013_personId', 'cr013_usercode', 'UserCode', 'UserID']
        .find((name) => fieldNames.has(name));
      if (!dateField || !userIdField) continue;

      const selectFields = [
        'Id',
        'Title',
        userIdField,
        dateField,
        'cr013_status',
        'cr013_reporterName',
        'cr013_reporterId',
        'cr013_draftJson',
        'cr013_payload',
        'cr013_kind',
        'cr013_group',
        'cr013_specialnote',
        'Created',
        'Modified',
      ].filter((name, index, self) => self.indexOf(name) === index && (name === 'Id' || name === 'Title' || fieldNames.has(name)));

      this.resolvedRowAggregateSource = {
        listPath,
        listTitle: matched,
        dateField,
        selectFields,
      };
      console.warn('[SharePointDailyRecordRepository] Row-aggregate fallback source selected', {
        requested: this.listTitle,
        resolved: matched,
        dateField,
        userIdField,
      });
      return this.resolvedRowAggregateSource;
    }

    this.rowAggregateResolutionFailed = true;
    return null;
  }

  private normalizeRowForDailyMap(item: Record<string, unknown>): SpDailyItem {
    const normalized: SpDailyItem = { ...item };

    if (!normalized.cr013_date && normalized.cr013_recorddate) {
      normalized.cr013_date = normalized.cr013_recorddate;
    }
    if (!normalized.cr013_personId && normalized.cr013_usercode) {
      normalized.cr013_personId = normalized.cr013_usercode;
    }
    if (!normalized.cr013_payload && typeof normalized.cr013_specialnote === 'string' && normalized.cr013_specialnote.trim()) {
      normalized.cr013_payload = JSON.stringify({ specialNotes: normalized.cr013_specialnote });
    }
    if (!normalized.cr013_kind) {
      normalized.cr013_kind = 'A';
    }
    if (!normalized.cr013_status) {
      normalized.cr013_status = '完了';
    }

    return normalized;
  }

  private async listFromRowAggregate(
    source: RowAggregateSource,
    params: DailyRecordRepositoryListParams & { limit?: number },
  ): Promise<DailyRecordItem[]> {
    const queryParams = new URLSearchParams();
    const limit = params.limit ?? SP_QUERY_LIMITS.default;
    const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);
    queryParams.set('$top', String(safeLimit));
    queryParams.set('$orderby', 'Id desc');
    queryParams.set('$select', source.selectFields.join(','));

    const response = await this.spFetch(`${source.listPath}/items?${queryParams.toString()}`);
    const payload = (await response.json()) as SharePointResponse<Record<string, unknown>>;
    const rows = payload.value ?? [];

    const grouped = new Map<string, DailyRecordItem>();
    const userRowIndexByDate = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const normalized = this.normalizeRowForDailyMap(row);
      if (!normalized.cr013_date && normalized[source.dateField]) {
        normalized.cr013_date = normalized[source.dateField];
      }
      if (!normalized.cr013_personId && (normalized.UserCode || normalized.UserID)) {
        normalized.cr013_personId = (normalized.UserCode ?? normalized.UserID) as string;
      }
      let parsed;
      try {
        parsed = fromSpItem(normalized, 'A');
      } catch {
        continue;
      }
      const date = normalizeDateToYmd((normalized[source.dateField] as unknown) ?? parsed.date);
      if (!date) continue;
      if (date < params.range.startDate || date > params.range.endDate) continue;

      const reporterName = parsed.reporter?.name?.trim() || '記録者不明';
      const reporterRole = parsed.kind === 'A' ? (parsed.data.specialNotes ? '記録' : '担当') : '担当';
      const specialNotes =
        parsed.kind === 'A'
          ? parsed.data.specialNotes ?? ''
          : parsed.data.notes ?? '';
      const userId = parsed.userId?.trim() || String((normalized.cr013_personId ?? normalized.cr013_usercode ?? normalized.UserCode ?? '')).trim();
      const userName = parsed.userName?.trim() || String((normalized.Title ?? userId) || '').trim();
      if (!userId) continue;

      const rowData = {
        userId,
        userName: userName || userId,
        amActivity: parsed.kind === 'A' ? (parsed.data.amActivities[0] ?? '') : '',
        pmActivity: parsed.kind === 'A' ? (parsed.data.pmActivities[0] ?? '') : '',
        lunchAmount: parsed.kind === 'A' ? (parsed.data.mealAmount ?? '') : '',
        problemBehavior: parsed.kind === 'A' ? (parsed.data.problemBehavior ?? EMPTY_PROBLEM_BEHAVIOR) : EMPTY_PROBLEM_BEHAVIOR,
        specialNotes,
        behaviorTags: parsed.kind === 'A' ? (parsed.data.behaviorTags ?? []) : [],
      };

      if (!grouped.has(date)) {
        grouped.set(date, {
          id: `row-aggregate-${date}`,
          date,
          reporter: { name: reporterName, role: reporterRole },
          userRows: [rowData],
        });
        userRowIndexByDate.set(date, new Map([[userId, 0]]));
        continue;
      }

      const record = grouped.get(date)!;
      const rowIndex = userRowIndexByDate.get(date) ?? new Map<string, number>();
      const existingIndex = rowIndex.get(userId);
      if (existingIndex === undefined) {
        rowIndex.set(userId, record.userRows.length);
        record.userRows.push(rowData);
        userRowIndexByDate.set(date, rowIndex);
      } else {
        const existing = record.userRows[existingIndex];
        existing.amActivity = existing.amActivity || rowData.amActivity;
        existing.pmActivity = existing.pmActivity || rowData.pmActivity;
        existing.lunchAmount = existing.lunchAmount || rowData.lunchAmount;
        existing.specialNotes = mergeSpecialNotes(existing.specialNotes, rowData.specialNotes);
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  private async resolveListPath(): Promise<string | null> {
    if (this.resolvedListPath) {
      return this.resolvedListPath;
    }
    if (this.listPathResolutionFailed) {
      return null;
    }

    const availableTitles = await this.getAvailableListTitles();
    if (availableTitles) {
      const titleLookup = new Map<string, string>();
      const schemaMismatches: Array<{ title: string; missingFields: string[] }> = [];
      for (const title of availableTitles) {
        titleLookup.set(title.toLowerCase(), title);
        titleLookup.set(normalizeListKey(title), title);
      }
      for (const candidate of this.listTitleCandidates) {
        const matched = titleLookup.get(candidate.toLowerCase()) ?? titleLookup.get(normalizeListKey(candidate));
        if (!matched) continue;
        const listPath = buildListPath(matched);
        const schemaProbe = await this.probeDailyRecordSchema(listPath);
        if (!schemaProbe.matches) {
          schemaMismatches.push({ title: matched, missingFields: schemaProbe.missingFields });
          continue;
        }
        this.resolvedListPath = listPath;
        if (matched !== this.listTitle) {
          console.warn('[SharePointDailyRecordRepository] Fallback list title selected', {
            requested: this.listTitle,
            resolved: matched,
          });
        }
        return listPath;
      }

      this.listPathResolutionFailed = true;
      console.warn('[SharePointDailyRecordRepository] Daily record list not found in site list catalog', {
        requested: this.listTitle,
        tried: this.listTitleCandidates,
        listCount: availableTitles.length,
        suggestions: suggestListTitles(availableTitles, this.listTitle, this.listTitleCandidates),
        schemaMismatches: schemaMismatches.slice(0, 8),
      });
      return null;
    }

    for (const candidate of this.listTitleCandidates) {
      const listPath = buildListPath(candidate);
      try {
        const schemaProbe = await this.probeDailyRecordSchema(listPath);
        if (!schemaProbe.matches) {
          continue;
        }
        this.resolvedListPath = listPath;
        if (candidate !== this.listTitle) {
          console.warn('[SharePointDailyRecordRepository] Fallback list title selected', {
            requested: this.listTitle,
            resolved: candidate,
          });
        }
        return listPath;
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 404) {
          continue;
        }
        throw error;
      }
    }

    this.listPathResolutionFailed = true;
    console.warn('[SharePointDailyRecordRepository] Daily record list not found', {
      requested: this.listTitle,
      tried: this.listTitleCandidates,
    });
    return null;
  }

  /**
   * Save a daily record
   * Updates existing item or creates new one
   */
  async save(
    input: SaveDailyRecordInput,
    params?: DailyRecordRepositoryMutationParams,
  ): Promise<void> {
    if (params?.signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, {
      date: input.date,
      userCount: input.userRows.length,
    });
    try {
      const listPath = await this.resolveListPath();
      if (!listPath) {
        throw new Error(
          `Daily records list is not found. Set VITE_SP_DAILY_RECORDS_LIST or VITE_SP_LIST_DAILY (requested: ${this.listTitle})`,
        );
      }

      // Check if item exists for this date
      const existingItem = await this.findItemByDate(input.date, params?.signal) as SharePointItem | null;
      const mode = existingItem ? 'update' : 'create';

      // Prepare item data using pure builder
      const itemData = buildDailyRecordPayload(input);
      
      // 親レコードの保存
      let parentId: number;
      if (existingItem) {
        parentId = existingItem.Id;
        const updateUrl = `${listPath}/items(${parentId})`;
        await this.spFetch(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': existingItem.__metadata?.etag ?? '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify({
            ...itemData,
            // まだ UserRowsJSON はクリアしない (Child 保存失敗時のため)
          }),
        });
      } else {
        const createUrl = `${listPath}/items`;
        const res = await this.spFetch(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
          },
          body: JSON.stringify({
            ...itemData,
            UserRowsJSON: '', // 新規作成なら既知の容量超過はないためクリア状態で開始
          }),
        });
        const created = await res.json();
        parentId = created.d?.Id || created.Id;
      }

      const rowsListTitle = this.getRowsListTitle();
      const rowsListPath = buildListPath(rowsListTitle);

      // 子レコード（行詳細）のクリーンアップ: 既存の行を ParentID で検索して削除
      if (existingItem) {
        try {
          const filter = `${DAILY_RECORD_ROWS_FIELDS.parentId} eq ${parentId}`;
          const res = await this.spFetch(`${rowsListPath}/items?$filter=${filter}&$select=Id`);
          const json = await res.json();
          const itemsToDelete = json.value || [];
          
          if (itemsToDelete.length > 0) {
            auditLog.debug('daily', `Cleaning up ${itemsToDelete.length} existing rows for ParentID: ${parentId}`);
            // Note: 本来は $batch で削除すべきだが、まずは確実な逐次削除で実装
            for (const item of itemsToDelete) {
              await this.spFetch(`${rowsListPath}/items(${item.Id})`, {
                method: 'POST',
                headers: { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' }
              });
            }
          }
        } catch (cleanupError) {
          auditLog.warn('daily', 'Row cleanup failed - might result in duplicates', { error: String(cleanupError) });
        }
      }

      // 子レコードの新規保存
      for (const row of input.userRows) {
        const rowPayload = {
          [DAILY_RECORD_ROWS_FIELDS.parentId]: parentId,
          [DAILY_RECORD_ROWS_FIELDS.userId]: row.userId,
          [DAILY_RECORD_ROWS_FIELDS.status]: 'done',
          [DAILY_RECORD_ROWS_FIELDS.payload]: JSON.stringify(row), // 行ごとのJSONなら制限に絶対かからない
          [DAILY_RECORD_ROWS_FIELDS.recordedAt]: new Date().toISOString(),
        };
        await this.spFetch(`${rowsListPath}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json;odata=verbose', 'Accept': 'application/json;odata=verbose' },
          body: JSON.stringify(rowPayload),
        });
      }

      // 4. 全ての Child が正常保存された後に、Parent の移行フラグを立てて JSON をクリアする
      if (existingItem || parentId) {
        const finalizeUrl = `${listPath}/items(${parentId})`;
        await this.spFetch(finalizeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify({
            UserRowsJSON: '', // 物理的な移行完了。ここで初めて Parent のスペースが空く
          }),
        });
        auditLog.info('daily', `Finalized record normalization for ${input.date}`, { parentId });
      }

      finishSpan({ meta: { status: 'ok', mode } });
    } catch (error) {
      const safeError = toSafeError(error);
      finishSpan({ meta: { status: 'error' }, error: safeError.message });
      console.error('[SharePointDailyRecordRepository] Save failed', {
        date: input.date,
        userCount: input.userRows.length,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * Scan integrity for a range of dates
   */
  async scanIntegrity(dates: string[], signal?: AbortSignal): Promise<DailyIntegrityException[]> {
    if (dates.length === 0) return [];
    
    try {
      const listPath = await this.resolveListPath();
      const rowsListTitle = this.getRowsListTitle();
      const rowsListPath = buildListPath(rowsListTitle);

      // 1. 親レコードを取得 (RecordDate $in ...)
      // $filter の dateQuery を作成
      const dateFilters = dates.map(d => `${DAILY_RECORD_FIELDS.recordDate} eq '${d}T00:00:00Z'`).join(' or ');
      const parentUrl = `${listPath}/items?$filter=(${dateFilters}) and ${DAILY_RECORD_FIELDS.isDeleted} ne true&$select=Id,RecordDate,LatestVersion`;
      
      const pRes = await this.spFetch(parentUrl, { signal });
      const pData = await pRes.json();
      const rawParents = pData.value || [];
      
      const parents: ScanSourceParent[] = rawParents.map((p: { Id: number | string; RecordDate?: string; LatestVersion?: number }) => ({
        id: String(p.Id),
        date: p.RecordDate ? p.RecordDate.split('T')[0] : 'unknown',
        latestVersion: p.LatestVersion || 0,
      }));

      if (parents.length === 0) return [];

      // 2. 対応する子レコードを取得 (ParentID $in ...)
      const parentIds = parents.map(p => p.id);
      // 注意: $in フィルタは限界があるため、大量の場合は分割が必要だが、今回は日付指定範囲のため $or で構築
      const idFilters = parentIds.map(id => `${DAILY_RECORD_ROWS_FIELDS.parentId} eq ${id}`).join(' or ');
      const childUrl = `${rowsListPath}/items?$filter=${idFilters}&$select=ParentID,UserID,Version,Status,Payload,RecordedAt`;
      
      const cRes = await this.spFetch(childUrl, { signal });
      const cData = await cRes.json();
      const rawChildren = cData.value || [];

      const children: ScanSourceChild[] = rawChildren.map((c: { ParentID: number | string; UserID: string; Version?: number; Status: string; RecordedAt: string }) => ({
        parentId: String(c.ParentID),
        userId: c.UserID,
        version: c.Version || 0,
        status: c.Status,
        recordedAt: c.RecordedAt,
      }));

      // 3. 付随データ (Accessories) の取得: UserTransport_Settings
      // 子レコードに含まれる全ユーザーIDを抽出
      const userIds = [...new Set(children.map(c => c.userId))];
      const accessories: ScanSourceAccessory[] = [];

      if (userIds.length > 0) {
        try {
          const transportListTitle = readNonEmptyEnv('VITE_SP_LIST_USER_TRANSPORT') ?? 'UserTransport_Settings';
          const transportListPath = buildListPath(transportListTitle);
          // 注意: UserID フィルタを構築。数が極端に多い場合は分割が必要だが、今回は日付指定範囲のため許容
          const chunkedUserIds = [];
          for (let i = 0; i < userIds.length; i += 20) {
            chunkedUserIds.push(userIds.slice(i, i + 20));
          }

          for (const chunk of chunkedUserIds) {
            const userFilters = chunk.map(uid => `UserID eq '${uid}'`).join(' or ');
            const transportUrl = `${transportListPath}/items?$filter=${userFilters}&$select=UserID`;
            
            const tRes = await this.spFetch(transportUrl, { signal });
            const tData = await tRes.json();
            const rawTransport = tData.value || [];
            
            accessories.push(...rawTransport.map((t: { UserID: string }) => ({
              type: 'transport' as const,
              userId: t.UserID,
            })));
          }
        } catch (accError) {
          console.warn('[SharePointDailyRecordRepository] Failed to fetch accessories for integrity scan', accError);
          // アクセサリ取得に失敗しても既存の整合性チェックは継続する
        }
      }

      // 4. スキャナー実行
      return scanDailyRecordIntegrity(parents, children, accessories);
    } catch (error) {
      console.error('[SharePointDailyRecordRepository] Integrity scan failed', error);
      return [];
    }
  }

  /**
   * Load a daily record for a specific date
   */
  async load(date: string): Promise<DailyRecordItem | null> {
    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.load, { date });
    try {
      const item = await this.findItemByDate(date);
      if (!item) {
        finishSpan({ meta: { status: 'ok', found: false } });
        return null;
      }

      // SharePoint item から Zod でパース
      const record = parseSpItem(item);
      if (!record) return null;

      // 正規化された子テーブルから詳細行を取得を試みる
      try {
        const latestVersion = item[DAILY_RECORD_FIELDS.latestVersion] || 0;
        const rowsListTitle = this.getRowsListTitle();
        const rowsListPath = buildListPath(rowsListTitle);
        
        // 最新バージョンに合致する行のみを取得（Version切り替えによるアトミック読込）
        const filter = latestVersion > 0 
          ? `ParentID eq ${item.Id} and Version eq ${latestVersion}`
          : `ParentID eq ${item.Id}`; // バージョンがない時期のデータ

        const res = await this.spFetch(`${rowsListPath}/items?$filter=${filter}&$select=Payload`);
        const json = await res.json();
        const rows = json.value || [];

        if (rows.length > 0) {
          // 子テーブルにデータがあれば、それを優先する
          record.userRows = rows.map((r: { Payload: string }) => JSON.parse(r.Payload));
          auditLog.debug('daily', `Loaded via version v${latestVersion}`, { count: rows.length });
        } else {
          auditLog.debug('daily', 'Loaded from legacy JSON fallback', { count: record.userRows.length });
        }
      } catch (childError) {
        // 子テーブルの取得に失敗しても、親の UserRowsJSON があれば続行
        auditLog.warn('daily', 'Failed to join children, using legacy fallback', { error: String(childError) });
      }

      finishSpan({ meta: { status: 'ok', found: true } });
      return record;
    } catch (error) {
      const safeError = toSafeError(error);
      finishSpan({ meta: { status: 'error' }, error: safeError.message });
      console.error('[SharePointDailyRecordRepository] Load failed', {
        date,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * List daily records within date range
   */
  async list(params: DailyRecordRepositoryListParams & { limit?: number }): Promise<DailyRecordItem[]> {
    if (params.signal?.aborted) {
      return [];
    }

    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.list, {
      range: params.range,
    });
    try {
      const listPath = await this.resolveListPath();
      if (!listPath) {
        const rowAggregateSource = await this.resolveRowAggregateSource();
        if (!rowAggregateSource) {
          finishSpan({ meta: { status: 'ok', itemCount: 0, listMissing: true } });
          return [];
        }
        const aggregated = await this.listFromRowAggregate(rowAggregateSource, params);
        finishSpan({ meta: { status: 'ok', itemCount: aggregated.length, listMode: 'row-aggregate' } });
        return aggregated;
      }

      const { startDate, endDate } = params.range;
      const filter = buildDateRangeFilter(startDate, endDate);

      const queryParams = new URLSearchParams();
      queryParams.set('$filter', filter);
      queryParams.set('$orderby', 'Title desc'); // Newest first

      const limit = params.limit ?? SP_QUERY_LIMITS.default;
      const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);
      queryParams.set('$top', String(safeLimit));
      queryParams.set('$select', [
        'Id',
        DAILY_RECORD_FIELDS.title,
        DAILY_RECORD_FIELDS.recordDate,
        DAILY_RECORD_FIELDS.reporterName,
        DAILY_RECORD_FIELDS.reporterRole,
        DAILY_RECORD_FIELDS.userRowsJSON,
        DAILY_RECORD_FIELDS.userCount,
        DAILY_RECORD_FIELDS.created,
        DAILY_RECORD_FIELDS.modified,
      ].join(','));

      const url = `${listPath}/items?${queryParams.toString()}`;
      // throwOnError: true — エラーは自動 throw
      const response = await this.spFetch(url);

      const payload = (await response.json()) as SharePointResponse<unknown>;
      const items = payload.value ?? [];

      // Parse and filter out invalid items
      const results: DailyRecordItem[] = [];
      for (const item of items) {
        const parsed = parseSpItem(item);
        if (parsed) {
          results.push(parsed);
        }
      }

      finishSpan({ meta: { status: 'ok', itemCount: results.length } });
      return results;
    } catch (error) {
      const safeError = toSafeError(error);
      finishSpan({ meta: { status: 'error' }, error: safeError.message });
      console.error('[SharePointDailyRecordRepository] List failed', {
        range: params.range,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * Approve a daily record for a specific date
   * Updates approval metadata on existing SharePoint item
   */
  async approve(
    input: ApproveRecordInput,
    params?: DailyRecordRepositoryMutationParams,
  ): Promise<DailyRecordItem> {
    if (params?.signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, {
      date: input.date,
      operation: 'approve',
    });
    try {
      const listPath = await this.resolveListPath();
      if (!listPath) {
        throw new Error(
          `Daily records list is not found. Set VITE_SP_DAILY_RECORDS_LIST or VITE_SP_LIST_DAILY (requested: ${this.listTitle})`,
        );
      }

      const existingItem = await this.findItemByDate(input.date, params?.signal) as SharePointItem | null;
      if (!existingItem) {
        throw new Error(`Record not found for date: ${input.date}`);
      }

      // PATCH approval metadata — throwOnError: true
      const updateUrl = `${listPath}/items(${existingItem.Id})`;
      const approvalData = {
        ApprovalStatus: 'approved',
        ApprovedBy: input.approverName,
        ApprovedAt: new Date().toISOString(),
      };

      await this.spFetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;odata=verbose',
          'Accept': 'application/json;odata=verbose',
          'IF-MATCH': existingItem.__metadata?.etag ?? '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: JSON.stringify(approvalData),
      });

      // Re-fetch to get the updated record
      const updated = await this.load(input.date);
      if (!updated) {
        throw new Error('Failed to re-fetch approved record');
      }

      finishSpan({ meta: { status: 'ok' } });
      return { ...updated, approvalStatus: 'approved', approvedBy: input.approverName, approvedAt: approvalData.ApprovedAt };
    } catch (error) {
      const safeError = toSafeError(error);
      finishSpan({ meta: { status: 'error' }, error: safeError.message });
      console.error('[SharePointDailyRecordRepository] Approve failed', {
        date: input.date,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  /**
   * Find SharePoint item by date
   * @private
   */
  private async findItemByDate(
    date: string,
    signal?: AbortSignal
  ): Promise<SharePointItem | null> {
    if (signal?.aborted) {
      return null;
    }

    try {
      const listPath = await this.resolveListPath();
      if (!listPath) {
        return null;
      }

      const queryParams = new URLSearchParams();
      queryParams.set('$filter', `Title eq '${date}'`);
      queryParams.set('$top', '1');
      queryParams.set('$select', [
        'Id',
        DAILY_RECORD_FIELDS.title,
        DAILY_RECORD_FIELDS.recordDate,
        DAILY_RECORD_FIELDS.reporterName,
        DAILY_RECORD_FIELDS.reporterRole,
        DAILY_RECORD_FIELDS.userRowsJSON,
        DAILY_RECORD_FIELDS.userCount,
        DAILY_RECORD_FIELDS.created,
        DAILY_RECORD_FIELDS.modified,
      ].join(','));

      const url = `${listPath}/items?${queryParams.toString()}`;

      try {
        const response = await this.spFetch(url);
        const payload = (await response.json()) as SharePointResponse<unknown>;
        const items = payload.value ?? [];
        return items.length > 0 ? (items[0] as SharePointItem) : null;
      } catch (fetchError) {
        // findItemByDate はルックアップ用途 — HTTP エラーは null に変換
        console.warn('[SharePointDailyRecordRepository] Find by date failed', {
          date,
          error: toSafeError(fetchError).message,
        });
        return null;
      }
    } catch (error) {
      console.warn('[SharePointDailyRecordRepository] Find by date error', {
        date,
        error: toSafeError(error).message,
      });
      return null;
    }
  }


  /**
   * Check if list exists (for diagnostics)
   */
  async checkListExists(): Promise<boolean> {
    try {
      const listPath = await this.resolveListPath();
      return Boolean(listPath);
    } catch (error) {
      console.error('[SharePointDailyRecordRepository] List existence check failed:', error);
      return false;
    }
  }
}
