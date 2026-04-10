/**
 * ISP 三層モデル — 第1層: ISP 基盤スキーマ
 *
 * 共通フィールド・ステータス定義・ISP ドメインモデル本体を定義する。
 * コンプライアンスメタデータは ispComplianceSchema.ts を参照。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

import { z } from 'zod';
import { userSnapshotSchema } from '@/domain/user/userRelation';
import { ispComplianceMetadataSchema, isoDateString } from './ispComplianceSchema';

export { isoDateString };

// ─────────────────────────────────────────────
// 共通
// ─────────────────────────────────────────────

/** 監査証跡の共通スキーマ */
export const baseAuditFieldsSchema = z.object({
  id: z.string().min(1, 'ID は必須です'),
  createdAt: isoDateString,
  createdBy: z.string().min(1, '作成者は必須です'),
  updatedAt: isoDateString,
  updatedBy: z.string().min(1, '更新者は必須です'),
  version: z.number().int().min(1, '版番号は 1 以上'),
});

export type BaseAuditFields = z.infer<typeof baseAuditFieldsSchema>;

// ─────────────────────────────────────────────
// 第1層: ISP（個別支援計画）ステータス
// ─────────────────────────────────────────────

export const ispStatusValues = [
  'assessment',
  'proposal',
  'meeting',
  'consent_pending',
  'active',
  'monitoring',
  'revision',
  'closed',
] as const;

export const ispStatusSchema = z.enum(ispStatusValues);
export type IspStatus = z.infer<typeof ispStatusSchema>;

/** ISP ステータスの日本語ラベル */
export const ISP_STATUS_DISPLAY: Record<IspStatus, string> = {
  assessment: 'アセスメント',
  proposal: '原案作成',
  meeting: '会議',
  consent_pending: '同意待ち',
  active: '実施中',
  monitoring: 'モニタリング',
  revision: '見直し',
  closed: '終了',
} as const;

/** ISP 状態遷移マップ（ガード用） */
export const ISP_TRANSITIONS: Record<IspStatus, readonly IspStatus[]> = {
  assessment: ['proposal'],
  proposal: ['meeting'],
  meeting: ['consent_pending'],
  consent_pending: ['active'],
  active: ['monitoring'],
  monitoring: ['revision', 'closed'],
  revision: ['proposal'],
  closed: [],
} as const;

// ─────────────────────────────────────────────
// 対象サービス種別（ISP コンプライアンスで先行参照するため最上位定義）
// ─────────────────────────────────────────────

/** 対象サービス種別 */
export const applicableServiceTypeValues = [
  'daily_life_care',          // 生活介護
  'residential_support',      // 施設入所支援
  'short_stay',               // 短期入所
  'group_home',               // 共同生活援助
  'behavior_support',         // 行動援護
  'home_care',                // 居宅介護
  'other',
] as const;

export const applicableServiceTypeSchema = z.enum(applicableServiceTypeValues);
export type ApplicableServiceType = z.infer<typeof applicableServiceTypeSchema>;

export const SERVICE_TYPE_DISPLAY: Record<ApplicableServiceType, string> = {
  daily_life_care: '生活介護',
  residential_support: '施設入所支援',
  short_stay: '短期入所',
  group_home: '共同生活援助',
  behavior_support: '行動援護',
  home_care: '居宅介護',
  other: 'その他',
} as const;

// ─────────────────────────────────────────────
// 第1層: ISP フォーム・ドメインモデル・SP行・一覧型
// ─────────────────────────────────────────────

/** ISP のフォーム入力バリデーション */
export const ispFormSchema = z.object({
  userId: z.string().min(1, '利用者は必須です'),
  title: z.string().min(1, '計画名は必須です').max(200),

  planStartDate: isoDateString,
  planEndDate: isoDateString,

  userIntent: z.string().min(1, '本人の意向は必須です').max(2000),
  familyIntent: z.string().max(2000).default(''),
  overallSupportPolicy: z.string().min(1, '総合的支援方針は必須です').max(2000),
  qolIssues: z.string().max(2000).default(''),

  longTermGoals: z.array(z.string().min(1)).min(1, '長期目標を1つ以上設定してください'),
  shortTermGoals: z.array(z.string().min(1)).min(1, '短期目標を1つ以上設定してください'),

  supportSummary: z.string().max(2000).default(''),
  precautions: z.string().max(2000).default(''),

  // ── 生活介護 追加項目（更新パッチ B-1） ──
  /** 医療的配慮事項 */
  medicalConsiderations: z.string().max(2000).optional(),
  /** 緊急時対応計画 */
  emergencyResponsePlan: z.string().max(2000).optional(),
  /** 権利擁護に関する記載 */
  rightsAdvocacy: z.string().max(2000).optional(),
  /** 契約上のサービス開始日（planStartDate と区別） */
  serviceStartDate: isoDateString.optional(),
  /** 実際の初回サービス提供日 */
  firstServiceDate: isoDateString.optional(),

  status: ispStatusSchema.default('assessment'),

  // ── 生活介護コンプライアンスメタデータ ──
  compliance: ispComplianceMetadataSchema.optional(),

  // ── 利用者スナップショット（作成時点の利用者マスタ属性を凍結） ──
  userSnapshot: userSnapshotSchema.optional(),
});

