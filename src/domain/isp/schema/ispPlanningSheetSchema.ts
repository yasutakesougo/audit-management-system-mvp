/**
 * ISP 三層モデル — 第2層: 支援計画シートスキーマ
 *
 * 職員資格・加算種別・インテーク・アセスメント・プランニング設計・
 * 支援計画シートのドメインモデルを定義する。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

import { z } from 'zod';
import {
  baseAuditFieldsSchema,
  isoDateString,
  applicableServiceTypeSchema,
} from './ispBaseSchema';

// ── 制度関連 enum ──

/** 職員資格区分（支援計画シート作成者の資格要件判定用） */
export const staffQualificationValues = [
  'practical_training',
  'basic_training',
  'behavior_guidance_training',
  'core_person_training',
  'other',
  'unknown',
] as const;

export const staffQualificationSchema = z.enum(staffQualificationValues);
export type StaffQualification = z.infer<typeof staffQualificationSchema>;

export const STAFF_QUALIFICATION_DISPLAY: Record<StaffQualification, string> = {
  practical_training: '実践研修修了',
  basic_training: '基礎研修修了',
  behavior_guidance_training: '行動援護従業者養成研修修了',
  core_person_training: '中核的人材養成研修修了',
  other: 'その他',
  unknown: '未確認',
} as const;

// NOTE: applicableServiceType は ISP コンプライアンスメタデータのため ispBaseSchema で定義済み

/** 対象加算種別 */
export const applicableAddOnTypeValues = [
  'severe_disability_support',      // 重度障害者支援加算
  'behavior_support_coordination',  // 行動障害支援連携加算
  'specialized_support',            // 専門的支援加算
  'none',
] as const;

export const applicableAddOnTypeSchema = z.enum(applicableAddOnTypeValues);
export type ApplicableAddOnType = z.infer<typeof applicableAddOnTypeSchema>;

export const ADD_ON_TYPE_DISPLAY: Record<ApplicableAddOnType, string> = {
  severe_disability_support: '重度障害者支援加算',
  behavior_support_coordination: '行動障害支援連携加算',
  specialized_support: '専門的支援加算',
  none: 'なし',
} as const;

/** 対象者判定スナップショット（作成時点の利用者情報を凍結保存） */
export const regulatoryBasisSnapshotSchema = z.object({
  supportLevel: z.number().nullable().default(null),
  behaviorScore: z.number().nullable().default(null),
  serviceType: z.string().nullable().default(null),
  eligibilityCheckedAt: z.string().nullable().default(null),
}).default({ supportLevel: null, behaviorScore: null, serviceType: null, eligibilityCheckedAt: null });

export type RegulatoryBasisSnapshot = z.infer<typeof regulatoryBasisSnapshotSchema>;

// ── 実務モデル: インテーク ──

/** 対象行動の下書き（インテーク段階） */
export const draftBehaviorSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  frequency: z.string().default(''),
});

export type DraftBehavior = z.infer<typeof draftBehaviorSchema>;

/** インテーク（情報収集）セクション */
export const planningIntakeSchema = z.object({
  presentingProblem: z.string().default(''),
  targetBehaviorsDraft: z.array(draftBehaviorSchema).default([]),
  /** 行動関連項目合計点（0〜24） */
  behaviorItemsTotal: z.number().int().min(0).max(24).nullable().default(null),
  incidentSummaryLast30d: z.string().default(''),
  communicationModes: z.array(z.string()).default([]),
  sensoryTriggers: z.array(z.string()).default([]),
  medicalFlags: z.array(z.string()).default([]),
  consentScope: z.array(z.string()).default([]),
  consentDate: z.string().nullable().default(null),
}).default({
  presentingProblem: '',
  targetBehaviorsDraft: [],
  behaviorItemsTotal: null,
  incidentSummaryLast30d: '',
  communicationModes: [],
  sensoryTriggers: [],
  medicalFlags: [],
  consentScope: [],
  consentDate: null,
});

export type PlanningIntake = z.infer<typeof planningIntakeSchema>;

// ── 実務モデル: アセスメント ──

/** 対象行動の操作的定義 */
export const assessedBehaviorSchema = z.object({
  name: z.string().min(1),
  operationalDefinition: z.string().default(''),
  frequency: z.string().default(''),
  intensity: z.string().default(''),
  duration: z.string().default(''),
});

export type AssessedBehavior = z.infer<typeof assessedBehaviorSchema>;

/** ABC 観察イベント */
export const abcEventSchema = z.object({
  antecedent: z.string().default(''),
  behavior: z.string().default(''),
  consequence: z.string().default(''),
  date: z.string().nullable().default(null),
  notes: z.string().default(''),
});

export type AbcEvent = z.infer<typeof abcEventSchema>;

/** 行動の機能仮説 */
export const behaviorHypothesisSchema = z.object({
  function: z.string().default(''),
  evidence: z.string().default(''),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
});

export type BehaviorHypothesis = z.infer<typeof behaviorHypothesisSchema>;

