import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    type SharePointItem,
    type ResolvedRowsFields,
    type ResolvedParentFields
} from '../constants';
import { 
    SaveDailyRecordInput, 
    DailyRecordRepositoryMutationParams,
    DailyRecordItem,
    ApproveRecordInput
} from '../../../domain/legacy/DailyRecordRepository';
import { buildDailyRecordPayload } from '../../../domain/builders/buildDailyRecordPayload';
import type { SharePointDailyRecordPayload } from '../../../domain/schema';
import { nextDailyRecordVersion } from '../../../domain/persistence/dailyRecordPersistence';
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
        resolvedRowsFields: ResolvedRowsFields,
        resolvedParentFields: ResolvedParentFields,
        _params?: DailyRecordRepositoryMutationParams
    ): Promise<void> {
        const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, {
            date: input.date,
            userCount: input.userRows.length,
        });

        try {
            const mode = existingItem ? 'update' : 'create';
            const itemData: SharePointDailyRecordPayload = buildDailyRecordPayload(input);
            const currentVersion = existingItem?.LatestVersion ?? 0;
            const nextVersion = nextDailyRecordVersion(currentVersion);

            const parentMetadata: Record<string, unknown> = {
                [resolvedParentFields.title]: itemData.Title,
                [resolvedParentFields.recordDate]: itemData.RecordDate,
                [resolvedParentFields.reporterName]: itemData.ReporterName,
                [resolvedParentFields.reporterRole]: itemData.ReporterRole,
                [resolvedParentFields.userRowsJSON]: '',
                [resolvedParentFields.userCount]: itemData.UserCount,
            };
            
            let parentId: number;
            if (existingItem) {
                parentId = existingItem.Id;
            } else {
                const createUrl = `${listPath}/items`;
                const res = await this.spFetch(createUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;odata=nometadata',
                        'Accept': 'application/json;odata=nometadata',
                    },
                    body: JSON.stringify({
                        ...parentMetadata,
                        [resolvedParentFields.latestVersion]: 0,
                    }),
                });
                const created = await res.json();
                parentId = created.d?.Id || created.Id;
            }

            // DAILY-RECORD-PERSISTENCE-V1: append next version. Never DELETE existing children.
            for (const [index, row] of input.userRows.entries()) {
                const rowNo = index + 1;
                const rowIdentityKey = `${input.date}-${row.userId}-${rowNo}`;
                const rowPayload: Record<string, unknown> = {
                    Title: rowIdentityKey,
                    [resolvedRowsFields.parentId]: parentId,
                    [resolvedRowsFields.userId]: row.userId,
                    [resolvedRowsFields.version]: nextVersion,
                    [resolvedRowsFields.status]: 'completed',
                    [resolvedRowsFields.payload]: JSON.stringify(row),
                    [resolvedRowsFields.recordedAt]: new Date().toISOString(),
                    [resolvedRowsFields.rowKey]: rowIdentityKey,
                };
                if (resolvedRowsFields.rowNo) {
                    rowPayload[resolvedRowsFields.rowNo] = rowNo;
                }
                if (resolvedRowsFields.recordDate) {
                    rowPayload[resolvedRowsFields.recordDate] = itemData.RecordDate;
                }
                await this.spFetch(`${rowsListPath}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json;odata=nometadata', 'Accept': 'application/json;odata=nometadata' },
                    body: JSON.stringify(rowPayload),
                });
            }

            // Commit point: only after every child row is persisted.
            const finalizeUrl = `${listPath}/items(${parentId})`;
            await this.spFetch(finalizeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;odata=nometadata',
                    'Accept': 'application/json;odata=nometadata',
                    'IF-MATCH': existingItem?.__metadata?.etag ?? '*',
                    'X-HTTP-Method': 'MERGE',
                },
                body: JSON.stringify({
                    ...parentMetadata,
                    [resolvedParentFields.latestVersion]: nextVersion,
                }),
            });

            auditLog.debug('daily', `Committed daily record v${nextVersion}`, {
                parentId,
                mode,
                rowCount: input.userRows.length,
            });
            finishSpan({ meta: { status: 'ok', mode, version: nextVersion } });
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
        resolvedParentFields: ResolvedParentFields,
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
                [resolvedParentFields.approvalStatus ?? 'ApprovalStatus']: 'approved',
                [resolvedParentFields.approvedBy ?? 'ApprovedBy']: input.approverName,
                [resolvedParentFields.approvedAt ?? 'ApprovedAt']: new Date().toISOString(),
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
