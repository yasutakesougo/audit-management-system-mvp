import type { SpFetchFn } from '@/lib/sp/spLists';
import { 
    DAILY_RECORD_FIELDS, 
    readNonEmptyEnv,
    type SharePointItem,
    type ResolvedRowsFields
} from '../constants';
import { buildListPath } from '../utils/Helpers';
import { 
    scanDailyRecordIntegrity, 
    type DailyIntegrityException,
    type ScanSourceParent,
    type ScanSourceChild,
    type ScanSourceAccessory
} from '../../../domain/integrity/dailyIntegrityChecker';

export class DailyRecordIntegrityScanner {
    constructor(private readonly spFetch: SpFetchFn) {}

    public async scan(
        dates: string[], 
        listPath: string, 
        rowsListTitle: string,
        resolvedRowsFields: ResolvedRowsFields,
        signal?: AbortSignal
    ): Promise<DailyIntegrityException[]> {
        if (dates.length === 0) return [];

        try {
            const rowsListPath = buildListPath(rowsListTitle);
            const dateFilters = dates.map(d => `${DAILY_RECORD_FIELDS.recordDate} eq '${d}T00:00:00Z'`).join(' or ');
            const parentUrl = `${listPath}/items?$filter=(${dateFilters}) and ${DAILY_RECORD_FIELDS.isDeleted} ne true&$select=Id,RecordDate,LatestVersion`;

            const pRes = await this.spFetch(parentUrl, { signal });
            const pData = await pRes.json();
            const rawParents = pData.value || [];

            const parents: ScanSourceParent[] = rawParents.map((p: SharePointItem) => ({
                id: String(p.Id),
                date: p.RecordDate ? p.RecordDate.split('T')[0] : 'unknown',
                latestVersion: p.LatestVersion || 0,
            }));

            if (parents.length === 0) return [];

            const parentIds = parents.map(p => p.id);
            const idFilters = parentIds.map(id => `${resolvedRowsFields.parentId} eq ${id}`).join(' or ');
            const childUrl = `${rowsListPath}/items?$filter=${encodeURIComponent(idFilters)}&$select=${resolvedRowsFields.parentId},${resolvedRowsFields.userId},${resolvedRowsFields.version},${resolvedRowsFields.status},${resolvedRowsFields.payload},${resolvedRowsFields.recordedAt}`;

            const cRes = await this.spFetch(childUrl, { signal });
            const cData = await cRes.json();
            const rawChildren = cData.value || [];

            const children: ScanSourceChild[] = rawChildren.map((c: Record<string, unknown>) => ({
                parentId: String(c[resolvedRowsFields.parentId]),
                userId: c[resolvedRowsFields.userId] as string,
                version: (c[resolvedRowsFields.version] as number) || 0,
                status: c[resolvedRowsFields.status] as string,
                recordedAt: c[resolvedRowsFields.recordedAt] as string,
            }));

            const userIds = [...new Set(children.map(c => c.userId))];
            const accessories: ScanSourceAccessory[] = [];

            if (userIds.length > 0) {
                try {
                    const transportListTitle = readNonEmptyEnv('VITE_SP_LIST_USER_TRANSPORT') ?? 'UserTransport_Settings';
                    const transportListPath = buildListPath(transportListTitle);
                    for (let i = 0; i < userIds.length; i += 20) {
                        const chunk = userIds.slice(i, i + 20);
                        const userFilters = chunk.map(uid => `${resolvedRowsFields.userId} eq '${uid}'`).join(' or ');
                        const transportUrl = `${transportListPath}/items?$filter=${encodeURIComponent(userFilters)}&$select=${resolvedRowsFields.userId}`;
                        const tRes = await this.spFetch(transportUrl, { signal });
                        const tData = await tRes.json();
                        accessories.push(...(tData.value || []).map((t: Record<string, unknown>) => ({
                            type: 'transport' as const,
                            userId: t[resolvedRowsFields.userId] as string,
                        })));
                    }
                } catch (accError) {
                    console.warn('[DailyRecordIntegrityScanner] Failed to fetch accessories', accError);
                }
            }

            return scanDailyRecordIntegrity(parents, children, accessories);
        } catch (error) {
            console.error('[DailyRecordIntegrityScanner] Integrity scan failed', error);
            return [];
        }
    }
}