export const riskLevelValues = ['low', 'medium', 'high'] as const;
export const riskLevelSchema = z.enum(riskLevelValues);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

/** アセスメントセクション */
export const planningAssessmentSchema = z.object({
  targetBehaviors: z.array(assessedBehaviorSchema).default([]),
  abcEvents: z.array(abcEventSchema).default([]),
  hypotheses: z.array(behaviorHypothesisSchema).default([]),
  riskLevel: riskLevelSchema.default('low'),
  healthFactors: z.array(z.string()).default([]),
  teamConsensusNote: z.string().default(''),
}).default({
  targetBehaviors: [],
  abcEvents: [],
  hypotheses: [],
  riskLevel: 'low',
  healthFactors: [],
  teamConsensusNote: '',
});

export type PlanningAssessment = z.infer<typeof planningAssessmentSchema>;

// ── 実務モデル: プランニング ──

/** 手順ステップ */
export const procedureStepSchema = z.object({
  order: z.number().int().min(1),
  instruction: z.string().min(1),
  staff: z.string().default(''),
  timing: z.string().default(''),
});

export type ProcedureStep = z.infer<typeof procedureStepSchema>;

/** 危機対応閾値 */
export const crisisThresholdsSchema = z.object({
  escalationLevel: z.string().default(''),
  deescalationSteps: z.array(z.string()).default([]),
  emergencyContacts: z.array(z.string()).default([]),
}).nullable().default(null);

export type CrisisThresholds = z.infer<typeof crisisThresholdsSchema>;

export const restraintPolicyValues = ['prohibited_except_emergency', 'not_applicable'] as const;
export const restraintPolicySchema = z.enum(restraintPolicyValues);

/** プランニング（支援設計）セクション */
export const planningDesignSchema = z.object({
  supportPriorities: z.array(z.string()).default([]),
  antecedentStrategies: z.array(z.string()).default([]),
  teachingStrategies: z.array(z.string()).default([]),
  consequenceStrategies: z.array(z.string()).default([]),
  procedureSteps: z.array(procedureStepSchema).default([]),
  crisisThresholds: crisisThresholdsSchema,
  restraintPolicy: restraintPolicySchema.default('prohibited_except_emergency'),
  reviewCycleDays: z.number().int().min(1).default(180),
}).default({
  supportPriorities: [],
  antecedentStrategies: [],
  teachingStrategies: [],
  consequenceStrategies: [],
  procedureSteps: [],
  crisisThresholds: null,
  restraintPolicy: 'prohibited_except_emergency',
  reviewCycleDays: 180,
});

export type PlanningDesign = z.infer<typeof planningDesignSchema>;

// ── ステータス ──

export const planningSheetStatusValues = [
  'draft',
  'review',
  'active',
  'revision_pending',
  'archived',
] as const;

export const planningSheetStatusSchema = z.enum(planningSheetStatusValues);
export type PlanningSheetStatus = z.infer<typeof planningSheetStatusSchema>;

/** 支援計画シートステータスの日本語ラベル */
export const PLANNING_SHEET_STATUS_DISPLAY: Record<PlanningSheetStatus, string> = {
  draft: '下書き',
  review: 'レビュー中',
  active: '運用中',
  revision_pending: '改訂待ち',
  archived: 'アーカイブ',
} as const;

/** 支援計画シートのフォーム入力バリデーション */
export const planningSheetFormSchema = z.object({
  userId: z.string().min(1, '利用者は必須です'),
  ispId: z.string().min(1, '紐づく ISP を選択してください'),
  title: z.string().min(1, 'タイトルは必須です').max(200),

  targetScene: z.string().max(200).default(''),
  targetDomain: z.string().max(200).default(''),

  observationFacts: z.string().min(1, '行動観察は必須です').max(3000),
  collectedInformation: z.string().max(3000).default(''),
  interpretationHypothesis: z.string().min(1, '分析・仮説は必須です').max(3000),
  supportIssues: z.string().min(1, '支援課題は必須です').max(3000),

  supportPolicy: z.string().min(1, '対応方針は必須です').max(3000),
  environmentalAdjustments: z.string().max(3000).default(''),
  concreteApproaches: z.string().min(1, '関わり方の具体策は必須です').max(3000),

  appliedFrom: isoDateString.optional(),
  nextReviewAt: isoDateString.optional(),

  // ── L2 モニタリング起点 ──
  /** 支援開始日（モニタリング起点） */
  supportStartDate: isoDateString.optional(),
  /** モニタリング周期（日数、デフォルト 90日 = 3ヶ月） */
  monitoringCycleDays: z.number().int().min(1).max(365).default(90),

  // ── 制度項目 ──
  authoredByStaffId: z.string().max(100).default(''),
  authoredByQualification: staffQualificationSchema.default('unknown'),
  authoredAt: isoDateString.optional(),
  applicableServiceType: applicableServiceTypeSchema.default('other'),
  applicableAddOnTypes: z.array(applicableAddOnTypeSchema).default(['none']),
  deliveredToUserAt: isoDateString.optional().nullable(),
  reviewedAt: isoDateString.optional().nullable(),
  hasMedicalCoordination: z.boolean().default(false),
  hasEducationCoordination: z.boolean().default(false),

  status: planningSheetStatusSchema.default('draft'),
});

