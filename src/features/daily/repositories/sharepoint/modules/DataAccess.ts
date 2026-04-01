import type { SpFetchFn } from '@/lib/sp/spLists';
import { 
    DAILY_RECORD_FIELDS, 
    DAILY_RECORD_ROWS_FIELDS, 
    type SharePointItem, 
    type SharePointResponse 
} from '../constants';
import { 
    buildListPath, 
    buildDateRangeFilter 
} from '../utils/Helpers';
import { parseSpItem } from '../utils/Mappers';
import type { DailyRecordItem, DailyRecordRepositoryListParams } from '@/features/daily/domain/legacy/DailyRecordRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';
import { auditLog } from '@/lib/debugLogger';

export class DailyRecordDataAccess {
    constructor(private readonly spFetch: SpFetchFn) {}

    public async load(date: string, listPath: string, rowsListTitle: string): Promise<DailyRecordItem | null> {
        const item = await this.findItemByDate(date, listPath);
        if (!item) return null;

        const record = parseSpItem(item);
        if (!record) return null;

        try {
            const latestVersion = item[DAILY_RECORD_FIELDS.latestVersion] || 0;
            const rowsListPath = buildListPath(rowsListTitle);
            const filter = latestVersion > 0
                ? `${DAILY_RECORD_ROWS_FIELDS.parentId} eq ${item.Id} and ${DAILY_RECORD_ROWS_FIELDS.version} eq ${latestVersion}`
                : `${DAILY_RECORD_ROWS_FIELDS.parentId} eq ${item.Id}`;

            const res = await this.spFetch(`${rowsListPath}/items?$filter=${filter}&$select=Payload`);
            const json = await res.json();
            const rows = json.value || [];

            if (rows.length > 0) {
                record.userRows = rows.map((r: { Payload: string }) => JSON.parse(r.Payload));
                auditLog.debug('daily', `Loaded via version v${latestVersion}`, { count: rows.length });
            } else {
                auditLog.debug('daily', 'Loaded from legacy JSON fallback', { count: record.userRows.length });
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
        const filter = buildDateRangeFilter(params.range.startDate, params.range.endDate);
        const limit = params.limit ?? SP_QUERY_LIMITS.default;
        const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);

        const queryParams = new URLSearchParams();
        queryParams.set('$filter', filter);
        queryParams.set('$orderby', 'Title desc');
        queryParams.set('$top', String(safeLimit));
        queryParams.set('$select', [
            'Id', DAILY_RECORD_FIELDS.title, DAILY_RECORD_FIELDS.recordDate, 
            DAILY_RECORD_FIELDS.reporterName, DAILY_RECORD_FIELDS.reporterRole, 
            DAILY_RECORD_FIELDS.userRowsJSON, DAILY_RECORD_FIELDS.userCount, 
            DAILY_RECORD_FIELDS.created, DAILY_RECORD_FIELDS.modified
        ].join(','));

        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`);
        const payload = (await response.json()) as SharePointResponse<unknown>;
        return (payload.value ?? [])
            .map(item => parseSpItem(item))
            .filter((p): p is DailyRecordItem => Boolean(p));
    }

    public async findItemByDate(date: string, listPath: string, signal?: AbortSignal): Promise<SharePointItem | null> {
        const queryParams = new URLSearchParams();
        queryParams.set('$filter', `${DAILY_RECORD_FIELDS.title} eq '${date}'`);
        queryParams.set('$top', '1');
        queryParams.set('$select', [
            'Id', DAILY_RECORD_FIELDS.title, DAILY_RECORD_FIELDS.recordDate, 
            DAILY_RECORD_FIELDS.reporterName, DAILY_RECORD_FIELDS.reporterRole, 
            DAILY_RECORD_FIELDS.userRowsJSON, DAILY_RECORD_FIELDS.userCount, 
            DAILY_RECORD_FIELDS.created, DAILY_RECORD_FIELDS.modified,
            DAILY_RECORD_FIELDS.latestVersion
        ].join(','));

        try {
            const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`, { signal });
            const payload = (await response.json()) as SharePointResponse<SharePointItem>;
            const items = payload.value ?? [];
            return items.length > 0 ? items[0] : null;
        } catch (error) {
            console.warn('[DailyRecordDataAccess] findItemByDate failed', { date, error });
            return null;
        }
    }
}
