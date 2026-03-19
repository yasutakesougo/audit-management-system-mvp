/**
 * Schedule Ops Schema — 運営ビュー向けの Zod schema 拡張
 *
 * 既存 ScheduleDetailSchema を base に、運営業務固有のフィールドを追加する。
 *
 * 設計判断:
 *   - assignedStaffId は既存 ScheduleDetailSchema に存在するため再定義しない
 *   - supportTags 列は持たない（フラグから deriveSupportTags() で導出）
 *   - opsStatus と既存 status は責務が異なるため併存
 *     - status: 予約ステータス (Planned/Postponed/Cancelled)
 *     - opsStatus: 当日運営ステータス (planned/confirmed/changed/cancelled/completed)
 */

import { z } from 'zod';

import { ScheduleDetailSchema } from './schema';

// ─── Support Tags ────────────────────────────────────────────────────────────

export const SUPPORT_TAGS = [
  'pickup',      // 送迎
  'meal',        // 昼食
  'bath',        // 入浴
  'medication',  // 服薬
  'overnight',   // 宿泊
  'extension',   // 延長
  'needsReview', // 要確認
  'medical',     // 医療配慮
  'behavioral',  // 行動配慮
  'firstVisit',  // 初回
  'changed',     // 変更
] as const;

export const SupportTagSchema = z.enum(SUPPORT_TAGS);
export type SupportTag = z.infer<typeof SupportTagSchema>;

// ─── Ops Status ──────────────────────────────────────────────────────────────

export const OPS_STATUSES = [
  'planned',    // 予定
  'confirmed',  // 確定
  'changed',    // 変更あり
  'cancelled',  // キャンセル
  'completed',  // 対応済み
] as const;

export const OpsStatusSchema = z.enum(OPS_STATUSES);
export type OpsStatus = z.infer<typeof OpsStatusSchema>;

// ─── Schedule Ops Extension ──────────────────────────────────────────────────
// ScheduleDetailSchema には以下が既に定義されている:
//   - assignedStaffId: z.string().optional()
//   - assignedTo: z.string().nullable().optional()
//   - category, serviceType, userId, userName, etc.
// ここでは「運営ビュー固有」のフィールドのみ定義する。

export const ScheduleOpsExtensionSchema = z.object({
  // 担当者名（表示用 — assignedStaffId の補助）
  assignedStaffName: z.string().optional(),

  // Support flags（保存の元データ = SSOT）
  hasPickup: z.boolean().optional(),
  hasMeal: z.boolean().optional(),
  hasBath: z.boolean().optional(),
  hasMedication: z.boolean().optional(),
  hasOvernight: z.boolean().optional(),

  // Attention
  hasAttention: z.boolean().optional(),
  attentionSummary: z.string().optional(),
  medicalNote: z.string().optional(),
  behavioralNote: z.string().optional(),

  // Ops status (当日運営ステータス)
  opsStatus: OpsStatusSchema.optional(),

  // Handoff
  handoffSummary: z.string().optional(),

  // Related record link
  relatedRecordId: z.string().optional(),
});

// ─── Full Ops Schema ─────────────────────────────────────────────────────────

export const ScheduleOpsSchema = ScheduleDetailSchema.merge(
  ScheduleOpsExtensionSchema,
);
export type ScheduleOpsItem = z.infer<typeof ScheduleOpsSchema>;