export type PlanningSheetFormValues = z.infer<typeof planningSheetFormSchema>;

/** 支援計画シートのドメインモデル */
export const supportPlanningSheetSchema = baseAuditFieldsSchema.extend({
  userId: z.string(),
  ispId: z.string(),
  title: z.string(),

  targetScene: z.string().default(''),
  targetDomain: z.string().default(''),

  observationFacts: z.string(),
  collectedInformation: z.string().default(''),
  interpretationHypothesis: z.string(),
  supportIssues: z.string(),

  supportPolicy: z.string(),
  environmentalAdjustments: z.string().default(''),
  concreteApproaches: z.string(),

  appliedFrom: z.string().nullable().default(null),
  nextReviewAt: z.string().nullable().default(null),

  // ── L2 モニタリング起点 ──
  supportStartDate: z.string().nullable().default(null),
  monitoringCycleDays: z.number().int().default(90),

  // ── 制度項目 ──
  authoredByStaffId: z.string().default(''),
  authoredByQualification: staffQualificationSchema.default('unknown'),
  authoredAt: z.string().nullable().default(null),
  applicableServiceType: applicableServiceTypeSchema.default('other'),
  applicableAddOnTypes: z.array(applicableAddOnTypeSchema).default(['none']),
  deliveredToUserAt: z.string().nullable().default(null),
  reviewedAt: z.string().nullable().default(null),
  hasMedicalCoordination: z.boolean().default(false),
  hasEducationCoordination: z.boolean().default(false),
  regulatoryBasisSnapshot: regulatoryBasisSnapshotSchema,

  status: planningSheetStatusSchema,
  isCurrent: z.boolean().default(true),

  // ── 実務モデル（ネスト構造） ──
  intake: planningIntakeSchema,
  assessment: planningAssessmentSchema,
  planning: planningDesignSchema,
});

export type SupportPlanningSheet = z.infer<typeof supportPlanningSheetSchema>;

/** 支援計画シートの SharePoint 行パーススキーマ */
export const planningSheetSpRowSchema = z.object({
  Id: z.number(),
  Title: z.string().default(''),
  UserLookupId: z.number().nullable().default(null),
  UserCode: z.string().nullable().default(null),
  ISPLookupId: z.number().nullable().default(null),
  ISPId: z.string().nullable().default(null),
  TargetScene: z.string().nullable().default(null),
  TargetDomain: z.string().nullable().default(null),
  FormDataJson: z.string().default('{}'),
  Status: planningSheetStatusSchema.default('draft'),
  VersionNo: z.number().default(1),
  IsCurrent: z.boolean().default(true),
  AppliedFrom: z.string().nullable().default(null),
  NextReviewAt: z.string().nullable().default(null),
  // ── 制度項目 ──
  AuthoredByStaffId: z.string().nullable().default(null),
  AuthoredByQualification: z.string().nullable().default(null),
  AuthoredAt: z.string().nullable().default(null),
  ApplicableServiceType: z.string().nullable().default(null),
  ApplicableAddOnTypesJson: z.string().nullable().default(null),
  DeliveredToUserAt: z.string().nullable().default(null),
  ReviewedAt: z.string().nullable().default(null),
  HasMedicalCoordination: z.boolean().nullable().default(null),
  HasEducationCoordination: z.boolean().nullable().default(null),
  RegulatoryBasisSnapshotJson: z.string().nullable().default(null),
  // ── 実務モデル JSON 列 ──
  IntakeJson: z.string().nullable().default(null),
  AssessmentJson: z.string().nullable().default(null),
  PlanningJson: z.string().nullable().default(null),
  Created: z.string().nullable().optional(),
  Modified: z.string().nullable().optional(),
});

export type PlanningSheetSpRow = z.infer<typeof planningSheetSpRowSchema>;

/** 支援計画シート一覧用の軽量型 */
export const planningSheetListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ispId: z.string(),
  title: z.string(),
  targetScene: z.string().nullable().default(null),
  status: planningSheetStatusSchema,
  nextReviewAt: z.string().nullable().default(null),
  isCurrent: z.boolean(),
  // ── 制度項目（一覧で監査リスク表示に必要） ──
  applicableServiceType: applicableServiceTypeSchema.default('other'),
  applicableAddOnTypes: z.array(applicableAddOnTypeSchema).default(['none']),
  authoredByQualification: staffQualificationSchema.default('unknown'),
  /** 最終レビュー日（再評価日として加算判定に使用） */
  reviewedAt: z.string().nullable().default(null),
});

export type PlanningSheetListItem = z.infer<typeof planningSheetListItemSchema>;
