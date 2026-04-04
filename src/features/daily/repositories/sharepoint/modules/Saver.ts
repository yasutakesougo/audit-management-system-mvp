import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    type SharePointItem
} from '../constants';
import {
    SaveDailyRecordInput,
    DailyRecordRepositoryMutationParams,
    DailyRecordItem,
    ApproveRecordInput
} from '../../../domain/legacy/DailyRecordRepository';
import {
    buildDailyRecordPayload,
    type SharePointDailyRecordPayload
} from '../../../domain/builders/buildDailyRecordPayload';
import { auditLog } from '@/lib/debugLogger';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { toSafeError } from '@/lib/errors';
import { DailyRecordSchemaResolver } from './SchemaResolver';
import { resolveInternalNames } from '@/lib/sp/helpers';
import { DAILY_RECORD_ROW_AGGREGATE_CANDIDATES } from '@/sharepoint/fields/dailyFields';
import {
    buildFailOpenPayload,
    spCreate,
    spUpdate,
    spDelete,
    type FieldMapping,
} from '@/lib/sp/GenericSaver';

export class DailyRecordSaver {
    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly schema: DailyRecordSchemaResolver
    ) {}

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
            const itemData: SharePointDailyRecordPayload = buildDailyRecordPayload(input);
            const resolved = await this.schema.getResolvedCanonicalNames();

            // Build dynamic parent payload via GenericSaver
            const fieldMappings: FieldMapping[] = [
                [itemData.Title, 'title'],
                [itemData.RecordDate, 'recordDate'],
                [itemData.ReporterName, 'reporterName'],
                [itemData.ReporterRole, 'reporterRole'],
                [itemData.UserRowsJSON, 'userRowsJSON'],
                [itemData.UserCount, 'userCount'],
            ];

            const { payload: spPayload } = buildFailOpenPayload(
                resolved,
                fieldMappings,
                'Daily',
            );
            
            let parentId: number;
            if (existingItem) {
                parentId = existingItem.Id;
                await spUpdate(
                    this.spFetch, listPath, parentId,
                    spPayload,
                    existingItem.__metadata?.etag,
                );
            } else {
                // For initial creation, ensure we don't send huge JSON in the first request
                const initialPayload = { ...spPayload };
                const userRowsFieldName = resolved.userRowsJSON;
                if (userRowsFieldName) {
                    initialPayload[userRowsFieldName] = '';
                }
                parentId = await spCreate(this.spFetch, listPath, initialPayload);
            }

            // Cleanup and Save children logic...
            // For children, we also need to resolve their names
            const rowsFieldsRes = await this.spFetch(`${rowsListPath}/fields?$select=InternalName`);
            const rowsFieldsJson = await rowsFieldsRes.json();
            const availableRowFields = new Set<string>((rowsFieldsJson.value || []).map((f: { InternalName: string }) => f.InternalName));
            const resolvedRows = resolveInternalNames(availableRowFields, DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>);

            const parentIdField = resolvedRows.ParentID || 'Parent_x0020_ID';
            const userIdField = resolvedRows.userId || 'User_x0020_ID';
            const statusField = resolvedRows.status || 'Status';
            const payloadField = resolvedRows.payload || 'Payload';
            const recordedAtField = resolvedRows.recordedAt || 'Recorded_x0020_At';

            // Cleanup existing children if update
            if (existingItem) {
                try {
                    const filter = `${parentIdField} eq ${parentId}`;
                    const res = await this.spFetch(`${rowsListPath}/items?$filter=${filter}&$select=Id`);
                    const json = await res.json();
                    const itemsToDelete = json.value || [];
                    
                    for (const item of itemsToDelete) {
                        await spDelete(this.spFetch, rowsListPath, item.Id);
                    }
                } catch (cleanupError) {
                    auditLog.warn('daily', 'Row cleanup failed', { error: String(cleanupError) });
                }
            }

            // Save new children
            for (const row of input.userRows) {
                const rowPayload: Record<string, unknown> = {
                    [parentIdField]: parentId,
                    [userIdField]: row.userId,
                    [statusField]: 'done',
                    [payloadField]: JSON.stringify(row),
                    [recordedAtField]: new Date().toISOString(),
                };
                
                await this.spFetch(`${rowsListPath}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json;odata=nometadata', 'Accept': 'application/json;odata=nometadata' },
                    body: JSON.stringify(rowPayload),
                });
            }

            // Finalize parent (large JSON field update)
            if (resolved.userRowsJSON) {
                await spUpdate(this.spFetch, listPath, parentId, {
                    [resolved.userRowsJSON]: '',
                });
            }

            finishSpan({ meta: { status: 'ok', mode } });
        } catch (error) {
            const safeError = toSafeError(error);
            finishSpan({ meta: { status: 'error' }, error: safeError.message });
            throw safeError;
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
            const resolved = await this.schema.getResolvedCanonicalNames();
            const approvedAt = new Date().toISOString();

            const approvalMappings: FieldMapping[] = [
                ['approved', 'approvalStatus'],
                [input.approverName, 'approvedBy'],
                [approvedAt, 'approvedAt'],
            ];

            const { payload: approvalData } = buildFailOpenPayload(
                resolved,
                approvalMappings,
                'Daily',
            );

            await spUpdate(
                this.spFetch, listPath, existingItem.Id,
                approvalData,
                existingItem.__metadata?.etag,
            );

            finishSpan({ meta: { status: 'ok' } });
            return { 
                date: input.date, 
                approvalStatus: 'approved', 
                approvedBy: input.approverName, 
                approvedAt: approvedAt 
            } as DailyRecordItem;
        } catch (error) {
            const safeError = toSafeError(error);
            finishSpan({ meta: { status: 'error' }, error: safeError.message });
            throw safeError;
        }
    }
}
