import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    DAILY_RECORD_FIELDS,
    type RawSharePointItem,
    type SharePointResponse,
    type ResolvedRowsFields
} from '../constants';
import {
    buildListPath,
    buildDateRangeFilter
} from '../utils/Helpers';
import { parseSpItem } from '../utils/Mappers';
import type { DailyRecordItem, DailyRecordRepositoryListParams } from '@/features/daily/domain/legacy/DailyRecordRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';
import { auditLog } from '@/lib/debugLogger';
import { buildCurrentVersionChildFilter } from '@/features/daily/domain/persistence/dailyRecordPersistence';

const PARENT_FILTER_CHUNK_SIZE = 20;

type CurrentChildRow = Record<string, unknown>;

export class DailyRecordDataAccess {
    constructor(private readonly spFetch: SpFetchFn) {}

    private parseUserRows(rows: CurrentChildRow[], resolvedRowsFields: ResolvedRowsFields): DailyRecordItem['userRows'] {
        const orderedRows = resolvedRowsFields.rowNo
            ? [...rows].sort((a, b) => Number(a[resolvedRowsFields.rowNo!] ?? 0) - Number(b[resolvedRowsFields.rowNo!] ?? 0))
            : rows;

        return orderedRows
            .map((row) => {
                const payloadJson = row[resolvedRowsFields.payload] as string | undefined;
                return payloadJson ? JSON.parse(payloadJson) : null;
            })
            .filter((row): row is DailyRecordItem['userRows'][number] => Boolean(row));
    }

    private assertCommittedVersionHasRows(parentId: number, latestVersion: number, rows: CurrentChildRow[]): void {
        if (latestVersion > 0 && rows.length === 0) {
            throw new Error(
                `[DAILY-RECORD-PERSISTENCE-V1] Parent ${parentId} points to LatestVersion ${latestVersion}, but no current-version child rows were found.`,
            );
        }
    }

    public async load(
        date: string,
        listPath: string,
        rowsListTitle: string,
        resolvedRowsFields: ResolvedRowsFields
    ): Promise<DailyRecordItem | null> {
        const item = await this.findItemByDate(date, listPath);
        if (!item) return null;

        const record = parseSpItem(item);
        if (!record) return null;

        const latestVersion = Number(item.LatestVersion ?? 0) || 0;
        try {
            const rowsListPath = buildListPath(rowsListTitle);
            const filter = buildCurrentVersionChildFilter(
                resolvedRowsFields.parentId,
                item.Id,
                resolvedRowsFields.version,
                latestVersion,
            );
            const selectFields = [resolvedRowsFields.payload];
            if (resolvedRowsFields.rowNo) selectFields.push(resolvedRowsFields.rowNo);

            const res = await this.spFetch(
                `${rowsListPath}/items?$filter=${encodeURIComponent(filter)}&$select=${selectFields.join(',')}`,
            );
            if (!res.ok) {
                throw new Error(`Current-version child read failed with HTTP ${res.status}`);
            }

            const json = await res.json();
            const rows = (json.value || []) as CurrentChildRow[];
            this.assertCommittedVersionHasRows(item.Id, latestVersion, rows);

            if (rows.length > 0) {
                record.userRows = this.parseUserRows(rows, resolvedRowsFields);
                auditLog.debug('daily', `Loaded via version v${latestVersion}`, { count: rows.length });
            } else {
                // LatestVersion = 0 only: retain legacy parent JSON when no unversioned child rows exist.
                auditLog.debug('daily', 'Loaded from legacy JSON fallback', { count: record.userRows.length });
            }
        } catch (childError) {
            if (latestVersion > 0) {
                auditLog.warn('daily', 'Committed version hydration failed; legacy fallback is prohibited', {
                    parentId: item.Id,
                    latestVersion,
                    error: String(childError),
                });
                throw childError;
            }
            auditLog.warn('daily', 'Failed to join legacy children, using legacy parent JSON fallback', {
                error: String(childError),
            });
        }

        return record;
    }

