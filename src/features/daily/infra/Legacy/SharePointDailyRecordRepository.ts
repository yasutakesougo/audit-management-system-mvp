/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable */
import { get as getEnv } from '@/env';
import { fromSpItem } from '@/domain/daily/spMap';

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
} from '../domain/DailyRecordRepository';
import { DailyRecordItemSchema } from '../../schema';

import { 
    DAILY_RECORD_CANONICAL_CANDIDATES,
    DAILY_RECORD_CANONICAL_ESSENTIALS,
    DAILY_RECORD_ROW_AGGREGATE_CANDIDATES,
    DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS,
    DAILY_RECORD_CANONICAL_ENSURE_FIELDS
} from '@/sharepoint/fields/dailyFields';
import { resolveInternalNames, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { getListFieldInternalNames, ensureListExists } from '@/lib/sp/spListSchema';
import { ensureConfig } from '@/lib/spClient';

import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

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
 * SharePoint response type
 */
type SharePointResponse<T> = {
  value?: T[];
};

type CanonicalResolvedFields = {
  title: string;
  recordDate: string;
  reporterName?: string;
  reporterRole?: string;
  userRowsJSON: string;
  userCount?: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  select: string[];
};

type RowAggregateResolvedFields = {
  title: string;
  userId: string;
  recordDate: string;
  status?: string;
  reporterName?: string;
  payload?: string;
  kind?: string;
  group?: string;
  specialNote?: string;
  select: string[];
};

type RowAggregateSource = {
  listPath: string;
  listTitle: string;
  fields: RowAggregateResolvedFields;
};

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : (typeof value === 'number' ? String(value) : undefined);

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

// Removed unused getBool


const canonicalFieldCache = new Map<string, CanonicalResolvedFields | null>();
const rowAggregateFieldCache = new Map<string, RowAggregateResolvedFields | null>();
const provisioningLatch = new Set<string>();

const buildSelect = (fields: Record<string, string | undefined>): string[] => {
  return [
    'Id',
    ...Object.values(fields).filter((v): v is string => typeof v === 'string')
  ].filter((v, i, a) => a.indexOf(v) === i);
};

/**
 * Build list path for API requests
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

// Removed unused normalizeListKey


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
  return `${current}
${incoming}`;
};

/**
 * SharePoint repository options
 */
type SharePointDailyRecordRepositoryOptions = {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
  spFetch?: SpFetchFn;
};

/**
 * SharePoint implementation of DailyRecordRepository
 */
export class SharePointDailyRecordRepository implements DailyRecordRepository {
  private readonly spFetch: SpFetchFn;
  private readonly listTitle: string;
  private readonly listTitleCandidates: string[];
  private resolvedListPath: string | null = null;
  private resolvedRowAggregateSource: RowAggregateSource | null = null;

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
      if (status === 404) return null;
      throw error;
    }
  }

  private async resolveCanonicalFields(listTitle: string): Promise<CanonicalResolvedFields | null> {
    const cacheKey = listTitle.toLowerCase();
    if (canonicalFieldCache.has(cacheKey)) return canonicalFieldCache.get(cacheKey)!;

    const available = await getListFieldInternalNames(this.spFetch, ensureConfig().baseUrl, listTitle).catch(() => null);
    if (!available) return null;

    const resolved = resolveInternalNames(available, DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>) as unknown as CanonicalResolvedFields;

    if (!areEssentialFieldsResolved(resolved, DAILY_RECORD_CANONICAL_ESSENTIALS)) return null;

    resolved.select = buildSelect(resolved);
    canonicalFieldCache.set(cacheKey, resolved);
    return resolved as CanonicalResolvedFields;
  }

  private async resolveAggregatedFields(listTitle: string): Promise<RowAggregateResolvedFields | null> {
    const cacheKey = listTitle.toLowerCase();
    if (rowAggregateFieldCache.has(cacheKey)) return rowAggregateFieldCache.get(cacheKey)!;

    const available = await getListFieldInternalNames(this.spFetch, ensureConfig().baseUrl, listTitle).catch(() => null);
    if (!available) return null;

    const resolved = resolveInternalNames(available, DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>) as unknown as RowAggregateResolvedFields;

    if (!areEssentialFieldsResolved(resolved, DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS)) return null;

    resolved.select = buildSelect(resolved);
    rowAggregateFieldCache.set(cacheKey, resolved);
    return resolved as RowAggregateResolvedFields;
  }

  private async resolveSource(): Promise<{
    canonical?: { listPath: string; fields: CanonicalResolvedFields };
    rowAggregate?: RowAggregateSource;
  }> {
    if (this.resolvedListPath) {
      const fields = await this.resolveCanonicalFields(this.listTitle);
      if (fields) return { canonical: { listPath: this.resolvedListPath, fields } };
    }
    if (this.resolvedRowAggregateSource) {
      return { rowAggregate: this.resolvedRowAggregateSource };
    }

    const availableTitles = await this.getAvailableListTitles();
    if (!availableTitles) return {};

    const titleLookup = new Map(availableTitles.map(t => [t.toLowerCase(), t]));
    const candidates = [...new Set([this.listTitle, ...this.listTitleCandidates])];

    // Priority 1: Canonical structure
    for (const title of candidates) {
      const matched = titleLookup.get(title.toLowerCase());
      if (!matched) continue;

      const fields = await this.resolveCanonicalFields(matched);
      if (fields) {
        this.resolvedListPath = buildListPath(matched);
        return { canonical: { listPath: this.resolvedListPath, fields } };
      }
    }

    // Priority 2: Row-aggregate structure
    const aggFallbacks = [
      'SupportRecord_Daily',
      'DailyActivityRecords',
      'SupportProcedureRecord_Daily',
      'DailyBehaviorRecords（DO）',
    ];
    for (const title of [...candidates, ...aggFallbacks]) {
      const matched = titleLookup.get(title.toLowerCase());
      if (!matched) continue;

      const fields = await this.resolveAggregatedFields(matched);
      if (fields) {
         this.resolvedRowAggregateSource = {
           listPath: buildListPath(matched),
           listTitle: matched,
           fields
         };
         return { rowAggregate: this.resolvedRowAggregateSource };
      }
    }

    // Priority 3: Auto-provisioning (if canonical requested but missing)
    if (!provisioningLatch.has(this.listTitle.toLowerCase())) {
      provisioningLatch.add(this.listTitle.toLowerCase());
      try {
        await ensureListExists(this.spFetch, this.listTitle, DAILY_RECORD_CANONICAL_ENSURE_FIELDS);
        const fields = await this.resolveCanonicalFields(this.listTitle);
        if (fields) {
          this.resolvedListPath = buildListPath(this.listTitle);
          return { canonical: { listPath: this.resolvedListPath, fields } };
        }
      } catch (e) {
        console.warn('[SharePointDailyRecordRepository] Auto-provision failed', e);
      }
    }

    return {};
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
    queryParams.set('$select', source.fields.select.join(','));

    const response = await this.spFetch(`${source.listPath}/items?${queryParams.toString()}`);
    const payload = (await response.json()) as SharePointResponse<Record<string, unknown>>;
    const rows = payload.value ?? [];

    const grouped = new Map<string, DailyRecordItem>();
    const userRowIndexByDate = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const normalized = this.normalizeRowForDailyMap(row);
      const rowDate = normalizeDateToYmd(row[source.fields.recordDate]);
      const rowUserId = getString(row[source.fields.userId]);

      if (!rowDate || !rowUserId) continue;
      
      let parsed;
      try {
        parsed = fromSpItem(normalized as Record<string, unknown>, 'A');

      } catch {
        continue;
      }
      
      const date = rowDate;
      if (date < params.range.startDate || date > params.range.endDate) continue;

      const reporterName = parsed.reporter?.name?.trim() || '記録者不明';
      const reporterRole = parsed.kind === 'A' ? (parsed.data.specialNotes ? '記録' : '担当') : '担当';
      const specialNotes =
        parsed.kind === 'A'
          ? parsed.data.specialNotes ?? ''
          : parsed.data.notes ?? '';
      
      const userId = rowUserId;
      const userName = parsed.userName?.trim() || userId;

      const rowData = {
        userId,
        userName,
        amActivity: parsed.kind === 'A' ? (parsed.data.amActivities[0] ?? '') : '',
        pmActivity: parsed.kind === 'A' ? (parsed.data.pmActivities[0] ?? '') : '',
        lunchAmount: parsed.kind === 'A' ? (parsed.data.mealAmount ?? '') : '',
        problemBehavior: (parsed.kind === 'A' && parsed.data.problemBehavior) ? parsed.data.problemBehavior : EMPTY_PROBLEM_BEHAVIOR,
        specialNotes,
        behaviorTags: (parsed.kind === 'A' && parsed.data.behaviorTags) ? parsed.data.behaviorTags : [],
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
      const rowIndex = userRowIndexByDate.get(date)!;
      const existingIndex = rowIndex.get(userId);
      if (existingIndex === undefined) {
        rowIndex.set(userId, record.userRows.length);
        record.userRows.push(rowData);
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

  private normalizeRowForDailyMap(row: Record<string, unknown>): Record<string, unknown> {

    return {
      ...row,
      Id: row.Id,
      Title: row.Title,
      cr013_date: row[DAILY_RECORD_ROW_AGGREGATE_CANDIDATES.recordDate.find(c => c in row) || ''],
      cr013_status: row[DAILY_RECORD_ROW_AGGREGATE_CANDIDATES.status.find(c => c in row) || ''],
      cr013_payload: row[DAILY_RECORD_ROW_AGGREGATE_CANDIDATES.payload.find(c => c in row) || ''],
      cr013_kind: row[DAILY_RECORD_ROW_AGGREGATE_CANDIDATES.kind.find(c => c in row) || ''],
    };
  }

  private parseSpItemWithFields(item: Record<string, unknown>, fields: CanonicalResolvedFields): DailyRecordItem | null {
    try {
      const rawUserRows = getString(item[fields.userRowsJSON]);
      if (!rawUserRows) return null;

      const userRows = JSON.parse(rawUserRows);
      const record: Record<string, unknown> = {

        id: String(item.Id),
        date: normalizeDateToYmd(item[fields.title]) || '',
        reporter: {
          name: getString(item[fields.reporterName ?? '']) || '',
          role: getString(item[fields.reporterRole ?? '']) || '',
        },
        userRows: Array.isArray(userRows) ? userRows : [],
        userCount: getNumber(item[fields.userCount ?? '']) || 0,
        createdAt: getString(item.Created),
        modifiedAt: getString(item.Modified),
        approvalStatus: getString(item[fields.approvalStatus ?? '']) as 'pending' | 'approved' | 'rejected' | undefined,

        approvedBy: getString(item[fields.approvedBy ?? '']),
        approvedAt: getString(item[fields.approvedAt ?? '']),
      };

      return DailyRecordItemSchema.parse(record);
    } catch (e) {
      console.warn('[SharePointDailyRecordRepository] Failed to parse item', item.Id, e);
      return null;
    }
  }

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
      const source = await this.resolveSource();
      if (!source.canonical) {
        throw new Error(`Canonical Daily records list not found (requested: ${this.listTitle})`);
      }
      const { listPath, fields } = source.canonical;
      const existingItem = await this.findItemByDate(input.date);
      const mode = existingItem ? 'update' : 'create';

      const userRowsJSON = JSON.stringify(input.userRows);
      const itemData: Record<string, unknown> = {
        [fields.title]: input.date,
        [fields.recordDate]: new Date(input.date).toISOString(),
        [fields.userRowsJSON]: userRowsJSON,
      };

      if (fields.reporterName) itemData[fields.reporterName] = input.reporter.name;
      if (fields.reporterRole) itemData[fields.reporterRole] = input.reporter.role;
      if (fields.userCount) itemData[fields.userCount] = input.userRows.length;

      if (existingItem) {
        await this.spFetch(`${listPath}/items(${existingItem.Id})`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': existingItem.__metadata?.etag ?? '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify(itemData),
        });
      } else {
        await this.spFetch(`${listPath}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
          },
          body: JSON.stringify(itemData),
        });
      }
      finishSpan({ meta: { status: 'ok', mode } });
    } catch (error) {
      const safeError = toSafeError(error);
      finishSpan({ meta: { status: 'error' }, error: safeError.message });
      throw safeError;
    }
  }

  async load(date: string): Promise<DailyRecordItem | null> {
    try {
      const source = await this.resolveSource();
      
      if (source.canonical) {
        const { listPath, fields } = source.canonical;
        const queryParams = new URLSearchParams();
        queryParams.set('$filter', `${fields.title} eq '${date}'`);
        queryParams.set('$top', '1');
        queryParams.set('$select', fields.select.join(','));

        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`);
        const payload = (await response.json()) as SharePointResponse<Record<string, unknown>>;
        const items = payload.value ?? [];
        if (items.length > 0) {
          return this.parseSpItemWithFields(items[0], fields);
        }
      }

      if (source.rowAggregate) {
        const items = await this.listFromRowAggregate(source.rowAggregate, {
          range: { startDate: date, endDate: date }
        });
        return items.length > 0 ? items[0] : null;
      }

      return null;
    } catch (error) {
      console.error('[SharePointDailyRecordRepository] Load failed', { date, error: toSafeError(error).message });
      return null;
    }
  }

  async list(params: DailyRecordRepositoryListParams & { limit?: number }): Promise<DailyRecordItem[]> {
    if (params.signal?.aborted) return [];

    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.list, { range: params.range });
    try {
      const source = await this.resolveSource();
      
      if (source.canonical) {
        const { listPath, fields } = source.canonical;
        const { startDate, endDate } = params.range;
        const filter = `${fields.title} ge '${startDate}' and ${fields.title} le '${endDate}'`;

        const queryParams = new URLSearchParams();
        queryParams.set('$filter', filter);
        queryParams.set('$orderby', `${fields.title} desc`);

        const limit = params.limit ?? SP_QUERY_LIMITS.default;
        queryParams.set('$top', String(Math.min(limit, SP_QUERY_LIMITS.hardMax)));
        queryParams.set('$select', fields.select.join(','));

        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`);
        const payload = (await response.json()) as SharePointResponse<Record<string, unknown>>;
        
        const results = (payload.value ?? [])
          .map(item => this.parseSpItemWithFields(item, fields))
          .filter((item): item is DailyRecordItem => item !== null);
          
        finishSpan({ meta: { status: 'ok', itemCount: results.length } });
        return results;
      }

      if (source.rowAggregate) {
        const aggregated = await this.listFromRowAggregate(source.rowAggregate, params);
        finishSpan({ meta: { status: 'ok', itemCount: aggregated.length, mode: 'row-aggregate' } });
        return aggregated;
      }

      finishSpan({ meta: { status: 'ok', itemCount: 0, missing: true } });
      return [];
    } catch (error) {
      const safeError = toSafeError(error);
      finishSpan({ meta: { status: 'error' }, error: safeError.message });
      throw safeError;
    }
  }

  async approve(
    input: ApproveRecordInput,
    _params?: DailyRecordRepositoryMutationParams,

  ): Promise<DailyRecordItem> {
    const source = await this.resolveSource();
    if (!source.canonical) {
      throw new Error(`Canonical list not found for approval (requested: ${this.listTitle})`);
    }

    const { listPath, fields } = source.canonical;
    const existing = await this.findItemByDate(input.date);
    if (!existing) throw new Error(`Record not found for approval: ${input.date}`);

    const approvalStatusField = fields.approvalStatus || 'ApprovalStatus';
    const approvedByField = fields.approvedBy || 'ApprovedBy';
    const approvedAtField = fields.approvedAt || 'ApprovedAt';

    const patchData = {
      [approvalStatusField]: 'approved',
      [approvedByField]: input.approverName,
      [approvedAtField]: new Date().toISOString(),
    };

    await this.spFetch(`${listPath}/items(${existing.Id})`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        'Accept': 'application/json;odata=verbose',
        'X-HTTP-Method': 'MERGE',
        'IF-MATCH': existing.__metadata?.etag ?? '*',
      },
      body: JSON.stringify(patchData),
    });

    const updated = await this.load(input.date);
    if (!updated) throw new Error('Failed to reload approved record');
    return updated;
  }

  private async findItemByDate(date: string): Promise<Record<string, unknown> | null> {
    const source = await this.resolveSource();
    if (!source.canonical) return null;

    const { listPath, fields } = source.canonical;
    const queryParams = new URLSearchParams();
    queryParams.set('$filter', `${fields.title} eq '${date}'`);
    queryParams.set('$top', '1');
    queryParams.set('$select', 'Id,__metadata');

    try {
      const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`);
      const payload = (await response.json()) as SharePointResponse<Record<string, unknown>>;
      const items = payload.value ?? [];
      return items.length > 0 ? items[0] : null;
    } catch {
      return null;
    }
  }


  async checkListExists(): Promise<boolean> {
    const source = await this.resolveSource();
    return Boolean(source.canonical || source.rowAggregate);
  }
}
