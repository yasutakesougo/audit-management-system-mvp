/**
 * ISP 三層モデル — SharePoint ↔ Domain マッパー
 *
 * 2方向のみ:
 *   - SP row → domain model (読み取り)
 *   - create/update input → SP payload (書き込み)
 *
 * null / '' / undefined の正規化、JSON 列のパース、LookupId 変換は
 * すべてこのファイルに閉じ込める。
 *
 * @see src/sharepoint/fields/ispThreeLayerFields.ts
 * @see src/domain/isp/schema.ts
 */

import {
  individualSupportPlanSchema,
  supportPlanningSheetSchema,
  supportProcedureRecordSchema,
  ispListItemSchema,
  planningSheetListItemSchema,
  procedureRecordListItemSchema,
  type IndividualSupportPlan,
  type SupportPlanningSheet,
  type SupportProcedureRecord,
  type IspListItem,
  type PlanningSheetListItem,
  type ProcedureRecordListItem,
} from '@/domain/isp/schema';

import type { IspCreateInput, IspUpdateInput } from '@/domain/isp/port';
import type { PlanningSheetCreateInput, PlanningSheetUpdateInput } from '@/domain/isp/port';
import type { ProcedureRecordCreateInput, ProcedureRecordUpdateInput } from '@/domain/isp/port';

import type { SpIspMasterRow, SpIspMasterPayload } from '@/sharepoint/fields/ispThreeLayerFields';
import type { SpPlanningSheetRow, SpPlanningSheetPayload } from '@/sharepoint/fields/ispThreeLayerFields';
import type { SpProcedureRecordRow, SpProcedureRecordPayload } from '@/sharepoint/fields/ispThreeLayerFields';

import { userSnapshotSchema, type UserSnapshot } from '@/domain/user/userRelation';

// ─────────────────────────────────────────────
// 共通ヘルパー
// ─────────────────────────────────────────────

/** null / undefined / 空文字 → デフォルトに正規化 */
const str = (v: string | null | undefined, fallback = ''): string => v ?? fallback;

/** JSON 文字列を安全にパースして string[] を返す */
function parseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** string[] を JSON 文字列にシリアライズ */
const toJsonArray = (arr: string[]): string => JSON.stringify(arr);

/** JSON 文字列を安全にパースしてオブジェクトを返す（スナップショット用） */
function parseJsonObject<T extends Record<string, unknown>>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const parsed: unknown = JSON.parse(json);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_SNAPSHOT = { supportLevel: null, behaviorScore: null, serviceType: null, eligibilityCheckedAt: null };

