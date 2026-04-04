/**
 * DailyRecord DataAccess — GenericDataAccess 利用版
 *
 * ドメイン固有の washRow + parseSpItem マッピングと
 * 親子リスト join ロジックのみ担当。
 * SP REST クエリ構築と fetch は GenericDataAccess に委譲。
 */
import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    type RawSharePointItem,
} from '../constants';
import {
    buildListPath,
    buildDateRangeFilter
} from '../utils/Helpers';
import { parseSpItem } from '../utils/Mappers';
import type { DailyRecordItem, DailyRecordRepositoryListParams } from '@/features/daily/domain/legacy/DailyRecordRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';
import { auditLog } from '@/lib/debugLogger';
import { DailyRecordSchemaResolver } from './SchemaResolver';
import { washRow, resolveInternalNames } from '@/lib/sp/helpers';
import { DAILY_RECORD_CANONICAL_CANDIDATES, DAILY_RECORD_ROW_AGGREGATE_CANDIDATES } from '@/sharepoint/fields/dailyFields';
import {
    buildSelectFromResolved,
    spFetchItems,
    spFindOne,
} from '@/lib/sp/GenericDataAccess';

export class DailyRecordDataAccess {
    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly schema: DailyRecordSchemaResolver
    ) {}

    public async load(date: string, listPath: string, rowsListTitle: string): Promise<DailyRecordItem | null> {
        const item = await this.findItemByDate(date, listPath);
        if (!item) return null;

        const resolved = await this.schema.getResolvedCanonicalNames();
        const washedItem = washRow(item, DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>, resolved);

        const record = parseSpItem(washedItem);
        if (!record) return null;

        // Daily 固有: 親子リスト join
        try {
            const latestVersionField = resolved.latestVersion || 'LatestVersion';
            const latestVersion = (item as Record<string, unknown>)[latestVersionField] as number || 0;
            const rowsListPath = buildListPath(rowsListTitle);

            // For children, resolve their field names
            const rowsFieldsRes = await this.spFetch(`${rowsListPath}/fields?$select=InternalName`);
            const rowsFieldsJson = await rowsFieldsRes.json();
            const availableRowFields = new Set<string>((rowsFieldsJson.value || []).map((f: { InternalName: string }) => f.InternalName));
            const resolvedRows = resolveInternalNames(availableRowFields, DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>);

            const parentIdField = resolvedRows.ParentID || 'Parent_x0020_ID';
            const versionField = resolvedRows.version || 'Version';
            const payloadField = resolvedRows.payload || 'Payload';

            const filter = latestVersion > 0
                ? `${parentIdField} eq ${item.Id} and ${versionField} eq ${latestVersion}`
                : `${parentIdField} eq ${item.Id}`;

            const rows = await spFetchItems<Record<string, unknown>>(
                this.spFetch, rowsListPath,
                { filter, select: payloadField },
                'DailyRows',
            );

            if (rows.length > 0) {
                record.userRows = rows.map((r) => JSON.parse(r[payloadField] as string));
                auditLog.debug('daily', `Loaded via version v${latestVersion}`, { count: rows.length });
                auditLog.info('sp', 'sp:fetch_fallback_success', { list: 'DailyRows', mode: 'versioned' });
            } else {
                auditLog.debug('daily', 'Loaded from legacy JSON fallback', { count: record.userRows.length });
                auditLog.info('sp', 'sp:fetch_fallback_success', { list: 'Daily', mode: 'legacy_json' });
            }
        } catch (childError) {
            auditLog.warn('daily', 'Failed to join children, using legacy fallback', { error: String(childError) });
        }

        return record;
    }

    public async list(
        params: DailyRecordRepositoryListParams & { limit?: number },
        listPath: string
    ): Promise<DailyRecordItem[]> {
        const resolved = await this.schema.getResolvedCanonicalNames();
        const filter = buildDateRangeFilter(params.range.startDate, params.range.endDate);
        const limit = params.limit ?? SP_QUERY_LIMITS.default;
        const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);

        const select = buildSelectFromResolved(resolved);

        const items = await spFetchItems<RawSharePointItem>(
            this.spFetch, listPath,
            {
                filter,
                orderby: 'Title desc',
                top: safeLimit,
                select,
            },
            'Daily',
        );

        return items
            .map(item => {
                const washed = washRow(item, DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>, resolved);
                return parseSpItem(washed);
            })
            .filter((p): p is DailyRecordItem => Boolean(p));
    }

    public async findItemByDate(date: string, listPath: string, signal?: AbortSignal): Promise<RawSharePointItem | null> {
        const resolved = await this.schema.getResolvedCanonicalNames();
        const titleField = resolved.title || 'Title';
        const select = buildSelectFromResolved(resolved);

        return spFindOne<RawSharePointItem>(
            this.spFetch, listPath,
            {
                filter: `${titleField} eq '${date}'`,
                select,
                signal,
            },
            'Daily',
        );
    }
}
