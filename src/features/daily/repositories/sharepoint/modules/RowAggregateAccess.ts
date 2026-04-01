import type { SpFetchFn } from '@/lib/sp/spLists';
import { 
    type RowAggregateSource, 
    type SharePointResponse 
} from '../constants';
import { 
    normalizeDateToYmd, 
    normalizeRowForDailyMap, 
    mergeSpecialNotes, 
    EMPTY_PROBLEM_BEHAVIOR 
} from '../utils/Mappers';
import { fromSpItem } from '@/domain/daily/spMap';
import type { DailyRecordItem, DailyRecordRepositoryListParams } from '@/features/daily/domain/legacy/DailyRecordRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

export class RowAggregateAccess {
    constructor(private readonly spFetch: SpFetchFn) {}

    public async list(
        source: RowAggregateSource,
        params: DailyRecordRepositoryListParams & { limit?: number }
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
            const normalized = normalizeRowForDailyMap(row, source.dateField);
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
                : (parsed.data as { notes?: string }).notes ?? '';
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
}
