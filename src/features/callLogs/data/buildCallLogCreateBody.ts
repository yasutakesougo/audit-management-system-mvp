/**
 * buildCallLogCreateBody
 *
 * CreateCallLogInput → SharePoint 作成ペイロード変換。
 *
 * - status は 'new' に固定（アプリ側責務）
 * - receivedByName はログインユーザーから注入
 * - receivedAt が省略された場合は現在日時を使用
 * - 規約: このモジュールは純粋関数のみ。副作用禁止
 */

import type { CreateCallLogInput } from '@/domain/callLogs/schema';
import { CALL_LOG_FIELDS } from './callLogFieldMap';

/**
 * CreateCallLogInput を SharePoint add/update ペイロードに変換する。
 *
 * @param input - フォームから収集した入力値
 * @param receivedByName - ログインユーザーのフルネーム
 * @param now - テスト差し替え用の現在日時 (省略時は new Date())
 * @returns SharePoint API に渡す Record<string, unknown>
 *
 * @internal テスト用に公開。プロダクションコードでは SharePointCallLogRepository 経由で使うこと。
 */
export const buildCallLogCreateBody = (
  input: CreateCallLogInput,
  receivedByName: string,
  now = new Date(),
): Record<string, unknown> => {
  const f = CALL_LOG_FIELDS;
  const receivedAt = input.receivedAt ?? now.toISOString();

  // Title は "件名 (発信者名)" の複合で生成する
  const title = `${input.subject} (${input.callerName})`;

  return {
    Title: title,
    [f.receivedAt]: receivedAt,
    [f.callerName]: input.callerName,
    [f.callerOrg]: input.callerOrg ?? null,
    [f.targetStaffName]: input.targetStaffName,
    [f.receivedByName]: receivedByName,
    [f.message]: input.message,
    [f.needCallback]: input.needCallback,
    [f.urgency]: input.urgency ?? 'normal',
    [f.status]: 'new', // 作成時は必ず new
    [f.relatedUserId]: input.relatedUserId ?? null,
    [f.relatedUserName]: input.relatedUserName ?? null,
    [f.callbackDueAt]: input.callbackDueAt ?? null,
  };
};
