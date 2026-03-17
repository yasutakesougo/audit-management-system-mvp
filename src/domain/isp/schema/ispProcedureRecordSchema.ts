/**
 * ISP 三層モデル — 第3層: 支援手順書兼記録スキーマ
 *
 * 支援手順実施記録の実行ステータス・フォーム・
 * ドメインモデル・SP行・一覧型を定義する。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

import { z } from 'zod';
import { baseAuditFieldsSchema, isoDateString } from './ispBaseSchema';

export const procedureExecutionStatusValues = [
  'planned',
  'done',
  'skipped',
  'partially_done',
] as const;

export const procedureExecutionStatusSchema = z.enum(procedureExecutionStatusValues);
export type ProcedureExecutionStatus = z.infer<typeof procedureExecutionStatusSchema>;

/** 実施ステータスの日本語ラベル */
export const EXECUTION_STATUS_DISPLAY: Record<ProcedureExecutionStatus, string> = {
  planned: '予定',
  done: '実施済',
  skipped: '未実施',
  partially_done: '一部実施',
} as const;

/** 支援手順実施記録のフォーム入力バリデーション */
export const procedureRecordFormSchema = z.object({
  userId: z.string().min(1, '利用者は必須です'),
  planningSheetId: z.string().min(1, '紐づく支援計画シートを選択してください'),
  ispId: z.string().optional(),

  recordDate: isoDateString,
  timeSlot: z.string().max(50).default(''),
  activity: z.string().max(200).default(''),

  procedureText: z.string().min(1, '支援手順は必須です').max(3000),
  executionStatus: procedureExecutionStatusSchema.default('planned'),

  userResponse: z.string().max(3000).default(''),
  specialNotes: z.string().max(3000).default(''),
  handoffNotes: z.string().max(3000).default(''),

  performedBy: z.string().min(1, '実施者は必須です'),
  performedAt: isoDateString,
});

export type ProcedureRecordFormValues = z.infer<typeof procedureRecordFormSchema>;

/** 支援手順実施記録のドメインモデル */
export const supportProcedureRecordSchema = baseAuditFieldsSchema.extend({
  userId: z.string(),
  ispId: z.string().nullable().default(null),
  planningSheetId: z.string(),

  recordDate: isoDateString,
  timeSlot: z.string().default(''),
  activity: z.string().default(''),

  procedureText: z.string(),
  executionStatus: procedureExecutionStatusSchema,

  userResponse: z.string().default(''),
  specialNotes: z.string().default(''),
  handoffNotes: z.string().default(''),

  performedBy: z.string(),
  performedAt: isoDateString,
});

export type SupportProcedureRecord = z.infer<typeof supportProcedureRecordSchema>;

/** 支援手順実施記録の SharePoint 行パーススキーマ */
export const procedureRecordSpRowSchema = z.object({
  Id: z.number(),
  Title: z.string().default(''),
  UserLookupId: z.number().nullable().default(null),
  UserCode: z.string().nullable().default(null),
  ISPLookupId: z.number().nullable().default(null),
  ISPId: z.string().nullable().default(null),
  PlanningSheetLookupId: z.number().nullable().default(null),
  PlanningSheetId: z.string().nullable().default(null),
  RecordDate: z.string().nullable().default(null),
  TimeSlot: z.string().nullable().default(null),
  Activity: z.string().nullable().default(null),
  ProcedureText: z.string().default(''),
  ExecutionStatus: procedureExecutionStatusSchema.default('planned'),
  UserResponse: z.string().nullable().default(null),
  SpecialNotes: z.string().nullable().default(null),
  HandoffNotes: z.string().nullable().default(null),
  PerformedBy: z.string().nullable().default(null),
  PerformedAt: z.string().nullable().default(null),
  Created: z.string().nullable().optional(),
  Modified: z.string().nullable().optional(),
});

export type ProcedureRecordSpRow = z.infer<typeof procedureRecordSpRowSchema>;

/** 支援手順実施記録一覧用の軽量型 */
export const procedureRecordListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planningSheetId: z.string(),
  recordDate: z.string(),
  timeSlot: z.string().nullable().default(null),
  activity: z.string().nullable().default(null),
  executionStatus: procedureExecutionStatusSchema,
  performedBy: z.string(),
});

export type ProcedureRecordListItem = z.infer<typeof procedureRecordListItemSchema>;
