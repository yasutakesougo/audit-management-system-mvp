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

// ── Field map constants (OData filter SSOT) ─────────────────────────────────

/** SupportProcedure_Results フィールドマップ */
export const RESULTS_FIELD_MAP = {
  parentScheduleId: 'ParentScheduleId',
  resultDate: 'ResultDate',
  resultStatus: 'ResultStatus',
  resultNote: 'ResultNote',
  staffCode: 'StaffCode',
} as const;

/** Approval_Logs フィールドマップ */
export const APPROVAL_LOG_FIELD_MAP = {
  parentScheduleId: 'ParentScheduleId',
  approvedBy: 'ApprovedBy',
  approvedAt: 'ApprovedAt',
  approvalNote: 'ApprovalNote',
  approvalAction: 'ApprovalAction',
} as const;

// ── SupportProcedure_Results ─────────────────────────────────────────────────

export const RESULTS_FIELDS: SpFieldDef[] = [
  {
    internalName: 'ParentScheduleId',
    type: 'Number',
    displayName: 'ParentScheduleId',
    required: true,
    indexed: true,          // $filter=ParentScheduleId eq X が5000件制限に引っかからないよう必須
    addToDefaultView: true,
  },
  {
    internalName: 'ResultDate',
    type: 'DateTime',
    displayName: 'ResultDate',
    dateTimeFormat: 'DateOnly',
    required: true,
  },
  {
    internalName: 'ResultStatus',
    type: 'Choice',
    displayName: 'ResultStatus',
    choices: ['Completed', 'Skipped', 'PartiallyDone'] as const,
    required: false,
  },
  {
    internalName: 'ResultNote',
    type: 'Note',
    displayName: 'ResultNote',
    richText: false,
    required: false,
  },
  {
    internalName: 'StaffCode',
    type: 'Text',
    displayName: 'StaffCode',
    required: false,
  },
];

// ── Approval_Logs ────────────────────────────────────────────────────────────

export const APPROVAL_LOG_FIELDS: SpFieldDef[] = [
  {
    internalName: 'ParentScheduleId',
    type: 'Number',
    displayName: 'ParentScheduleId',
    required: true,
    indexed: true,          // 同上
    addToDefaultView: true,
  },
  {
    internalName: 'ApprovedBy',
    type: 'Text',
    displayName: 'ApprovedBy',
    required: true,
  },
  {
    internalName: 'ApprovedAt',
    type: 'DateTime',
    displayName: 'ApprovedAt',
    dateTimeFormat: 'DateTime',
    required: true,
    indexed: true,          // ParentScheduleId + ApprovedAt の複合ユニーク判定に使用
  },
  {
    internalName: 'ApprovalNote',
    type: 'Note',
    displayName: 'ApprovalNote',
    richText: false,
    required: false,
  },
  {
    internalName: 'ApprovalAction',
    type: 'Choice',
    displayName: 'ApprovalAction',
    choices: ['Approved', 'Rejected', 'Reverted'] as const,
    required: true,
  },
];

// ── User_Feature_Flags ────────────────────────────────────────────────────────

export const USER_FLAG_FIELDS: SpFieldDef[] = [
  {
    internalName: 'UserCode',
    type: 'Text',
    displayName: 'UserCode',
    required: true,
    indexed: true,
    addToDefaultView: true,
  },
  {
    internalName: 'FlagKey',
    type: 'Text',
    displayName: 'FlagKey',
    required: true,
  },
  {
    internalName: 'FlagValue',
    type: 'Text',
    displayName: 'FlagValue',
    required: false,
  },
  {
    internalName: 'ExpiresAt',
    type: 'DateTime',
    displayName: 'ExpiresAt',
    dateTimeFormat: 'DateTime',
    required: false,
  },
];
