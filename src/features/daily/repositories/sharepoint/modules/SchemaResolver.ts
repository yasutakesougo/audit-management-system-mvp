import type { SpFetchFn } from '@/lib/sp/spLists';
import { 
    DAILY_RECORD_FIELDS, 
    type RowAggregateSource, 
    type SharePointFieldItem, 
    type SharePointResponse 
} from '../constants';
import { 
    buildListPath, 
    buildListTitleCandidates, 
    getHttpStatus, 
    normalizeListKey, 
    suggestListTitles 
} from '../utils/Helpers';

export class DailyRecordSchemaResolver {
    private resolvedListPath: string | null = null;
    private listPathResolutionFailed = false;
    private resolvedRowAggregateSource: RowAggregateSource | null = null;
    private rowAggregateResolutionFailed = false;

    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly listTitle: string
    ) {}

    public async resolveListPath(): Promise<string | null> {
        if (this.resolvedListPath) return this.resolvedListPath;
        if (this.listPathResolutionFailed) return null;

        const candidates = buildListTitleCandidates(this.listTitle);
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

            const dateField = ['cr013_date', 'cr013_recorddate', 'RecordDate', 'Date']
                .find((name) => fieldNames.has(name));
            const userIdField = ['cr013_personId', 'cr013_usercode', 'UserCode', 'UserID']
                .find((name) => fieldNames.has(name));
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
}
