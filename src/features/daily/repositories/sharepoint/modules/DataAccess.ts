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
import {
    buildCurrentVersionChildFilter,
    normalizeDailyRecordCommitId,
    requireCommittedCurrentIdentity,
    resolveUniqueParentForDate,
} from '@/features/daily/domain/persistence/dailyRecordPersistence';

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

    private assertCommittedCurrentHasRows(
        parentId: number,
        latestVersion: number,
        latestCommitId: string,
        rows: CurrentChildRow[],
    ): void {
        if (latestVersion > 0 && rows.length === 0) {
            throw new Error(
                `[DAILY-RECORD-PERSISTENCE-V1] Parent ${parentId} points to LatestVersion ${latestVersion} / LatestCommitId ${latestCommitId}, but no current child rows were found.`,
            );
        }
    }

    private readParentCurrentPointer(item: RawSharePointItem): {
        latestVersion: number;
        latestCommitId: string | null;
    } {
        const latestVersion = Number(item.LatestVersion ?? 0) || 0;
        const latestCommitId = normalizeDailyRecordCommitId(item.LatestCommitId);
        if (latestVersion > 0) {
            requireCommittedCurrentIdentity(latestVersion, latestCommitId);
        }
        return { latestVersion, latestCommitId };
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

        let latestVersion = 0;
        let latestCommitId: string | null = null;
        try {
            const pointer = this.readParentCurrentPointer(item);
            latestVersion = pointer.latestVersion;
            latestCommitId = pointer.latestCommitId;

            const rowsListPath = buildListPath(rowsListTitle);
            const filter = buildCurrentVersionChildFilter(
                resolvedRowsFields.parentId,
                item.Id,
                resolvedRowsFields.version,
                latestVersion,
                resolvedRowsFields.commitId,
                latestCommitId,
            );
            const selectFields = [resolvedRowsFields.payload];
            if (resolvedRowsFields.rowNo) selectFields.push(resolvedRowsFields.rowNo);

            const res = await this.spFetch(
                `${rowsListPath}/items?$filter=${encodeURIComponent(filter)}&$select=${selectFields.join(',')}`,
            );
            if (res.ok === false) {
                throw new Error(`Current-version child read failed with HTTP ${res.status}`);
            }

            const json = await res.json();
            const rows = (json.value || []) as CurrentChildRow[];
            if (latestVersion > 0 && latestCommitId) {
                this.assertCommittedCurrentHasRows(item.Id, latestVersion, latestCommitId, rows);
            }

            if (rows.length > 0) {
                record.userRows = this.parseUserRows(rows, resolvedRowsFields);
                auditLog.debug('daily', `Loaded via version v${latestVersion}`, {
                    count: rows.length,
                    commitId: latestCommitId,
                });
            } else {
                // LatestVersion = 0 only: retain legacy parent JSON when no unversioned child rows exist.
                auditLog.debug('daily', 'Loaded from legacy JSON fallback', { count: record.userRows.length });
            }
        } catch (childError) {
            if (latestVersion > 0 || (Number(item.LatestVersion ?? 0) || 0) > 0) {
                auditLog.warn('daily', 'Committed current hydration failed; legacy fallback is prohibited', {
                    parentId: item.Id,
                    latestVersion: latestVersion || Number(item.LatestVersion ?? 0) || 0,
                    latestCommitId,
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
            DAILY_RECORD_FIELDS.latestVersion, DAILY_RECORD_FIELDS.latestCommitId,
            DAILY_RECORD_FIELDS.created, DAILY_RECORD_FIELDS.modified
        ].join(','));

        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`, { signal: params.signal });
        if (response.ok === false) {
            throw new Error(`Daily record list read failed with HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SharePointResponse<RawSharePointItem>;
        const parentItems = payload.value ?? [];
        this.assertNoDuplicateParentDates(parentItems);
        const parsed = parentItems
            .map((item) => ({ item, record: parseSpItem(item) }))
            .filter((entry): entry is { item: RawSharePointItem; record: DailyRecordItem } => Boolean(entry.record));

        if (parsed.length === 0) return [];

        // Fail closed before querying when any committed parent lacks LatestCommitId.
        const parentPointers = parsed.map(({ item }) => {
            const latestVersion = Number(item.LatestVersion ?? 0) || 0;
            const latestCommitId = normalizeDailyRecordCommitId(item.LatestCommitId);
            if (latestVersion > 0) {
                requireCommittedCurrentIdentity(latestVersion, latestCommitId);
            }
            return { item, latestVersion, latestCommitId };
        });

        const rowsListPath = buildListPath(rowsListTitle);
        const rowsByParentId = new Map<number, CurrentChildRow[]>();
        const selectFields = [
            resolvedRowsFields.parentId,
            resolvedRowsFields.version,
            resolvedRowsFields.commitId,
            resolvedRowsFields.payload,
        ];
        if (resolvedRowsFields.rowNo) selectFields.push(resolvedRowsFields.rowNo);

        for (let start = 0; start < parentPointers.length; start += PARENT_FILTER_CHUNK_SIZE) {
            const chunk = parentPointers.slice(start, start + PARENT_FILTER_CHUNK_SIZE);
            const childFilter = chunk
                .map(({ item, latestVersion, latestCommitId }) => `(${buildCurrentVersionChildFilter(
                    resolvedRowsFields.parentId,
                    item.Id,
                    resolvedRowsFields.version,
                    latestVersion,
                    resolvedRowsFields.commitId,
                    latestCommitId,
                )})`)
                .join(' or ');

            const childResponse = await this.spFetch(
                `${rowsListPath}/items?$filter=${encodeURIComponent(childFilter)}&$select=${selectFields.join(',')}`,
                { signal: params.signal },
            );
            if (childResponse.ok === false) {
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

        return parentPointers.map(({ item, latestVersion, latestCommitId }, index) => {
            const record = parsed[index].record;
            const rows = rowsByParentId.get(item.Id) ?? [];
            if (latestVersion > 0 && latestCommitId) {
                this.assertCommittedCurrentHasRows(item.Id, latestVersion, latestCommitId, rows);
            }

            if (rows.length > 0) {
                record.userRows = this.parseUserRows(rows, resolvedRowsFields);
            }
            // LatestVersion = 0 and no unversioned children: retain legacy parent JSON only.
            return record;
        });
    }

    private assertNoDuplicateParentDates(items: RawSharePointItem[]): void {
        const idsByDate = new Map<string, number[]>();
        items.forEach((item) => {
            const date = String(item.Title ?? '').trim();
            if (!date) return;
            const ids = idsByDate.get(date) ?? [];
            ids.push(item.Id);
            idsByDate.set(date, ids);
        });
        for (const [date, ids] of idsByDate) {
            resolveUniqueParentForDate(date, ids.map((id) => ({ id })));
        }
    }

    /**
     * List all parents for a date Title. Fail-closed on transport/HTTP errors.
     * Callers must enforce uniqueness via resolveUniqueParentForDate.
     */
    public async listParentsByDate(
        date: string,
        listPath: string,
        signal?: AbortSignal,
    ): Promise<RawSharePointItem[]> {
        const queryParams = new URLSearchParams();
        queryParams.set('$filter', `${DAILY_RECORD_FIELDS.title} eq '${date}'`);
        queryParams.set('$orderby', 'Id asc');
        queryParams.set('$select', [
            'Id', DAILY_RECORD_FIELDS.title, DAILY_RECORD_FIELDS.recordDate,
            DAILY_RECORD_FIELDS.reporterName, DAILY_RECORD_FIELDS.reporterRole,
            DAILY_RECORD_FIELDS.userRowsJSON, DAILY_RECORD_FIELDS.userCount,
            DAILY_RECORD_FIELDS.latestVersion, DAILY_RECORD_FIELDS.latestCommitId,
            DAILY_RECORD_FIELDS.created, DAILY_RECORD_FIELDS.modified
        ].join(','));

        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`, { signal });
        if (response.ok === false) {
            throw new Error(
                `[DAILY-RECORD-PERSISTENCE-V1] Parent lookup failed with HTTP ${response.status}. ` +
                `Aborting; do not create a new parent from an uncertain lookup.`,
            );
        }

        const payload = (await response.json()) as SharePointResponse<RawSharePointItem>;
        return payload.value ?? [];
    }

    /**
     * Read parent ETag once when building the snapshot-bound CAS (not a pre-commit refresh).
     */
    public async readParentSnapshotEtag(
        parentId: number,
        listPath: string,
        signal?: AbortSignal,
    ): Promise<string | null> {
        const queryParams = new URLSearchParams();
        queryParams.set('$select', [
            'Id', DAILY_RECORD_FIELDS.latestVersion, DAILY_RECORD_FIELDS.latestCommitId,
        ].join(','));

        const response = await this.spFetch(
            `${listPath}/items(${parentId})?${queryParams.toString()}`,
            { signal },
        );
        if (response.ok === false) {
            throw new Error(
                `[DAILY-RECORD-PERSISTENCE-V1] Parent snapshot ETag read failed with HTTP ${response.status}.`,
            );
        }
        await response.json();
        return response.headers.get('ETag');
    }

    /**
     * Parent lookup for save/load.
     *
     * Fail-closed contract:
     * - network / thrown transport errors → throw (do NOT treat as missing)
     * - HTTP non-OK (403/500/400 schema missing field, etc.) → throw
     * - HTTP 200 + multiple parents for date → throw (create-race / uniqueness)
     * - HTTP 200 + value=[] → null (only this permits new Parent create on save)
     * - HTTP 200 + exactly one parent → that parent
     */
    public async findItemByDate(date: string, listPath: string, signal?: AbortSignal): Promise<RawSharePointItem | null> {
        const items = await this.listParentsByDate(date, listPath, signal);
        const unique = resolveUniqueParentForDate(
            date,
            items.map((item) => ({ id: item.Id, item })),
        );
        return unique?.item ?? null;
    }
}
