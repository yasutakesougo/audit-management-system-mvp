/**
 * ISP 三層モデル — Zod バリデーションスキーマ
 *
 * ADR-005 準拠。SharePoint 行のパースおよびフォーム入力のバリデーションに使用する。
 *
 * 設計方針:
 *   - SP REST API レスポンスを安全にパースする `*SpRowSchema` 系
 *   - フォーム入力を検証する `*FormSchema` 系
 *   - 一覧表示用の軽量型 `*ListItemSchema` 系
 *
 * 既存との関係:
 *   - support-plan-guide/schema.ts の `supportPlanSpRowSchema` を補完
 *   - ibdTypes.ts の SPSStatus ('draft' | 'confirmed' | 'expired') と対応
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 * @see src/domain/isp/types.ts
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// 共通
// ─────────────────────────────────────────────

/** ISO 8601 日付文字列（簡易バリデーション） */
const isoDateString = z.string().regex(
  /^\d{4}-\d{2}-\d{2}/,
  'ISO 8601 日付形式（YYYY-MM-DD...）が必要です',
);

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
// 第1層: ISP（個別支援計画）
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
// ISP コンプライアンスメタデータ（生活介護対応）
// ─────────────────────────────────────────────

/** 同意記録の詳細（生活介護制度要件） */
export const ispConsentDetailSchema = z.object({
  /** 説明実施日（ISO 8601） */
  explainedAt: z.string().nullable().default(null),
  /** 説明実施者名 */
  explainedBy: z.string().default(''),
  /** 同意取得日（ISO 8601） */
  consentedAt: z.string().nullable().default(null),
  /** 同意者名 */
  consentedBy: z.string().default(''),
  /** 代理人名（家族等が同意した場合） */
  proxyName: z.string().default(''),
  /** 代理人続柄 */
  proxyRelation: z.string().default(''),
  /** 備考 */
  notes: z.string().default(''),
}).default({
  explainedAt: null,
  explainedBy: '',
  consentedAt: null,
  consentedBy: '',
  proxyName: '',
  proxyRelation: '',
  notes: '',
});

export type IspConsentDetail = z.infer<typeof ispConsentDetailSchema>;

/** 交付記録の詳細（生活介護制度要件） */
export const ispDeliveryDetailSchema = z.object({
  /** 交付日（ISO 8601） */
  deliveredAt: z.string().nullable().default(null),
  /** 本人へ交付済み */
  deliveredToUser: z.boolean().default(false),
  /** 相談支援専門員へ交付済み */
  deliveredToConsultationSupport: z.boolean().default(false),
  /** 交付方法 */
  deliveryMethod: z.string().default(''),
  /** 備考 */
  notes: z.string().default(''),
}).default({
  deliveredAt: null,
  deliveredToUser: false,
  deliveredToConsultationSupport: false,
  deliveryMethod: '',
  notes: '',
});

export type IspDeliveryDetail = z.infer<typeof ispDeliveryDetailSchema>;

/** 見直し制御（6か月ルール） */
export const ispReviewControlSchema = z.object({
  /** 見直し周期（日） — 生活介護は原則 180日（6か月） */
  reviewCycleDays: z.number().int().min(1).default(180),
  /** 前回見直し実施日（ISO 8601） */
  lastReviewedAt: z.string().nullable().default(null),
  /** 次回見直し期限（ISO 8601） */
  nextReviewDueAt: z.string().nullable().default(null),
  /** 見直し理由 */
  reviewReason: z.string().default(''),
}).default({
  reviewCycleDays: 180,
  lastReviewedAt: null,
  nextReviewDueAt: null,
  reviewReason: '',
});

export type IspReviewControl = z.infer<typeof ispReviewControlSchema>;

/** ISP コンプライアンスメタデータ（生活介護 ISP の監査対応項目を集約） */
export const ispComplianceMetadataSchema = z.object({
  /** サービス種別 */
  serviceType: applicableServiceTypeSchema.default('other'),
  /** 標準的な支援提供時間（時間単位、例: 6.5） */
  standardServiceHours: z.number().min(0).nullable().default(null),
  /** 同意記録詳細 */
  consent: ispConsentDetailSchema,
  /** 交付記録詳細 */
  delivery: ispDeliveryDetailSchema,
  /** 見直し制御 */
  reviewControl: ispReviewControlSchema,
}).default({
  serviceType: 'other',
  standardServiceHours: null,
  consent: {
    explainedAt: null,
    explainedBy: '',
    consentedAt: null,
    consentedBy: '',
    proxyName: '',
    proxyRelation: '',
    notes: '',
  },
  delivery: {
    deliveredAt: null,
    deliveredToUser: false,
    deliveredToConsultationSupport: false,
    deliveryMethod: '',
    notes: '',
  },
  reviewControl: {
    reviewCycleDays: 180,
    lastReviewedAt: null,
    nextReviewDueAt: null,
    reviewReason: '',
  },
});