    public async list(
        params: DailyRecordRepositoryListParams & { limit?: number },
        listPath: string,
        rowsListTitle: string,
        resolvedRowsFields: ResolvedRowsFields,
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
            DAILY_RECORD_FIELDS.latestVersion,
            DAILY_RECORD_FIELDS.created, DAILY_RECORD_FIELDS.modified
        ].join(','));

        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`, { signal: params.signal });
        if (!response.ok) {
            throw new Error(`Daily record list read failed with HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SharePointResponse<RawSharePointItem>;
        const parentItems = payload.value ?? [];
        const parsed = parentItems
            .map((item) => ({ item, record: parseSpItem(item) }))
            .filter((entry): entry is { item: RawSharePointItem; record: DailyRecordItem } => Boolean(entry.record));

        if (parsed.length === 0) return [];

        const rowsListPath = buildListPath(rowsListTitle);
        const rowsByParentId = new Map<number, CurrentChildRow[]>();
        const selectFields = [
            resolvedRowsFields.parentId,
            resolvedRowsFields.version,
            resolvedRowsFields.payload,
        ];
        if (resolvedRowsFields.rowNo) selectFields.push(resolvedRowsFields.rowNo);

        for (let start = 0; start < parsed.length; start += PARENT_FILTER_CHUNK_SIZE) {
            const chunk = parsed.slice(start, start + PARENT_FILTER_CHUNK_SIZE);
            const childFilter = chunk
                .map(({ item }) => `(${buildCurrentVersionChildFilter(
                    resolvedRowsFields.parentId,
                    item.Id,
                    resolvedRowsFields.version,
                    Number(item.LatestVersion ?? 0) || 0,
                )})`)
                .join(' or ');

            const childResponse = await this.spFetch(
                `${rowsListPath}/items?$filter=${encodeURIComponent(childFilter)}&$select=${selectFields.join(',')}`,
                { signal: params.signal },
            );
            if (!childResponse.ok) {
                throw new Error(`Current-version child list read failed with HTTP ${childResponse.status}`);
            }

            const childPayload = await childResponse.json();
            const rows = (childPayload.value || []) as CurrentChildRow[];
            rows.forEach((row) => {
                const parentId = Number(row[resolvedRowsFields.parentId]);
                if (!Number.isFinite(parentId)) return;
                const existing = rowsByParentId.get(parentId) ?? [];
                existing.push(row);
                rowsByParentId.set(parentId, existing);
            });
        }

        return parsed.map(({ item, record }) => {
            const latestVersion = Number(item.LatestVersion ?? 0) || 0;
            const rows = rowsByParentId.get(item.Id) ?? [];
            this.assertCommittedVersionHasRows(item.Id, latestVersion, rows);

            if (rows.length > 0) {
                record.userRows = this.parseUserRows(rows, resolvedRowsFields);
            }
            // LatestVersion = 0 and no unversioned children: retain legacy parent JSON only.
            return record;
        });
    }

    public async findItemByDate(date: string, listPath: string, signal?: AbortSignal): Promise<RawSharePointItem | null> {
        const queryParams = new URLSearchParams();
        queryParams.set('$filter', `${DAILY_RECORD_FIELDS.title} eq '${date}'`);
        queryParams.set('$top', '1');
        queryParams.set('$select', [
            'Id', DAILY_RECORD_FIELDS.title, DAILY_RECORD_FIELDS.recordDate,
            DAILY_RECORD_FIELDS.reporterName, DAILY_RECORD_FIELDS.reporterRole,
            DAILY_RECORD_FIELDS.userRowsJSON, DAILY_RECORD_FIELDS.userCount,
            DAILY_RECORD_FIELDS.latestVersion,
            DAILY_RECORD_FIELDS.created, DAILY_RECORD_FIELDS.modified
        ].join(','));

        try {
            const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`, { signal });
            const payload = (await response.json()) as SharePointResponse<RawSharePointItem>;
            const items = payload.value ?? [];
            return items.length > 0 ? items[0] : null;
        } catch (error) {
            console.warn('[DailyRecordDataAccess] findItemByDate failed', { date, error });
            return null;
        }
    }
}
