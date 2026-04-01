import type { SpFetchFn } from '@/lib/sp/spLists';
import { 
    DAILY_RECORD_ROWS_FIELDS, 
    type SharePointItem 
} from '../constants';
import { 
    SaveDailyRecordInput, 
    DailyRecordRepositoryMutationParams,
    DailyRecordItem,
    ApproveRecordInput
} from '../../../domain/legacy/DailyRecordRepository';
import { buildDailyRecordPayload } from '../../../domain/builders/buildDailyRecordPayload';
import { auditLog } from '@/lib/debugLogger';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { toSafeError } from '@/lib/errors';

export class DailyRecordSaver {
    constructor(private readonly spFetch: SpFetchFn) {}

    public async save(
        input: SaveDailyRecordInput, 
        listPath: string, 
        rowsListPath: string,
        existingItem: SharePointItem | null,
        _params?: DailyRecordRepositoryMutationParams
    ): Promise<void> {
        const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, {
            date: input.date,
            userCount: input.userRows.length,
        });

        try {
            const mode = existingItem ? 'update' : 'create';
            const itemData = buildDailyRecordPayload(input);
            
            let parentId: number;
            if (existingItem) {
                parentId = existingItem.Id;
                const updateUrl = `${listPath}/items(${parentId})`;
                await this.spFetch(updateUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;odata=verbose',
                        'Accept': 'application/json;odata=verbose',
                        'IF-MATCH': existingItem.__metadata?.etag ?? '*',
                        'X-HTTP-Method': 'MERGE',
                    },
                    body: JSON.stringify({
                        ...itemData,
                    }),
                });
            } else {
                const createUrl = `${listPath}/items`;
                const res = await this.spFetch(createUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;odata=verbose',
                        'Accept': 'application/json;odata=verbose',
                    },
                    body: JSON.stringify({
                        ...itemData,
                        UserRowsJSON: '', 
                    }),
                });
                const created = await res.json();
                parentId = created.d?.Id || created.Id;
            }

            // Cleanup existing children if update
            if (existingItem) {
                try {
                    const filter = `${DAILY_RECORD_ROWS_FIELDS.parentId} eq ${parentId}`;
                    const res = await this.spFetch(`${rowsListPath}/items?$filter=${filter}&$select=Id`);
                    const json = await res.json();
                    const itemsToDelete = json.value || [];
                    
                    if (itemsToDelete.length > 0) {
                        for (const item of itemsToDelete) {
                            await this.spFetch(`${rowsListPath}/items(${item.Id})`, {
                                method: 'POST',
                                headers: { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' }
                            });
                        }
                    }
                } catch (cleanupError) {
                    auditLog.warn('daily', 'Row cleanup failed', { error: String(cleanupError) });
                }
            }

            // Save new children
            for (const row of input.userRows) {
                const rowPayload = {
                    [DAILY_RECORD_ROWS_FIELDS.parentId]: parentId,
                    [DAILY_RECORD_ROWS_FIELDS.userId]: row.userId,
                    [DAILY_RECORD_ROWS_FIELDS.status]: 'done',
                    [DAILY_RECORD_ROWS_FIELDS.payload]: JSON.stringify(row),
                    [DAILY_RECORD_ROWS_FIELDS.recordedAt]: new Date().toISOString(),
                };
                await this.spFetch(`${rowsListPath}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json;odata=verbose', 'Accept': 'application/json;odata=verbose' },
                    body: JSON.stringify(rowPayload),
                });
            }

            // Finalize parent
            const finalizeUrl = `${listPath}/items(${parentId})`;
            await this.spFetch(finalizeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;odata=verbose',
                    'Accept': 'application/json;odata=verbose',
                    'IF-MATCH': '*',
                    'X-HTTP-Method': 'MERGE',
                },
                body: JSON.stringify({
                    UserRowsJSON: '', 
                }),
            });

            finishSpan({ meta: { status: 'ok', mode } });
        } catch (error) {
            const safeError = toSafeError(error);
            finishSpan({ meta: { status: 'error' }, error: safeError.message });
        }
    }

    public async approve(
        input: ApproveRecordInput, 
        listPath: string, 
        existingItem: SharePointItem,
        params?: DailyRecordRepositoryMutationParams
    ): Promise<DailyRecordItem> {
        if (params?.signal?.aborted) {
            throw new Error('Operation aborted');
        }

        const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, {
            date: input.date,
            operation: 'approve',
        });

        try {
            const updateUrl = `${listPath}/items(${existingItem.Id})`;
            const approvalData = {
                ApprovalStatus: 'approved',
                ApprovedBy: input.approverName,
                ApprovedAt: new Date().toISOString(),
            };

            await this.spFetch(updateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;odata=verbose',
                    'Accept': 'application/json;odata=verbose',
                    'IF-MATCH': existingItem.__metadata?.etag ?? '*',
                    'X-HTTP-Method': 'MERGE',
                },
                body: JSON.stringify(approvalData),
            });

            finishSpan({ meta: { status: 'ok' } });
            return { 
                date: input.date, 
                approvalStatus: 'approved', 
                approvedBy: input.approverName, 
                approvedAt: approvalData.ApprovedAt 
            } as DailyRecordItem;
        } catch (error) {
            const safeError = toSafeError(error);
            finishSpan({ meta: { status: 'error' }, error: safeError.message });
            throw safeError;
        }
    }
}
