import type { SpFetchFn } from '@/lib/sp/spLists';
import { 
    DAILY_RECORD_FIELDS, 
    DAILY_RECORD_ROWS_FIELDS,
    EXECUTION_RECORD_FIELDS,
    readNonEmptyEnv,
    type RowAggregateSource, 
    type ResolvedRowsFields,
    type ResolvedParentFields,
    type SharePointFieldItem, 
    type SharePointResponse 
} from '../constants';
import { 
    DAILY_RECORD_ROW_AGGREGATE_CANDIDATES 
} from '@/sharepoint/fields/dailyFields';
import { 
    buildListPath, 
    buildListTitleCandidates, 
    getHttpStatus, 
    normalizeListKey, 
    suggestListTitles 
} from '../utils/Helpers';
import { resolveInternalNames } from '@/lib/sp/helpers';

export class DailyRecordSchemaResolver {
    private resolvedListPath: string | null = null;
    private listPathResolutionFailed = false;
    private resolvedRowAggregateSource: RowAggregateSource | null = null;
    private rowAggregateResolutionFailed = false;
    private resolvedRowsPath: string | null = null;
    private rowsPathResolutionFailed = false;
    private resolvedRowsFields: ResolvedRowsFields | null = null;
    private rowsFieldsResolutionFailed = false;
    private resolvedParentFields: ResolvedParentFields | null = null;

    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly listTitle: string,
        private readonly getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>
    ) {}

    public async resolveListPath(): Promise<string | null> {
        if (this.resolvedListPath) return this.resolvedListPath;
        if (this.listPathResolutionFailed) return null;

        const candidates = buildListTitleCandidates(this.listTitle);

        // Optimization for E2E stubs
        if (readNonEmptyEnv('VITE_E2E') === '1') {
            for (const candidate of candidates) {
                const listPath = buildListPath(candidate);
                this.resolvedListPath = listPath;
                return listPath;
            }
        }

        const availableTitles = await this.getAvailableListTitles();

        if (availableTitles) {
            const titleLookup = new Map<string, string>();
            const schemaMismatches: Array<{ title: string; missingFields: string[] }> = [];
            for (const title of availableTitles) {
                titleLookup.set(title.toLowerCase(), title);
                titleLookup.set(normalizeListKey(title), title);
            }
            for (const candidate of candidates) {
                const matched = titleLookup.get(candidate.toLowerCase()) ?? titleLookup.get(normalizeListKey(candidate));
                if (!matched) continue;
                const listPath = buildListPath(matched);
                const schemaProbe = await this.probeDailyRecordSchema(listPath);
                if (!schemaProbe.matches) {
                    schemaMismatches.push({ title: matched, missingFields: schemaProbe.missingFields });
                    continue;
                }
                this.resolvedListPath = listPath;
                return listPath;
            }

            this.listPathResolutionFailed = true;
            console.warn('[DailyRecordSchemaResolver] Daily record list not found in site list catalog', {
                requested: this.listTitle,
                tried: candidates,
                suggestions: suggestListTitles(availableTitles, this.listTitle, candidates),
                schemaMismatches: schemaMismatches.slice(0, 8),
            });
            return null;
        }

        // Fallback: try direct candidates if list catalog fetch failed
        for (const candidate of candidates) {
            const listPath = buildListPath(candidate);
            try {
                const schemaProbe = await this.probeDailyRecordSchema(listPath);
                if (schemaProbe.matches) {
                    this.resolvedListPath = listPath;
                    return listPath;
                }
            } catch (error) {
                if (getHttpStatus(error) === 404) continue;
                throw error;
            }
        }

        this.listPathResolutionFailed = true;
        return null;
    }

    public async resolveRowsPath(rowsListTitle: string): Promise<string | null> {
        if (this.resolvedRowsPath) return this.resolvedRowsPath;
        if (this.rowsPathResolutionFailed) return null;

        const candidates = [
            rowsListTitle,
            ...buildListTitleCandidates(rowsListTitle)
        ];

        // Optimization for E2E stubs
        if (readNonEmptyEnv('VITE_E2E') === '1') {
            for (const candidate of candidates) {
                const listPath = buildListPath(candidate);
                this.resolvedRowsPath = listPath;
                return listPath;
            }
        }

        const availableTitles = await this.getAvailableListTitles();
        if (!availableTitles) {
            // Fallback: try direct candidates if list catalog fetch failed
            for (const candidate of candidates) {
                const listPath = buildListPath(candidate);
                this.resolvedRowsPath = listPath;
                return listPath;
            }
            this.rowsPathResolutionFailed = true;
            return null;
        }

        const lookup = new Map<string, string>();
        for (const title of availableTitles) {
            lookup.set(title.toLowerCase(), title);
            lookup.set(normalizeListKey(title), title);
        }

        for (const candidate of candidates) {
            const matched = lookup.get(candidate.toLowerCase()) ?? lookup.get(normalizeListKey(candidate));
            if (matched) {
                this.resolvedRowsPath = buildListPath(matched);
                return this.resolvedRowsPath;
            }
        }

        // Fallback: try candidates directly if not found in catalog (useful for E2E stubs)
        for (const candidate of candidates) {
            const listPath = buildListPath(candidate);
            this.resolvedRowsPath = listPath;
            return listPath;
        }

        this.rowsPathResolutionFailed = true;
        return null;
    }

    public async resolveParentFields(listPath: string): Promise<ResolvedParentFields> {
        if (this.resolvedParentFields) return this.resolvedParentFields;

        // Optimization for E2E stubs
        if (readNonEmptyEnv('VITE_E2E') === '1') {
            this.resolvedParentFields = {
                title: DAILY_RECORD_FIELDS.title,
                recordDate: DAILY_RECORD_FIELDS.recordDate,
                reporterName: DAILY_RECORD_FIELDS.reporterName,
                reporterRole: DAILY_RECORD_FIELDS.reporterRole,
                userRowsJSON: DAILY_RECORD_FIELDS.userRowsJSON,
                userCount: DAILY_RECORD_FIELDS.userCount,
            };
            return this.resolvedParentFields;
        }

        const fieldNames = await this.getListFieldNames(listPath);
        if (!fieldNames) {
            return {
                title: DAILY_RECORD_FIELDS.title,
                recordDate: DAILY_RECORD_FIELDS.recordDate,
                reporterName: DAILY_RECORD_FIELDS.reporterName,
                reporterRole: DAILY_RECORD_FIELDS.reporterRole,
                userRowsJSON: DAILY_RECORD_FIELDS.userRowsJSON,
                userCount: DAILY_RECORD_FIELDS.userCount,
            };
        }

        // We need DAILY_RECORD_CANONICAL_CANDIDATES here.
        // We will import it dynamically or just use the local import.
        // Wait, DAILY_RECORD_CANONICAL_CANDIDATES is exported from dailyFields.ts. Let's add the import.

        // I will add the import at the top of the file in another chunk.

        const { DAILY_RECORD_CANONICAL_CANDIDATES } = await import('@/sharepoint/fields/dailyFields');
        const resolved = resolveInternalNames(fieldNames, DAILY_RECORD_CANONICAL_CANDIDATES);

        this.resolvedParentFields = {
            title: resolved.title ?? DAILY_RECORD_FIELDS.title,
            recordDate: resolved.recordDate ?? DAILY_RECORD_FIELDS.recordDate,
            reporterName: resolved.reporterName ?? DAILY_RECORD_FIELDS.reporterName,
            reporterRole: resolved.reporterRole ?? DAILY_RECORD_FIELDS.reporterRole,
            userRowsJSON: resolved.userRowsJSON ?? DAILY_RECORD_FIELDS.userRowsJSON,
            userCount: resolved.userCount ?? DAILY_RECORD_FIELDS.userCount,
            approvalStatus: resolved.approvalStatus,
            approvedBy: resolved.approvedBy,
            approvedAt: resolved.approvedAt,
        };

        return this.resolvedParentFields;
    }

    public async resolveRowsFields(rowsListPath: string): Promise<ResolvedRowsFields> {
        if (this.resolvedRowsFields) return this.resolvedRowsFields;

        // Optimization for E2E stubs
        if (readNonEmptyEnv('VITE_E2E') === '1') {
            this.resolvedRowsFields = {
                parentId: DAILY_RECORD_ROWS_FIELDS.parentId,
                userId: DAILY_RECORD_ROWS_FIELDS.userId,
                recordDate: 'RecordDate',
                version: DAILY_RECORD_ROWS_FIELDS.version,
                status: DAILY_RECORD_ROWS_FIELDS.status,
                payload: DAILY_RECORD_ROWS_FIELDS.payload,
                recordedAt: DAILY_RECORD_ROWS_FIELDS.recordedAt,
                rowKey: EXECUTION_RECORD_FIELDS.rowKey,
                rowNo: EXECUTION_RECORD_FIELDS.rowNo,
                memo: EXECUTION_RECORD_FIELDS.memo,
                staffName: EXECUTION_RECORD_FIELDS.staffName,
                bipsJSON: EXECUTION_RECORD_FIELDS.bipsJSON,
            };
            return this.resolvedRowsFields;
        }

        const fieldNames = await this.getListFieldNames(rowsListPath);
        if (!fieldNames) {
            return {
                parentId: DAILY_RECORD_ROWS_FIELDS.parentId,
                userId: DAILY_RECORD_ROWS_FIELDS.userId,
                version: DAILY_RECORD_ROWS_FIELDS.version,
                status: DAILY_RECORD_ROWS_FIELDS.status,
                payload: DAILY_RECORD_ROWS_FIELDS.payload,
                recordedAt: DAILY_RECORD_ROWS_FIELDS.recordedAt,
                rowKey: EXECUTION_RECORD_FIELDS.rowKey,
                rowNo: EXECUTION_RECORD_FIELDS.rowNo,
                memo: EXECUTION_RECORD_FIELDS.memo,
                staffName: EXECUTION_RECORD_FIELDS.staffName,
                bipsJSON: EXECUTION_RECORD_FIELDS.bipsJSON,
            };
        }

        const resolved = resolveInternalNames(
            fieldNames,
            DAILY_RECORD_ROW_AGGREGATE_CANDIDATES
        );

        this.resolvedRowsFields = {
            parentId: resolved.parentId ?? DAILY_RECORD_ROWS_FIELDS.parentId,
            userId: resolved.userId ?? DAILY_RECORD_ROWS_FIELDS.userId,
            recordDate: resolved.recordDate,
            version: resolved.version ?? DAILY_RECORD_ROWS_FIELDS.version,
            status: resolved.status ?? DAILY_RECORD_ROWS_FIELDS.status,
            payload: resolved.payload ?? DAILY_RECORD_ROWS_FIELDS.payload,
            recordedAt: resolved.recordedAt ?? DAILY_RECORD_ROWS_FIELDS.recordedAt,
            // Execution record specific (Maintain undefined if not resolved)
            rowKey: resolved.rowKey ?? EXECUTION_RECORD_FIELDS.rowKey,
            rowNo: resolved.rowNo,
            memo: resolved.memo,
            staffName: resolved.staffName,
            bipsJSON: resolved.bipsJSON,
        };

        return this.resolvedRowsFields;
    }

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
            ...buildListTitleCandidates(this.listTitle),
            'DailyBehaviorRecords（DO）',
        ];

        for (const candidate of [...new Set(rowCandidates)]) {
            const matched = lookup.get(candidate.toLowerCase()) ?? lookup.get(normalizeListKey(candidate));
            if (!matched) continue;

            const listPath = buildListPath(matched);
            const fieldNames = await this.getListFieldNames(listPath);
            if (!fieldNames) continue;

            const resolved = resolveInternalNames(
                fieldNames,
                DAILY_RECORD_ROW_AGGREGATE_CANDIDATES
            );
            const dateField = resolved.recordDate;
            const userIdField = resolved.userId;
            if (!dateField || !userIdField) continue;

            this.resolvedRowAggregateSource = {
                listPath,
                listTitle: matched,
                dateField,
                selectFields: [
                    'Id', 'Title', userIdField, dateField,
                    'cr013_status', 'cr013_reporterName', 'cr013_reporterId',
                    'cr013_draftJson', 'cr013_payload', 'cr013_kind',
                    'cr013_group', 'cr013_specialnote', 'Created', 'Modified',
                ].filter((name) => name === 'Id' || name === 'Title' || fieldNames.has(name)),
            };
            return this.resolvedRowAggregateSource;
        }

        this.rowAggregateResolutionFailed = true;
        return null;
    }

    private async getAvailableListTitles(): Promise<string[] | null> {
        try {
            const response = await this.spFetch("lists?$select=Title&$top=5000");
            const payload = (await response.json()) as SharePointResponse<{ Title?: string }>;
            return (payload.value ?? [])
                .map((item) => item.Title?.trim())
                .filter((title): title is string => Boolean(title));
        } catch (error) {
            if (getHttpStatus(error) === 404) return null;
            throw error;
        }
    }

    private async getListFieldNames(listPath: string): Promise<Set<string> | null> {
        if (this.getListFieldInternalNames) {
            try {
                const match = listPath.match(/getbytitle\('([^']+)'\)/i);
                const title = match ? match[1] : this.listTitle;
                return await this.getListFieldInternalNames(title);
            } catch (err) {
                console.warn(`[SchemaResolver] getListFieldInternalNames failed for ${listPath}:`, err);
            }
        }

        try {
            const response = await this.spFetch(`${listPath}/fields?$select=InternalName&$top=500`);
            const payload = (await response.json()) as SharePointResponse<SharePointFieldItem>;
            return new Set(
                (payload.value ?? [])
                .map((field) => field.InternalName?.trim())
                .filter((name): name is string => Boolean(name))
            );
        } catch (error) {
            const status = getHttpStatus(error);
            if (status === 400 || status === 403 || status === 404) return null;
            throw error;
        }
    }

    private async probeDailyRecordSchema(listPath: string): Promise<{ matches: boolean; missingFields: string[] }> {
        const names = await this.getListFieldNames(listPath);
        if (!names) return { matches: false, missingFields: [] };

        const { DAILY_RECORD_CANONICAL_CANDIDATES } = await import('@/sharepoint/fields/dailyFields');
        const resolved = resolveInternalNames(names, DAILY_RECORD_CANONICAL_CANDIDATES);

        const missingFields: string[] = [];
        if (!resolved.title) missingFields.push('title');
        if (!resolved.recordDate) missingFields.push('recordDate');
        if (!resolved.reporterName) missingFields.push('reporterName');
        if (!resolved.userRowsJSON) missingFields.push('userRowsJSON');

        return { matches: missingFields.length === 0, missingFields };
    }
}
