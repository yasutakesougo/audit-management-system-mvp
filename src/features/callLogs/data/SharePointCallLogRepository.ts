/**
 * SharePointCallLogRepository
 *
 * SharePoint Lists API を使った CallLog の読み書き実装。
 * dailyOps の makeSharePointDailyOpsSignalsPort と同じパターンで実装。
 */

import { createSpClient, ensureConfig } from '@/lib/spClient';
import type { CallLog, CreateCallLogInput } from '@/domain/callLogs/schema';
import type { CallLogRepository, ListCallLogsOptions } from '@/domain/callLogs/repository';
import { applyCallLogStatusTransition } from '@/domain/callLogs/statusTransition';
import { CALL_LOG_LIST_TITLE, CALL_LOG_FIELDS } from './callLogFieldMap';
import { mapItemToCallLog } from './mapItemToCallLog';
import { buildCallLogCreateBody } from './buildCallLogCreateBody';

type SpItem = Record<string, unknown>;

const SELECT_FIELDS = [
  'Id',
  'Title',
  CALL_LOG_FIELDS.receivedAt,
  CALL_LOG_FIELDS.callerName,
  CALL_LOG_FIELDS.callerOrg,
  CALL_LOG_FIELDS.targetStaffName,
  CALL_LOG_FIELDS.receivedByName,
  CALL_LOG_FIELDS.message,
  CALL_LOG_FIELDS.needCallback,
  CALL_LOG_FIELDS.urgency,
  CALL_LOG_FIELDS.status,
  CALL_LOG_FIELDS.relatedUserId,
  CALL_LOG_FIELDS.relatedUserName,
  CALL_LOG_FIELDS.callbackDueAt,
  CALL_LOG_FIELDS.completedAt,
  CALL_LOG_FIELDS.created,
  CALL_LOG_FIELDS.modified,
] as const;

export const makeSharePointCallLogRepository = (
  acquireToken: () => Promise<string | null>,
): CallLogRepository => {
  const { baseUrl } = ensureConfig();
  const client = createSpClient(acquireToken, baseUrl);
  const f = CALL_LOG_FIELDS;

  return {
    async list(options?: ListCallLogsOptions): Promise<CallLog[]> {
      const clauses: string[] = [];

      if (options?.status) {
        clauses.push(`${f.status} eq '${options.status}'`);
      }

      if (options?.targetStaffName) {
        clauses.push(`${f.targetStaffName} eq '${options.targetStaffName}'`);
      }

      const filter = clauses.length > 0 ? clauses.join(' and ') : undefined;

      const items = await client.getListItemsByTitle<SpItem>(
        CALL_LOG_LIST_TITLE,
        [...SELECT_FIELDS],
        filter,
        `${f.receivedAt} desc`,
        500,
      );

      return (items ?? []).map(mapItemToCallLog);
    },

    async create(input: CreateCallLogInput, receivedByName: string): Promise<CallLog> {
      const body = buildCallLogCreateBody(input, receivedByName);

      const created = await client.addListItemByTitle<Record<string, unknown>, SpItem>(
        CALL_LOG_LIST_TITLE,
        body,
      );

      const createdId = created?.Id ? Number(created.Id) : undefined;

      if (!createdId) {
        // フォールバック: SP レスポンスが不完全なら入力から組み立てる
        return mapItemToCallLog({ Id: -1, ...body } as SpItem);
      }

      const fetched = await client.getListItemsByTitle<SpItem>(
        CALL_LOG_LIST_TITLE,
        [...SELECT_FIELDS],
        `Id eq ${createdId}`,
        undefined,
        1,
      );

      return fetched?.[0]
        ? mapItemToCallLog(fetched[0])
        : mapItemToCallLog({ Id: createdId, ...body } as SpItem);
    },

    async updateStatus(id: string, status: CallLog['status']): Promise<void> {
      const nowDate = new Date();
      const transitioned = applyCallLogStatusTransition(
        {
          status: 'new',
          completedAt: undefined,
        },
        status,
        nowDate,
      );

      const payload: Record<string, unknown> = {
        [f.status]: transitioned.status,
        [f.completedAt]: transitioned.completedAt ?? null,
      };

      await client.updateItemByTitle(CALL_LOG_LIST_TITLE, Number(id), payload);
    },
  };
};
