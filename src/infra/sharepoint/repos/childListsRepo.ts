/**
 * childListsRepo — SupportProcedure_Results / Approval_Logs 読み書き
 *
 * 設計方針:
 * - IDataProvider 経由でアクセス（@/lib/sp/* 直接参照禁止ルールに準拠）
 * - createApprovalLog は冪等（ParentScheduleId + ApprovedAt で重複ガード）
 * - 二重書き込み失敗はwarnのみ（旧リストの成功を最優先）
 * - telemetry は trackSpEvent 経由で DataIntegrity / Nightly Patrol に連携可能
 * - 将来のバルク取得のために $filter=ParentScheduleId in (...) の余地を残す
 */

import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { buildEq, buildDateTime, joinAnd } from '@/sharepoint/query/builders';
import {
  APPROVAL_LOG_FIELD_MAP,
  APPROVAL_LOGS_LIST_TITLE,
  RESULTS_FIELD_MAP,
  RESULTS_LIST_TITLE,
} from '@/sharepoint/fields/childListSchemas';
import {
  spApprovalLogRowSchema,
  spResultRowSchema,
  type SpApprovalLogRow,
  type SpResultRow,
} from '@/features/schedules/data/spChildRowSchemas';

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * 指定スケジュールIDに紐づく実績行を取得。
 *
 * 将来バルク取得が必要になった場合は parentScheduleIds: number[] を受けて
 * $filter=ParentScheduleId in (1,2,3) に拡張する。
 */
export async function queryResults(
  dp: IDataProvider,
  parentScheduleId: number,
): Promise<SpResultRow[]> {
  const raw = await dp.listItems<unknown>(RESULTS_LIST_TITLE, {
    filter: buildEq(RESULTS_FIELD_MAP.parentScheduleId, parentScheduleId),
    select: ['Id', 'ParentScheduleId', 'ResultDate', 'ResultStatus', 'ResultNote', 'StaffCode', 'Created', 'Modified'],
    orderby: 'ResultDate desc',
  });

  return raw.flatMap(item => {
    const result = spResultRowSchema.safeParse(item);
    if (result.success) return [result.data];
    console.warn('[queryResults] Invalid row skipped', { item });
    return [];
  });
}

/**
 * 指定スケジュールIDの承認ログを取得（新しい順）。
 *
 * 将来バルク取得: parentScheduleIds: number[] を受けて
 * $filter=ParentScheduleId in (1,2,3) に拡張可能。
 */
export async function queryApprovalLogs(
  dp: IDataProvider,
  parentScheduleId: number,
): Promise<SpApprovalLogRow[]> {
  const raw = await dp.listItems<unknown>(APPROVAL_LOGS_LIST_TITLE, {
    filter: buildEq(APPROVAL_LOG_FIELD_MAP.parentScheduleId, parentScheduleId),
    select: ['Id', 'ParentScheduleId', 'ApprovedBy', 'ApprovedAt', 'ApprovalNote', 'ApprovalAction', 'Created'],
    orderby: 'ApprovedAt desc',
  });

  return raw.flatMap(item => {
    const result = spApprovalLogRowSchema.safeParse(item);
    if (result.success) return [result.data];
    console.warn('[queryApprovalLogs] Invalid row skipped', { item });
    return [];
  });
}

// ─── Write ───────────────────────────────────────────────────────────────────

export type CreateApprovalLogInput = {
  parentScheduleId: number;
  approvedBy: string;
  approvedAt: string;        // ISO 8601
  approvalNote?: string | null;
  action: 'Approved' | 'Rejected' | 'Reverted';
};

/**
 * 冪等性チェック: ParentScheduleId + ApprovedAt の組み合わせで既存レコードを確認。
 * 重複登録を防ぐ（移行スクリプトの複数回実行・リトライ対策）。
 * ApprovedAt はインデックス付きなので5000件制限を回避できる。
 */
async function checkApprovalLogExists(
  dp: IDataProvider,
  parentScheduleId: number,
  approvedAt: string,
): Promise<boolean> {
  try {
    const rows = await dp.listItems<{ Id: number }>(APPROVAL_LOGS_LIST_TITLE, {
      filter: joinAnd([
        buildEq(APPROVAL_LOG_FIELD_MAP.parentScheduleId, parentScheduleId),
        buildEq(APPROVAL_LOG_FIELD_MAP.approvedAt, buildDateTime(approvedAt)),
      ]),
      select: ['Id'],
      top: 1,
    });
    return rows.length > 0;
  } catch {
    // チェック失敗時は書き込みを試みる（安全側に倒す）
    return false;
  }
}

/**
 * 承認ログを Approval_Logs リストに書き込む（冪等）。
 *
 * - 呼び出し元は VITE_CHILD_LISTS_WRITE_ENABLED フラグで制御すること
 * - 書き込み失敗は warn + telemetry のみ（致命的エラーにしない）
 */
export async function createApprovalLog(
  dp: IDataProvider,
  input: CreateApprovalLogInput,
): Promise<void> {
  const { parentScheduleId, approvedBy, approvedAt, approvalNote, action } = input;

  // ① 冪等性ガード
  const alreadyExists = await checkApprovalLogExists(dp, parentScheduleId, approvedAt);
  if (alreadyExists) {
    trackSpEvent('sp:approval_log_skipped', {
      listName: APPROVAL_LOGS_LIST_TITLE,
      details: { parentScheduleId, approvedAt, reason: 'duplicate' },
    });
    return;
  }

  const body = {
    Title: `${parentScheduleId}-${approvedAt}`,
    ParentScheduleId: parentScheduleId,
    ApprovedBy: approvedBy,
    ApprovedAt: approvedAt,
    ApprovalNote: approvalNote ?? '',
    ApprovalAction: action,
  };

  try {
    await dp.createItem(APPROVAL_LOGS_LIST_TITLE, body);

    // ② 成功 telemetry — DataIntegrity / Nightly Patrol が購読可能
    trackSpEvent('sp:approval_log_created', {
      listName: APPROVAL_LOGS_LIST_TITLE,
      details: { parentScheduleId, action },
    });
  } catch (err) {
    trackSpEvent('sp:approval_log_failed', {
      listName: APPROVAL_LOGS_LIST_TITLE,
      error: err instanceof Error ? err.message : String(err),
      details: { parentScheduleId },
    });
    console.warn('[createApprovalLog] dual-write failed', err);
  }
}
