import type { SpFetchFn } from '@/lib/sp/spLists';
import {
    type SharePointItem,
    type ResolvedRowsFields,
    type ResolvedParentFields,
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
    createDailyRecordCommitId,
    nextDailyRecordVersion,
    resolveOrCreateParentForSave,
} from '../../../domain/persistence/dailyRecordPersistence';
import { DailyRecordDataAccess } from './DataAccess';
import { auditLog } from '@/lib/debugLogger';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { toSafeError } from '@/lib/errors';

type ResolvedParent = {
    id: number;
    item: SharePointItem;
};

export class DailyRecordSaver {
    constructor(
        private readonly spFetch: SpFetchFn,
        private readonly dataAccess: DailyRecordDataAccess,
    ) {}

    private toSharePointItem(raw: RawSharePointItem): SharePointItem {
        return {
            Id: raw.Id,
            Title: raw.Title,
            RecordDate: raw.RecordDate,
            ReporterName: raw.ReporterName,
            ReporterRole: raw.ReporterRole,
            UserRowsJSON: raw.User_x0020_Rows_x0020_JSON,
            UserCount: raw.UserCount,
            LatestVersion: raw.LatestVersion,
            LatestCommitId: raw.LatestCommitId,
            IsDeleted: raw.IsDeleted,
            Created: raw.Created,
            Modified: raw.Modified,
            __metadata: raw.__metadata,
        };
    }

    public async save(
        input: SaveDailyRecordInput, 
        listPath: string, 
        rowsListPath: string,
        resolvedRowsFields: ResolvedRowsFields,
        resolvedParentFields: ResolvedParentFields,
        params?: DailyRecordRepositoryMutationParams
    ): Promise<void> {
        const finishSpan = startFeatureSpan(HYDRATION_FEATURES.daily.save, {
            date: input.date,
            userCount: input.userRows.length,
        });

        try {
            const itemData: SharePointDailyRecordPayload = buildDailyRecordPayload(input);
            const commitId = createDailyRecordCommitId();

            const parentMetadata: Record<string, unknown> = {
                [resolvedParentFields.title]: itemData.Title,
                [resolvedParentFields.recordDate]: itemData.RecordDate,
                [resolvedParentFields.reporterName]: itemData.ReporterName,
                [resolvedParentFields.reporterRole]: itemData.ReporterRole,
                [resolvedParentFields.userRowsJSON]: '',
                [resolvedParentFields.userCount]: itemData.UserCount,
            };

            const { parent: resolvedParent, created } = await resolveOrCreateParentForSave<ResolvedParent>(
                input.date,
                {
                    listParents: async () => {
                        const items = await this.dataAccess.listParentsByDate(
                            input.date,
                            listPath,
                            params?.signal,
                        );
                        return items.map((raw) => ({
                            id: raw.Id,
                            item: this.toSharePointItem(raw),
                        }));
                    },
                    createParent: async () => {
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
                            signal: params?.signal,
                        });
                        if (res.ok === false) {
                            throw new Error(
                                `[DAILY-RECORD-PERSISTENCE-V1] Parent create failed with HTTP ${res.status}.`,
                            );
                        }
                        const createdPayload = await res.json();
                        const parentId = createdPayload.d?.Id || createdPayload.Id;
                        return {
                            id: parentId,
                            item: {
                                Id: parentId,
                                Title: itemData.Title,
                                LatestVersion: 0,
                            },
                        };
                    },
                },
            );

            const existingItem = resolvedParent.item;
            const parentId = resolvedParent.id;
            const mode = created ? 'create' : 'update';
            const currentVersion = existingItem.LatestVersion ?? 0;
            const nextVersion = nextDailyRecordVersion(currentVersion);
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
