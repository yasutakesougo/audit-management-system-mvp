/**
 * 子リスト定義 — SupportProcedure_Results / Approval_Logs / User_Feature_Flags
 *
 * - ParentScheduleId には必ず indexed: true を付ける（5000件制限回避）
 * - Lookup 型は使わず Number で親子関係を管理（SP制約地獄回避）
 */
import type { SpFieldDef } from '@/lib/sp/types';

export const RESULTS_LIST_TITLE      = 'SupportProcedure_Results';
export const APPROVAL_LOGS_LIST_TITLE = 'Approval_Logs';
export const USER_FLAGS_LIST_TITLE   = 'User_Feature_Flags';

// ── SupportProcedure_Results ─────────────────────────────────────────────────

export const RESULTS_FIELDS: SpFieldDef[] = [
  {
    internalName: 'ParentScheduleId',
    type: 'Number',
    displayName: '親スケジュールID',
    required: true,
    indexed: true,          // $filter=ParentScheduleId eq X が5000件制限に引っかからないよう必須
    addToDefaultView: true,
  },
  {
    internalName: 'ResultDate',
    type: 'DateTime',
    displayName: '結果日',
    dateTimeFormat: 'DateOnly',
    required: true,
  },
  {
    internalName: 'ResultStatus',
    type: 'Choice',
    displayName: '結果ステータス',
    choices: ['Completed', 'Skipped', 'PartiallyDone'] as const,
    required: false,
  },
  {
    internalName: 'ResultNote',
    type: 'Note',
    displayName: '実施メモ',
    richText: false,
    required: false,
  },
  {
    internalName: 'StaffCode',
    type: 'Text',
    displayName: '担当職員コード',
    required: false,
  },
];

// ── Approval_Logs ────────────────────────────────────────────────────────────

export const APPROVAL_LOG_FIELDS: SpFieldDef[] = [
  {
    internalName: 'ParentScheduleId',
    type: 'Number',
    displayName: '親スケジュールID',
    required: true,
    indexed: true,          // 同上
    addToDefaultView: true,
  },
  {
    internalName: 'ApprovedBy',
    type: 'Text',
    displayName: '承認者コード',
    required: true,
  },
  {
    internalName: 'ApprovedAt',
    type: 'DateTime',
    displayName: '承認日時',
    dateTimeFormat: 'DateTime',
    required: true,
    indexed: true,          // ParentScheduleId + ApprovedAt の複合ユニーク判定に使用
  },
  {
    internalName: 'ApprovalNote',
    type: 'Note',
    displayName: '承認メモ',
    richText: false,
    required: false,
  },
  {
    internalName: 'ApprovalAction',
    type: 'Choice',
    displayName: '承認アクション',
    choices: ['Approved', 'Rejected', 'Reverted'] as const,
    required: true,
  },
];

// ── User_Feature_Flags ────────────────────────────────────────────────────────

export const USER_FLAG_FIELDS: SpFieldDef[] = [
  {
    internalName: 'UserCode',
    type: 'Text',
    displayName: 'ユーザーコード',
    required: true,
    indexed: true,
    addToDefaultView: true,
  },
  {
    internalName: 'FlagKey',
    type: 'Text',
    displayName: 'フラグキー',
    required: true,
  },
  {
    internalName: 'FlagValue',
    type: 'Text',
    displayName: 'フラグ値',
    required: false,
  },
  {
    internalName: 'ExpiresAt',
    type: 'DateTime',
    displayName: '有効期限',
    dateTimeFormat: 'DateTime',
    required: false,
  },
];
