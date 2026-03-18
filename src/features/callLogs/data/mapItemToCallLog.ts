/**
 * mapItemToCallLog
 *
 * SharePoint リストアイテム → CallLog ドメインオブジェクト変換。
 *
 * - 型を強制しない: SharePoint は string / null / undefined を混在して返すため
 *   全フィールドを安全にキャストする
 * - 規約: このモジュールは純粋関数のみ。副作用禁止
 */

import type { CallLog, CallLogStatus, CallLogUrgency } from '@/domain/callLogs/schema';
import { CALL_LOG_FIELDS } from './callLogFieldMap';

type SpItem = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;

const strOrUndef = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;

const coerceStatus = (v: unknown): CallLogStatus => {
  if (v === 'new' || v === 'callback_pending' || v === 'done') return v;
  return 'new';
};

const coerceUrgency = (v: unknown): CallLogUrgency => {
  if (v === 'normal' || v === 'today' || v === 'urgent') return v;
  return 'normal';
};

/**
 * SharePoint アイテムを CallLog ドメイン型にマップする。
 *
 * @param item - SharePoint getListItems で返ってきた生 JSON オブジェクト
 * @returns CallLog
 *
 * @internal テスト用に公開。プロダクションコードでは SharePointCallLogRepository 経由で使うこと。
 */
export const mapItemToCallLog = (item: SpItem): CallLog => {
  const f = CALL_LOG_FIELDS;

  return {
    id: String(item['Id'] ?? item['id'] ?? ''),
    receivedAt: str(item[f.receivedAt], new Date(0).toISOString()),
    callerName: str(item[f.callerName], '(不明)'),
    callerOrg: strOrUndef(item[f.callerOrg]),
    targetStaffName: str(item[f.targetStaffName], '(不明)'),
    receivedByName: str(item[f.receivedByName], '(不明)'),
    subject: str(item['Title'], '(件名なし)'),
    message: str(item[f.message], ''),
    needCallback: bool(item[f.needCallback]),
    urgency: coerceUrgency(item[f.urgency]),
    status: coerceStatus(item[f.status]),
    relatedUserId: strOrUndef(item[f.relatedUserId]),
    relatedUserName: strOrUndef(item[f.relatedUserName]),
    callbackDueAt: strOrUndef(item[f.callbackDueAt]),
    completedAt: strOrUndef(item[f.completedAt]),
    createdAt: str(item[f.created], new Date(0).toISOString()),
    updatedAt: str(item[f.modified], new Date(0).toISOString()),
  };
};
