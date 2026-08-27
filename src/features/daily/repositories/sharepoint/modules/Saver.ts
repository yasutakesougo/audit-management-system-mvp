import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    type SharePointItem,
    type ResolvedRowsFields,
    type ResolvedParentFields,
    type SharePointResponse,
    type RawSharePointItem,
} from '../constants';
import { 
    SaveDailyRecordInput, 
    DailyRecordRepositoryMutationParams,
    DailyRecordItem,
    ApproveRecordInput
} from '../../../domain/legacy/DailyRecordRepository';
import { buildDailyRecordPayload } from '../../../domain/builders/buildDailyRecordPayload';
import type { SharePointDailyRecordPayload } from '../../../domain/schema';
import {
    assertCreatedParentIsSoleOwner,
    createDailyRecordCommitId,
    nextDailyRecordVersion,
} from '../../../domain/persistence/dailyRecordPersistence';
import { auditLog } from '@/lib/debugLogger';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { toSafeError } from '@/lib/errors';

export class DailyRecordSaver {
    constructor(private readonly spFetch: SpFetchFn) {}

    private async listParentIdsByDate(
        listPath: string,
        date: string,
        titleField: string,
    ): Promise<Array<{ id: number }>> {
        const queryParams = new URLSearchParams();
        queryParams.set('$filter', `${titleField} eq '${date}'`);
        queryParams.set('$orderby', 'Id asc');
        queryParams.set('$select', 'Id');
        const response = await this.spFetch(`${listPath}/items?${queryParams.toString()}`);
        if (response.ok === false) {
            throw new Error(
                `[DAILY-RECORD-PERSISTENCE-V1] Post-create parent uniqueness probe failed with HTTP ${response.status}.`,
            );
        }
        const payload = (await response.json()) as SharePointResponse<RawSharePointItem>;
        return (payload.value ?? []).map((item) => ({ id: item.Id }));
    }

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
            // Unique per save attempt. Retries and concurrent saves must not share CommitId.
            const commitId = createDailyRecordCommitId();

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
                if (res.ok === false) {
                    throw new Error(
                        `[DAILY-RECORD-PERSISTENCE-V1] Parent create failed with HTTP ${res.status}.`,
                    );
                }
                const created = await res.json();
                parentId = created.d?.Id || created.Id;

                // DRP-PARENT-CREATE-RACE-001: concurrent empty lookups can both POST.
                // Re-verify sole ownership before any child writes. Do not DELETE losers.
                const parentsAfterCreate = await this.listParentIdsByDate(
                    listPath,
                    input.date,
                    resolvedParentFields.title,
                );
                assertCreatedParentIsSoleOwner(input.date, parentId, parentsAfterCreate);
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
                    [resolvedRowsFields.commitId]: commitId,
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
            // LatestVersion and LatestCommitId must advance together.
            const finalizeUrl = `${listPath}/items(${parentId})`;
            const finalizeRes = await this.spFetch(finalizeUrl, {
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
                    [resolvedParentFields.latestCommitId]: commitId,
                }),
            });
            if (finalizeRes.ok === false) {
                throw new Error(
                    `[DAILY-RECORD-PERSISTENCE-V1] Parent commit failed with HTTP ${finalizeRes.status}. ` +
                    `Child rows for CommitId ${commitId} remain non-current ghosts.`,
                );
            }

            auditLog.debug('daily', `Committed daily record v${nextVersion}`, {
                parentId,
                mode,
                commitId,
                rowCount: input.userRows.length,
            });
            finishSpan({ meta: { status: 'ok', mode, version: nextVersion, commitId } });
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