export type IspFormValues = z.infer<typeof ispFormSchema>;

/** ISP のドメインモデル */
export const individualSupportPlanSchema = baseAuditFieldsSchema.extend({
  userId: z.string().min(1),
  title: z.string(),

  planStartDate: isoDateString,
  planEndDate: isoDateString,

  userIntent: z.string(),
  familyIntent: z.string().default(''),
  overallSupportPolicy: z.string(),
  qolIssues: z.string().default(''),

  longTermGoals: z.array(z.string()),
  shortTermGoals: z.array(z.string()),

  supportSummary: z.string().default(''),
  precautions: z.string().default(''),

  // ── 生活介護 追加項目（更新パッチ B-2） ──
  medicalConsiderations: z.string().optional(),
  emergencyResponsePlan: z.string().optional(),
  rightsAdvocacy: z.string().optional(),
  serviceStartDate: isoDateString.optional(),
  firstServiceDate: isoDateString.optional(),

  consentAt: z.string().nullable().default(null),
  deliveredAt: z.string().nullable().default(null),

  monitoringSummary: z.string().default(''),
  lastMonitoringAt: z.string().nullable().default(null),
  nextReviewAt: z.string().nullable().default(null),

  status: ispStatusSchema,
  isCurrent: z.boolean().default(true),

  // ── 生活介護コンプライアンスメタデータ（A-1 追加） ──
  compliance: ispComplianceMetadataSchema.optional(),

  // ── 利用者スナップショット（作成時点の利用者マスタ属性を凍結） ──
  userSnapshot: userSnapshotSchema.optional(),
});

export type IndividualSupportPlan = z.infer<typeof individualSupportPlanSchema>;

/** ISP の SharePoint 行パーススキーマ */
export const ispSpRowSchema = z.object({
  Id: z.number(),
  Title: z.string().default(''),
  UserLookupId: z.number().nullable().default(null),
  UserCode: z.string().nullable().default(null),
  PlanStartDate: z.string().nullable().default(null),
  PlanEndDate: z.string().nullable().default(null),
  FormDataJson: z.string().default('{}'),
  Status: ispStatusSchema.default('assessment'),
  VersionNo: z.number().default(1),
  IsCurrent: z.boolean().default(true),
  ConsentAt: z.string().nullable().default(null),
  DeliveredAt: z.string().nullable().default(null),
  LastMonitoringAt: z.string().nullable().default(null),
  NextReviewAt: z.string().nullable().default(null),
  // ── 生活介護コンプライアンス ──
  ComplianceJson: z.string().nullable().default(null),
  Created: z.string().nullable().optional(),
  Modified: z.string().nullable().optional(),
});

export type IspSpRow = z.infer<typeof ispSpRowSchema>;

/** ISP 一覧用の軽量型 */
export const ispListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  planStartDate: z.string(),
  planEndDate: z.string(),
  status: ispStatusSchema,
  nextReviewAt: z.string().nullable().default(null),
  isCurrent: z.boolean(),
});

export type IspListItem = z.infer<typeof ispListItemSchema>;

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * ISP の状態遷移が有効かを検証する
 */
export function isValidIspTransition(
  current: IspStatus,
  next: IspStatus,
): boolean {
  const allowed = ISP_TRANSITIONS[current];
  return (allowed as readonly string[]).includes(next);
}

/**
 * ISP の見直し期限までの残日数を計算する
 */
export function daysUntilIspReview(
  nextReviewAt: string | null,
  today?: string,
): number | null {
  if (!nextReviewAt) return null;
  const due = new Date(nextReviewAt);
  const now = today ? new Date(today) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

// 承認ロジック・コンプライアンスユーティリティは index.ts (schema barrel) 経由で公開