/** JSON 文字列を安全にパースして UserSnapshot を返す（失敗時は undefined） */
function parseUserSnapshot(json: string | null | undefined): UserSnapshot | undefined {
  if (!json) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    const result = userSnapshotSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

const EMPTY_INTAKE = {
  presentingProblem: '', targetBehaviorsDraft: [], behaviorItemsTotal: null,
  incidentSummaryLast30d: '', communicationModes: [], sensoryTriggers: [],
  medicalFlags: [], consentScope: [], consentDate: null,
};

const EMPTY_ASSESSMENT = {
  targetBehaviors: [], abcEvents: [], hypotheses: [],
  riskLevel: 'low' as const, healthFactors: [], teamConsensusNote: '',
};

const EMPTY_PLANNING = {
  supportPriorities: [], antecedentStrategies: [], teachingStrategies: [],
  consequenceStrategies: [], procedureSteps: [], crisisThresholds: null,
  restraintPolicy: 'prohibited_except_emergency' as const, reviewCycleDays: 180,
};

// ═════════════════════════════════════════════
// 第1層: ISP
// ═════════════════════════════════════════════

/** SP row → IndividualSupportPlan (full) */
export function mapIspRowToDomain(row: SpIspMasterRow): IndividualSupportPlan {
  return individualSupportPlanSchema.parse({
    id: `sp-${row.Id}`,
    createdAt: str(row.Created, new Date().toISOString()),
    createdBy: str(row.UserCode, 'system'),
    updatedAt: str(row.Modified, new Date().toISOString()),
    updatedBy: str(row.UserCode, 'system'),
    version: row.VersionNo ?? 1,

    userId: str(row.UserCode),
    title: str(row.Title),
    planStartDate: str(row.PlanStartDate, '1970-01-01'),
    planEndDate: str(row.PlanEndDate, '1970-01-01'),

    userIntent: str(row.UserIntent),
    familyIntent: str(row.FamilyIntent),
    overallSupportPolicy: str(row.OverallSupportPolicy),
    qolIssues: str(row.QolIssues),

    longTermGoals: parseJsonArray(row.LongTermGoalsJson),
    shortTermGoals: parseJsonArray(row.ShortTermGoalsJson),

    supportSummary: str(row.SupportSummary),
    precautions: str(row.Precautions),

    consentAt: row.ConsentAt ?? null,
    deliveredAt: row.DeliveredAt ?? null,
    monitoringSummary: str(row.MonitoringSummary),
    lastMonitoringAt: row.LastMonitoringAt ?? null,
    nextReviewAt: row.NextReviewAt ?? null,

    status: row.Status ?? 'assessment',
    isCurrent: row.IsCurrent ?? true,

    // 利用者スナップショット（作成時点の利用者マスタ属性を凍結保存）
    userSnapshot: parseUserSnapshot(row.UserSnapshotJson),
  });
}

/** SP row → IspListItem (lightweight) */
export function mapIspRowToListItem(row: SpIspMasterRow): IspListItem {
  return ispListItemSchema.parse({
    id: `sp-${row.Id}`,
    userId: str(row.UserCode),
    title: str(row.Title),
    planStartDate: str(row.PlanStartDate, '1970-01-01'),
    planEndDate: str(row.PlanEndDate, '1970-01-01'),
    status: row.Status ?? 'assessment',
    nextReviewAt: row.NextReviewAt ?? null,
    isCurrent: row.IsCurrent ?? true,
  });
}

/** ISP create input → SP payload */
export function mapIspCreateInputToPayload(input: IspCreateInput): SpIspMasterPayload {
  return {
    Title: `${input.userId}_${input.planStartDate}`,
    UserCode: input.userId,
    PlanStartDate: input.planStartDate,
    PlanEndDate: input.planEndDate,
    UserIntent: input.userIntent,
    FamilyIntent: input.familyIntent ?? '',
    OverallSupportPolicy: input.overallSupportPolicy,
    QolIssues: input.qolIssues ?? '',
    LongTermGoalsJson: toJsonArray(input.longTermGoals),
    ShortTermGoalsJson: toJsonArray(input.shortTermGoals),
    SupportSummary: input.supportSummary ?? '',
    Precautions: input.precautions ?? '',
    Status: input.status ?? 'assessment',
    VersionNo: 1,
    IsCurrent: true,

    // 利用者スナップショット（JSONシリアライズ）
    UserSnapshotJson: input.userSnapshot
      ? JSON.stringify(input.userSnapshot)
      : undefined,
  };
}

/** ISP update input → SP payload (部分更新) */
export function mapIspUpdateInputToPayload(input: IspUpdateInput): SpIspMasterPayload {
  const payload: SpIspMasterPayload = {};

  if (input.title !== undefined) payload.Title = input.title;
  if (input.planStartDate !== undefined) payload.PlanStartDate = input.planStartDate;
  if (input.planEndDate !== undefined) payload.PlanEndDate = input.planEndDate;
  if (input.userIntent !== undefined) payload.UserIntent = input.userIntent;
  if (input.familyIntent !== undefined) payload.FamilyIntent = input.familyIntent;
  if (input.overallSupportPolicy !== undefined) payload.OverallSupportPolicy = input.overallSupportPolicy;
  if (input.qolIssues !== undefined) payload.QolIssues = input.qolIssues;
  if (input.longTermGoals !== undefined) payload.LongTermGoalsJson = toJsonArray(input.longTermGoals);
  if (input.shortTermGoals !== undefined) payload.ShortTermGoalsJson = toJsonArray(input.shortTermGoals);
  if (input.supportSummary !== undefined) payload.SupportSummary = input.supportSummary;
  if (input.precautions !== undefined) payload.Precautions = input.precautions;
  if (input.status !== undefined) payload.Status = input.status;

  // 利用者スナップショット（更新時にも再スナップショット可能）
  if (input.userSnapshot !== undefined) payload.UserSnapshotJson = JSON.stringify(input.userSnapshot);

  return payload;
}

// ═════════════════════════════════════════════
// 第2層: 支援計画シート
// ═════════════════════════════════════════════

/** SP row → SupportPlanningSheet (full) */
export function mapPlanningSheetRowToDomain(row: SpPlanningSheetRow): SupportPlanningSheet {
  return supportPlanningSheetSchema.parse({
    id: `sp-${row.Id}`,
    createdAt: str(row.Created, new Date().toISOString()),
    createdBy: str(row.UserCode, 'system'),
    updatedAt: str(row.Modified, new Date().toISOString()),
    updatedBy: str(row.UserCode, 'system'),
    version: row.VersionNo ?? 1,

    userId: str(row.UserCode),
    ispId: row.ISPId ?? `sp-${row.ISPLookupId ?? 0}`,
    title: str(row.Title),

    targetScene: str(row.TargetScene),
    targetDomain: str(row.TargetDomain),

    observationFacts: str(row.ObservationFacts),
    collectedInformation: str(row.CollectedInformation),
    interpretationHypothesis: str(row.InterpretationHypothesis),
    supportIssues: str(row.SupportIssues),
    supportPolicy: str(row.SupportPolicy),
    environmentalAdjustments: str(row.EnvironmentalAdjustments),
    concreteApproaches: str(row.ConcreteApproaches),

    appliedFrom: row.AppliedFrom ?? null,
    nextReviewAt: row.NextReviewAt ?? null,

    // 制度項目
    authoredByStaffId: str(row.AuthoredByStaffId),
    authoredByQualification: row.AuthoredByQualification ?? 'unknown',
    authoredAt: row.AuthoredAt ?? null,
    applicableServiceType: row.ApplicableServiceType ?? 'other',
    applicableAddOnTypes: parseJsonArray(row.ApplicableAddOnTypesJson).length > 0
      ? parseJsonArray(row.ApplicableAddOnTypesJson) as string[]
      : ['none'],
    deliveredToUserAt: row.DeliveredToUserAt ?? null,
    reviewedAt: row.ReviewedAt ?? null,
    hasMedicalCoordination: row.HasMedicalCoordination ?? false,
    hasEducationCoordination: row.HasEducationCoordination ?? false,
    regulatoryBasisSnapshot: parseJsonObject(row.RegulatoryBasisSnapshotJson, EMPTY_SNAPSHOT),

    status: row.Status ?? 'draft',
    isCurrent: row.IsCurrent ?? true,

    // 実務モデル
    intake: parseJsonObject(row.IntakeJson, EMPTY_INTAKE),
    assessment: parseJsonObject(row.AssessmentJson, EMPTY_ASSESSMENT),
    planning: parseJsonObject(row.PlanningJson, EMPTY_PLANNING),
  });
}

/** SP row → PlanningSheetListItem (lightweight) */
export function mapPlanningSheetRowToListItem(row: SpPlanningSheetRow): PlanningSheetListItem {
  return planningSheetListItemSchema.parse({
    id: `sp-${row.Id}`,
    userId: str(row.UserCode),
    ispId: row.ISPId ?? `sp-${row.ISPLookupId ?? 0}`,
    title: str(row.Title),
    targetScene: row.TargetScene ?? null,
    status: row.Status ?? 'draft',
    nextReviewAt: row.NextReviewAt ?? null,
    isCurrent: row.IsCurrent ?? true,
    // 制度項目
    applicableServiceType: row.ApplicableServiceType ?? 'other',
    applicableAddOnTypes: parseJsonArray(row.ApplicableAddOnTypesJson).length > 0
      ? parseJsonArray(row.ApplicableAddOnTypesJson) as string[]
      : ['none'],
    authoredByQualification: row.AuthoredByQualification ?? 'unknown',
    reviewedAt: row.ReviewedAt ?? null,
  });
}

/** PlanningSheet create input → SP payload */
export function mapPlanningSheetCreateInputToPayload(input: PlanningSheetCreateInput): SpPlanningSheetPayload {
  return {
    Title: input.title,
    UserCode: input.userId,
    ISPId: input.ispId,
    TargetScene: input.targetScene ?? '',
    TargetDomain: input.targetDomain ?? '',
    ObservationFacts: input.observationFacts,
    CollectedInformation: input.collectedInformation ?? '',
    InterpretationHypothesis: input.interpretationHypothesis,
    SupportIssues: input.supportIssues,
    SupportPolicy: input.supportPolicy,
    EnvironmentalAdjustments: input.environmentalAdjustments ?? '',
    ConcreteApproaches: input.concreteApproaches,
    AppliedFrom: input.appliedFrom ?? null,
    NextReviewAt: input.nextReviewAt ?? null,
    Status: input.status ?? 'draft',
    VersionNo: input.version ?? 1,
    IsCurrent: input.isCurrent ?? true,
    // 制度項目
    AuthoredByStaffId: input.authoredByStaffId ?? '',
    AuthoredByQualification: input.authoredByQualification ?? 'unknown',
    AuthoredAt: input.authoredAt ?? null,
    ApplicableServiceType: input.applicableServiceType ?? 'other',
    ApplicableAddOnTypesJson: toJsonArray(input.applicableAddOnTypes ?? ['none']),
    DeliveredToUserAt: input.deliveredToUserAt ?? null,
    ReviewedAt: input.reviewedAt ?? null,
    HasMedicalCoordination: input.hasMedicalCoordination ?? false,
    HasEducationCoordination: input.hasEducationCoordination ?? false,
    RegulatoryBasisSnapshotJson: input.regulatoryBasisSnapshot
      ? JSON.stringify(input.regulatoryBasisSnapshot)
      : JSON.stringify(EMPTY_SNAPSHOT),
    // 実務モデル
    IntakeJson: input.intake ? JSON.stringify(input.intake) : JSON.stringify(EMPTY_INTAKE),
    AssessmentJson: input.assessment ? JSON.stringify(input.assessment) : JSON.stringify(EMPTY_ASSESSMENT),
    PlanningJson: input.planning ? JSON.stringify(input.planning) : JSON.stringify(EMPTY_PLANNING),
  };
}

/** PlanningSheet update input → SP payload (部分更新) */
export function mapPlanningSheetUpdateInputToPayload(input: PlanningSheetUpdateInput): SpPlanningSheetPayload {
  const payload: SpPlanningSheetPayload = {};

  if (input.title !== undefined) payload.Title = input.title;
  if (input.targetScene !== undefined) payload.TargetScene = input.targetScene;
  if (input.targetDomain !== undefined) payload.TargetDomain = input.targetDomain;
  if (input.observationFacts !== undefined) payload.ObservationFacts = input.observationFacts;
  if (input.collectedInformation !== undefined) payload.CollectedInformation = input.collectedInformation;
  if (input.interpretationHypothesis !== undefined) payload.InterpretationHypothesis = input.interpretationHypothesis;
  if (input.supportIssues !== undefined) payload.SupportIssues = input.supportIssues;
  if (input.supportPolicy !== undefined) payload.SupportPolicy = input.supportPolicy;
  if (input.environmentalAdjustments !== undefined) payload.EnvironmentalAdjustments = input.environmentalAdjustments;
  if (input.concreteApproaches !== undefined) payload.ConcreteApproaches = input.concreteApproaches;
  if (input.appliedFrom !== undefined) payload.AppliedFrom = input.appliedFrom ?? null;
  if (input.nextReviewAt !== undefined) payload.NextReviewAt = input.nextReviewAt ?? null;
  if (input.status !== undefined) payload.Status = input.status;
  if (input.version !== undefined) payload.VersionNo = input.version;
  if (input.isCurrent !== undefined) payload.IsCurrent = input.isCurrent;
  // 制度項目
  if (input.authoredByStaffId !== undefined) payload.AuthoredByStaffId = input.authoredByStaffId;
  if (input.authoredByQualification !== undefined) payload.AuthoredByQualification = input.authoredByQualification;
  if (input.authoredAt !== undefined) payload.AuthoredAt = input.authoredAt ?? null;
  if (input.applicableServiceType !== undefined) payload.ApplicableServiceType = input.applicableServiceType;
  if (input.applicableAddOnTypes !== undefined) payload.ApplicableAddOnTypesJson = toJsonArray(input.applicableAddOnTypes);
  if (input.deliveredToUserAt !== undefined) payload.DeliveredToUserAt = input.deliveredToUserAt ?? null;
  if (input.reviewedAt !== undefined) payload.ReviewedAt = input.reviewedAt ?? null;
  if (input.hasMedicalCoordination !== undefined) payload.HasMedicalCoordination = input.hasMedicalCoordination;
  if (input.hasEducationCoordination !== undefined) payload.HasEducationCoordination = input.hasEducationCoordination;
  if (input.regulatoryBasisSnapshot !== undefined) payload.RegulatoryBasisSnapshotJson = JSON.stringify(input.regulatoryBasisSnapshot);
  // 実務モデル
  if (input.intake !== undefined) payload.IntakeJson = JSON.stringify(input.intake);
  if (input.assessment !== undefined) payload.AssessmentJson = JSON.stringify(input.assessment);
  if (input.planning !== undefined) payload.PlanningJson = JSON.stringify(input.planning);

  return payload;
}

// ═════════════════════════════════════════════
// 第3層: 支援手順書兼記録
// ═════════════════════════════════════════════

/** SP row → SupportProcedureRecord (full) */
export function mapProcedureRecordRowToDomain(row: SpProcedureRecordRow): SupportProcedureRecord {
  return supportProcedureRecordSchema.parse({
    id: `sp-${row.Id}`,
    createdAt: str(row.Created, new Date().toISOString()),
    createdBy: str(row.PerformedBy, 'system'),
    updatedAt: str(row.Modified, new Date().toISOString()),
    updatedBy: str(row.PerformedBy, 'system'),
    version: 1,

    userId: str(row.UserCode),
    ispId: row.ISPId ?? null,
    planningSheetId: row.PlanningSheetId ?? `sp-${row.PlanningSheetLookupId ?? 0}`,

    recordDate: str(row.RecordDate, '1970-01-01'),
    timeSlot: str(row.TimeSlot),
    activity: str(row.Activity),

    procedureText: str(row.ProcedureText),
    executionStatus: row.ExecutionStatus ?? 'planned',

    userResponse: str(row.UserResponse),
    specialNotes: str(row.SpecialNotes),
    handoffNotes: str(row.HandoffNotes),

    performedBy: str(row.PerformedBy),
    performedAt: str(row.PerformedAt, new Date().toISOString()),
  });
}

/** SP row → ProcedureRecordListItem (lightweight) */
export function mapProcedureRecordRowToListItem(row: SpProcedureRecordRow): ProcedureRecordListItem {
  return procedureRecordListItemSchema.parse({
    id: `sp-${row.Id}`,
    userId: str(row.UserCode),
    planningSheetId: row.PlanningSheetId ?? `sp-${row.PlanningSheetLookupId ?? 0}`,
    recordDate: str(row.RecordDate, '1970-01-01'),
    timeSlot: row.TimeSlot ?? null,
    activity: row.Activity ?? null,
    executionStatus: row.ExecutionStatus ?? 'planned',
    performedBy: str(row.PerformedBy),
  });
}

/** ProcedureRecord create input → SP payload */
export function mapProcedureRecordCreateInputToPayload(input: ProcedureRecordCreateInput): SpProcedureRecordPayload {
  return {
    Title: `${input.userId}_${input.recordDate}_${input.timeSlot ?? ''}`.trim(),
    UserCode: input.userId,
    ISPId: input.ispId ?? undefined,
    PlanningSheetId: input.planningSheetId,
    RecordDate: input.recordDate,
    TimeSlot: input.timeSlot ?? '',
    Activity: input.activity ?? '',
    ProcedureText: input.procedureText,
    ExecutionStatus: input.executionStatus ?? 'planned',
    UserResponse: input.userResponse ?? '',
    SpecialNotes: input.specialNotes ?? '',
    HandoffNotes: input.handoffNotes ?? '',
    PerformedBy: input.performedBy,
    PerformedAt: input.performedAt,
  };
}

/** ProcedureRecord update input → SP payload (部分更新) */
export function mapProcedureRecordUpdateInputToPayload(input: ProcedureRecordUpdateInput): SpProcedureRecordPayload {
  const payload: SpProcedureRecordPayload = {};

  if (input.recordDate !== undefined) payload.RecordDate = input.recordDate;
  if (input.timeSlot !== undefined) payload.TimeSlot = input.timeSlot;
  if (input.activity !== undefined) payload.Activity = input.activity;
  if (input.procedureText !== undefined) payload.ProcedureText = input.procedureText;
  if (input.executionStatus !== undefined) payload.ExecutionStatus = input.executionStatus;
  if (input.userResponse !== undefined) payload.UserResponse = input.userResponse;
  if (input.specialNotes !== undefined) payload.SpecialNotes = input.specialNotes;
  if (input.handoffNotes !== undefined) payload.HandoffNotes = input.handoffNotes;
  if (input.performedBy !== undefined) payload.PerformedBy = input.performedBy;
  if (input.performedAt !== undefined) payload.PerformedAt = input.performedAt;

  return payload;
}
// ────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────

/**
 * ドメイン ID ("sp-42") から SP 用 数値 ID を抽出。
 * 数値だけの場合もサポート。
 */
export function extractSpId(id: string): number | null {
  const num = id.startsWith('sp-') ? Number(id.slice(3)) : Number(id);
  return Number.isFinite(num) && num > 0 ? num : null;
}