export type IspComplianceMetadata = z.infer<typeof ispComplianceMetadataSchema>;

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

  status: ispStatusSchema.default('assessment'),

  // ── 生活介護コンプライアンスメタデータ ──
  compliance: ispComplianceMetadataSchema.optional(),
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

  consentAt: z.string().nullable().default(null),
  deliveredAt: z.string().nullable().default(null),

  monitoringSummary: z.string().default(''),
  lastMonitoringAt: z.string().nullable().default(null),
  nextReviewAt: z.string().nullable().default(null),

  status: ispStatusSchema,
  isCurrent: z.boolean().default(true),

  // ── 生活介護コンプライアンスメタデータ（A-1 追加） ──
  compliance: ispComplianceMetadataSchema.optional(),
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
// 第2層: 支援計画シート
// ─────────────────────────────────────────────

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

// NOTE: applicableServiceType は ISP コンプライアンスメタデータのため上方で定義済み
// （applicableServiceTypeValues, applicableServiceTypeSchema, ApplicableServiceType, SERVICE_TYPE_DISPLAY）

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
});

export type PlanningSheetListItem = z.infer<typeof planningSheetListItemSchema>;

// ─────────────────────────────────────────────
// 第3層: 支援手順書兼記録
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// 合成ビュー型
// ─────────────────────────────────────────────

/** ISP → 支援計画シート → 実施記録を束ねた合成表示用型 */
export interface SupportPlanBundle {
  isp: IndividualSupportPlan;
  planningSheets: SupportPlanningSheet[];
  recentProcedureRecords: SupportProcedureRecord[];
  /** 支援計画シートごとの Iceberg 分析件数（planningSheetId → count） */
  icebergCountBySheet?: Record<string, number>;
  /** 直近のモニタリング結果 */
  latestMonitoring?: { date: string; planChangeRequired: boolean } | null;
  /** 支援計画シートごとの実施記録件数（planningSheetId → count） */
  procedureRecordCountBySheet?: Record<string, number>;
  /** 支援計画シート総数 */
  planningSheetCount?: number;
  /** 実施記録の直近日付 */
  lastProcedureRecordDate?: string | null;
  /** 支援計画シート一覧（軽量版、カード表示用） */
  planningSheetItems?: PlanningSheetListItem[];
}

// ─────────────────────────────────────────────
// 編集状態用型
// ─────────────────────────────────────────────

/** ISP 編集画面の状態型 */
export interface IspEditorState {
  draft: IspFormValues;
  isDirty: boolean;
  validationErrors: string[];
}

/** 支援計画シート編集画面の状態型 */
export interface PlanningSheetEditorState {
  draft: PlanningSheetFormValues;
  linkedIsp?: IndividualSupportPlan;
  isDirty: boolean;
  validationErrors: string[];
}

/** 支援手順記録入力画面の状態型 */
export interface ProcedureRecordEntryState {
  draft: ProcedureRecordFormValues;
  linkedPlanningSheet?: SupportPlanningSheet;
  linkedIsp?: IndividualSupportPlan;
  isDirty: boolean;
  validationErrors: string[];
}

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

// ─────────────────────────────────────────────
// コンプライアンスユーティリティ（A-1 追加）
// ─────────────────────────────────────────────

/**
 * ISP の見直し期限が超過しているかを判定する
 *
 * reviewControl.nextReviewDueAt を基準に判定。
 * 未設定の場合は超過とみなさない（null → false）。
 */
export function isIspReviewOverdue(
  compliance: IspComplianceMetadata | undefined,
  today?: string,
): boolean {
  const dueAt = compliance?.reviewControl?.nextReviewDueAt;
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = today ? new Date(today) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return nowUtc > dueUtc;
}

/**
 * ISP の見直し期限超過日数を算出する
 *
 * 超過していない場合は 0 を返す。未設定の場合は null。
 */
export function computeIspReviewOverdueDays(
  compliance: IspComplianceMetadata | undefined,
  today?: string,
): number | null {
  const dueAt = compliance?.reviewControl?.nextReviewDueAt;
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = today ? new Date(today) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((nowUtc - dueUtc) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/**
 * 標準的な支援提供時間（totalHours）の妥当性を検証する
 *
 * @returns エラーメッセージ（問題なし → null）
 */
export function validateStandardServiceHours(
  hours: number | null | undefined,
): string | null {
  if (hours == null) return null; // 未入力は許容
  if (hours < 0) return '支援提供時間は 0 以上で入力してください';
  if (hours > 24) return '支援提供時間は 24 時間以内で入力してください';
  return null;
}
