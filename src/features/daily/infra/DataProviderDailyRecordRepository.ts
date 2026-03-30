import { fromSpItem } from '@/domain/daily/spMap';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';

import type {
  ApproveRecordInput,
  DailyRecordItem,
  DailyRecordRepository,
  DailyRecordRepositoryListParams,
  DailyRecordRepositoryMutationParams,
  SaveDailyRecordInput,
} from '../domain/DailyRecordRepository';
import { DailyRecordItemSchema } from '../schema';

import { 
  DAILY_RECORD_CANONICAL_CANDIDATES,
  DAILY_RECORD_CANONICAL_ESSENTIALS,
  DAILY_RECORD_ROW_AGGREGATE_CANDIDATES,
  DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS,
} from '@/sharepoint/fields/dailyFields';
import { resolveInternalNames, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

// Unused function removed (getHttpStatus)


const normalizeDateToYmd = (raw: unknown): string | null => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
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

type SourceResolution = {
  canonical?: { title: string; fields: CanonicalResolvedFields };
  rowAggregate?: { title: string; fields: RowAggregateResolvedFields };
};

// Unused fieldCache removed


/**
 * DataProviderDailyRecordRepository
 * 
 * IDataProvider ベースの DailyRecordRepository 実装。
 * SharePoint の Canonical (一括JSON型) と RowAggregate (1件1行型) の両方をサポートしつつ、
 * 実行時 backend (Memory/SharePoint) の差異を隠蔽する。
 */
export class DataProviderDailyRecordRepository implements DailyRecordRepository {
  private readonly provider: IDataProvider;
  private readonly primaryTitle: string;
  private readonly candidates: string[];
  
  private resolution: SourceResolution | null = null;

  constructor(options: {
    provider: IDataProvider;
    listTitle: string;
    candidates?: string[];
  }) {
    this.provider = options.provider;
    this.primaryTitle = options.listTitle;
    this.candidates = options.candidates ?? [
      'SupportRecord_Daily',
      'SupportProcedureRecord_Daily',
      'DailyActivityRecords',
      'DailyRecords',
    ];
  }

  public async save(input: SaveDailyRecordInput, params?: DailyRecordRepositoryMutationParams): Promise<void> {
    if (params?.signal?.aborted) throw new Error('Aborted');

    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, { date: input.date });
    try {
      const source = await this.resolveSource();
      if (!source.canonical) throw new Error('Canonical Daily records list not found or unavailable for write.');

      const { title, fields } = source.canonical;
      const existing = await this.load(input.date);

      const request: Record<string, unknown> = {
        [fields.title]: input.date,
        [fields.recordDate]: new Date(input.date).toISOString(),
        [fields.userRowsJSON]: JSON.stringify(input.userRows),
      };

      if (fields.reporterName) request[fields.reporterName] = input.reporter.name;
      if (fields.reporterRole) request[fields.reporterRole] = input.reporter.role;
      if (fields.userCount) request[fields.userCount] = input.userRows.length;

      if (existing && existing.id) {
        await this.provider.updateItem(title, existing.id, request);
      } else {
        await this.provider.createItem(title, request);
      }
      
      finishSpan({ meta: { status: 'ok' } });
    } catch (e) {
      finishSpan({ meta: { status: 'error' }, error: String(e) });
      throw e;
    }
  }

  public async load(date: string): Promise<DailyRecordItem | null> {
    try {
      const source = await this.resolveSource();
      if (source.canonical) {
        const { title, fields } = source.canonical;
        const items = await this.provider.listItems<Record<string, unknown>>(title, {

          filter: `${fields.title} eq '${date}'`,
          top: 1,
          select: fields.select,
        });
        if (items.length > 0) return this.parseCanonical(items[0], fields);
      }
      if (source.rowAggregate) {
        const items = await this.listFromRowAggregate(source.rowAggregate, {
          range: { startDate: date, endDate: date },
        });
        return items.length > 0 ? items[0] : null;
      }
      return null;
    } catch (e) {
      auditLog.error('daily', 'load_failed', { date, error: String(e) });
      return null;
    }
  }

  public async list(params: DailyRecordRepositoryListParams): Promise<DailyRecordItem[]> {
    if (params.signal?.aborted) return [];

    const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.list, { range: params.range });
    try {
      const source = await this.resolveSource();
      if (source.canonical) {
        const { title, fields } = source.canonical;
        const filter = `${fields.title} ge '${params.range.startDate}' and ${fields.title} le '${params.range.endDate}'`;
        const items = await this.provider.listItems<Record<string, unknown>>(title, {

          filter,
          orderby: `${fields.title} desc`,
          top: SP_QUERY_LIMITS.default,
          select: fields.select,
        });
        const results = items.map(it => this.parseCanonical(it, fields)).filter((it): it is DailyRecordItem => it !== null);
        finishSpan({ meta: { status: 'ok', count: results.length } });
        return results;
      }
      if (source.rowAggregate) {
        const items = await this.listFromRowAggregate(source.rowAggregate, params);
        finishSpan({ meta: { status: 'ok', count: items.length, mode: 'row-aggregate' } });
        return items;
      }
      return [];
    } catch (e) {
      finishSpan({ meta: { status: 'error' }, error: String(e) });
      return [];
    }
  }

  public async approve(input: ApproveRecordInput, _params?: DailyRecordRepositoryMutationParams): Promise<DailyRecordItem> {

    const source = await this.resolveSource();
    if (!source.canonical) throw new Error('Canonical list not found for approval.');

    const { title, fields } = source.canonical;
    const existing = await this.load(input.date);
    if (!existing || !existing.id) throw new Error(`Record not found for date: ${input.date}`);

    const patch: Record<string, unknown> = {
      [fields.approvalStatus || 'ApprovalStatus']: 'approved',
      [fields.approvedBy || 'ApprovedBy']: input.approverName,
      [fields.approvedAt || 'ApprovedAt']: new Date().toISOString(),
    };

    await this.provider.updateItem(title, existing.id, patch);
    const updated = await this.load(input.date);
    if (!updated) throw new Error('Reload failed');
    return updated;
  }

  public async scanIntegrity(_dates: string[], _signal?: AbortSignal): Promise<import('../domain/integrity/dailyIntegrityChecker').DailyIntegrityException[]> {
    // DataProvider 版は現在 Canonical (単一JSON) または RowAggregate の抽象化を提供
    // 物理的な Parent/Child 分離スキャンは現在 SharePoint 直接実装に委ねられているため、
    // DataProvider 実装レベルでは将来の共通ロジックのために空配列を返す。
    return [];
  }

  public async checkListExists(): Promise<boolean> {
    const source = await this.resolveSource();
    return Boolean(source.canonical || source.rowAggregate);
  }

  // ── Resolution Logic ─────────────────────────────────────────

  private async resolveSource(): Promise<SourceResolution> {
    if (this.resolution) return this.resolution;

    const titlesToTry = [...new Set([this.primaryTitle, ...this.candidates])];
    
    // 1. Try Canonical
    for (const title of titlesToTry) {
      const available = await this.provider.getFieldInternalNames(title).catch(() => null);
      if (!available) continue;

      const resolved = resolveInternalNames(available, DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>) as unknown as CanonicalResolvedFields;
      if (areEssentialFieldsResolved(resolved as unknown as Record<string, string | undefined>, DAILY_RECORD_CANONICAL_ESSENTIALS as unknown as string[])) {

        resolved.select = ['Id', 'Created', 'Modified', ...Object.values(resolved).filter((v): v is string => typeof v === 'string')];
        this.resolution = { canonical: { title, fields: resolved as CanonicalResolvedFields } };
        return this.resolution;
      }
    }

    // 2. Try RowAggregate
    for (const title of titlesToTry) {
      const available = await this.provider.getFieldInternalNames(title).catch(() => null);
      if (!available) continue;

      const resolved = resolveInternalNames(available, DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>) as unknown as RowAggregateResolvedFields;
      if (areEssentialFieldsResolved(resolved as unknown as Record<string, string | undefined>, DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS as unknown as string[])) {

        resolved.select = ['Id', 'Title', ...Object.values(resolved).filter((v): v is string => typeof v === 'string')];
        this.resolution = { rowAggregate: { title, fields: resolved as RowAggregateResolvedFields } };
        return this.resolution;
      }
    }

    return {};
  }

  private async listFromRowAggregate(
    source: { title: string; fields: RowAggregateResolvedFields },
    params: DailyRecordRepositoryListParams
  ): Promise<DailyRecordItem[]> {
    const items = await this.provider.listItems<Record<string, unknown>>(source.title, {

      select: source.fields.select,
      orderby: 'Id desc', // Or recordDate desc
      top: 200,
    });

    const grouped = new Map<string, DailyRecordItem>();

    for (const row of items) {
      const rowDate = normalizeDateToYmd(row[source.fields.recordDate]);
      if (!rowDate || rowDate < params.range.startDate || rowDate > params.range.endDate) continue;

      const userId = String(row[source.fields.userId] || '');
      if (!userId) continue;

      // Mock normalization for `fromSpItem` which expects specific keys
      const normalizedRow = {
        ...row,
        Id: row.Id,
        Title: row.Title,
        cr013_date: row[source.fields.recordDate],
        cr013_payload: row[source.fields.payload || ''],
        cr013_kind: row[source.fields.kind || ''],
      };

      try {
        const parsed = fromSpItem(normalizedRow as Record<string, unknown>, 'A');

        const reporterName = parsed.reporter?.name?.trim() || '記録者不明';
        
        const rowData = {
          userId,
          userName: parsed.userName?.trim() || userId,
          amActivity: (parsed.kind === 'A' ? parsed.data.amActivities[0] : '') || '',
          pmActivity: (parsed.kind === 'A' ? parsed.data.pmActivities[0] : '') || '',
          lunchAmount: (parsed.kind === 'A' ? parsed.data.mealAmount : '') || '',
          problemBehavior: (parsed.kind === 'A' && parsed.data.problemBehavior) ? parsed.data.problemBehavior : EMPTY_PROBLEM_BEHAVIOR,
          specialNotes: parsed.kind === 'A' ? (parsed.data.specialNotes || '') : (parsed.data.notes || ''),
          behaviorTags: (parsed.kind === 'A' && parsed.data.behaviorTags) ? parsed.data.behaviorTags : [],
        };

        if (!grouped.has(rowDate)) {
          grouped.set(rowDate, {
            id: `agg-${rowDate}`,
            date: rowDate,
            reporter: { name: reporterName, role: '担当' },
            userRows: [rowData],
          });
        } else {
          const rec = grouped.get(rowDate)!;
          const existingIdx = rec.userRows.findIndex(u => u.userId === userId);
          if (existingIdx === -1) {
            rec.userRows.push(rowData);
          } else {
            const existing = rec.userRows[existingIdx];
            existing.amActivity = existing.amActivity || rowData.amActivity;
            existing.pmActivity = existing.pmActivity || rowData.pmActivity;
            existing.lunchAmount = existing.lunchAmount || rowData.lunchAmount;
            existing.specialNotes = mergeSpecialNotes(existing.specialNotes, rowData.specialNotes);
          }
        }
      } catch {


        // Skip invalid rows
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  private parseCanonical(item: Record<string, unknown>, fields: CanonicalResolvedFields): DailyRecordItem | null {

    try {
      const userRows = JSON.parse(item[fields.userRowsJSON] as string || '[]');
      const record: Record<string, unknown> = {

        id: String(item.Id),
        date: normalizeDateToYmd(item[fields.title]) || '',
        reporter: {
          name: String(item[fields.reporterName ?? ''] || ''),
          role: String(item[fields.reporterRole ?? ''] || ''),
        },
        userRows: Array.isArray(userRows) ? userRows : [],
        userCount: Number(item[fields.userCount ?? ''] || 0),
        createdAt: String(item.Created || ''),
        modifiedAt: String(item.Modified || ''),
        approvalStatus: item[fields.approvalStatus ?? ''],
        approvedBy: item[fields.approvedBy ?? ''],
        approvedAt: item[fields.approvedAt ?? ''],
      };
      return DailyRecordItemSchema.parse(record);
    } catch {
      return null;
    }
  }
}
