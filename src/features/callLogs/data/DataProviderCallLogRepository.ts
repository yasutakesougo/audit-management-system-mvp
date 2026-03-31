import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { CallLog, CreateCallLogInput } from '@/domain/callLogs/schema';
import type { CallLogRepository, ListCallLogsOptions } from '@/domain/callLogs/repository';
import { applyCallLogStatusTransition } from '@/domain/callLogs/statusTransition';
import { CALL_LOG_LIST_TITLE, CALL_LOG_FIELDS } from './callLogFieldMap';
import { mapItemToCallLog } from './mapItemToCallLog';
import { buildCallLogCreateBody } from './buildCallLogCreateBody';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';

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
  'Created',
  'Modified',
] as const;

/**
 * DataProviderCallLogRepository
 * 
 * IDataProvider ベースの CallLogRepository 実装。
 */
export class DataProviderCallLogRepository implements CallLogRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;

  constructor(provider: IDataProvider, listTitle: string = CALL_LOG_LIST_TITLE) {
    this.provider = provider;
    this.listTitle = listTitle;
  }

  async list(options?: ListCallLogsOptions): Promise<CallLog[]> {
    const f = CALL_LOG_FIELDS;
    const clauses: string[] = [];

    if (options?.status) {
      clauses.push(buildEq(f.status, options.status));
    }

    if (options?.targetStaffName) {
      clauses.push(buildEq(f.targetStaffName, options.targetStaffName));
    }

    const filter = joinAnd(clauses) || undefined;

    const items = await this.provider.listItems<SpItem>(this.listTitle, {
      select: Array.from(SELECT_FIELDS),
      filter,
      orderby: `${f.receivedAt} desc`,
      top: 500,
    });

    return items.map(mapItemToCallLog);
  }

  async create(input: CreateCallLogInput, receivedByName: string): Promise<CallLog> {
    const body = buildCallLogCreateBody(input, receivedByName);

    const created = await this.provider.createItem<SpItem>(this.listTitle, body as Record<string, unknown>);
    const createdId = created?.Id ? Number(created.Id) : undefined;

    if (!createdId) {
      return mapItemToCallLog({ Id: -1, ...body } as SpItem);
    }

    // 作成直後の再取得で全フィールド（Created/Modified等）を確定させる
    try {
      const fetched = await this.provider.listItems<SpItem>(this.listTitle, {
        select: Array.from(SELECT_FIELDS),
        filter: buildEq(CALL_LOG_FIELDS.id, createdId),
        top: 1,
      });

      if (fetched?.[0]) {
        return mapItemToCallLog(fetched[0]);
      }
    } catch {
      // ignore
    }

    return mapItemToCallLog({ Id: createdId, ...body } as SpItem);
  }

  async updateStatus(id: string, status: CallLog['status']): Promise<void> {
    const f = CALL_LOG_FIELDS;
    const nowDate = new Date();
    
    // NOTE: 本来は現在のステータスを getById すべきだが、
    // 既存実装の SharePointCallLogRepository も 'new' 仮定で transition を計算しているため、
    // ここではその振る舞いを踏襲する。
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

    await this.provider.updateItem(this.listTitle, Number(id), payload);
  }
}
