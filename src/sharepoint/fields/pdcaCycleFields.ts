/**
 * pdcaCycleFields.ts — PDCA Check/Act 用 SharePoint リストのフィールド定義
 *
 * BehaviorMonitoringRecord（Check）と
 * PlanningSheetReassessment（Act）の列 InternalName を集中管理する。
 */

// ---------------------------------------------------------------------------
// BehaviorMonitoringRecord_Master (Check)
// ---------------------------------------------------------------------------

export const BEHAVIOR_MONITORING_LIST_TITLE = 'BehaviorMonitoringRecord_Master' as const;

export const BEHAVIOR_MONITORING_FIELDS = {
  userId: 'UserId',
  planningSheetId: 'PlanningSheetId',
  periodStart: 'PeriodStart',
  periodEnd: 'PeriodEnd',
  supportEvaluationsJson: 'SupportEvaluationsJson',
  environmentFindingsJson: 'EnvironmentFindingsJson',
  effectiveSupports: 'EffectiveSupports',
  difficultiesObserved: 'DifficultiesObserved',
  newTriggersJson: 'NewTriggersJson',
  medicalSafetyNotes: 'MedicalSafetyNotes',
  userFeedback: 'UserFeedback',
  familyFeedback: 'FamilyFeedback',
  recommendedChangesJson: 'RecommendedChangesJson',
  summary: 'Summary',
  recordedBy: 'RecordedBy',
  recordedAt: 'RecordedAt',
} as const;

export const BEHAVIOR_MONITORING_SELECT_FIELDS = [
  'Id',
  'Title',
  ...Object.values(BEHAVIOR_MONITORING_FIELDS),
  'Created',
  'Modified',
] as const;

export type SpBehaviorMonitoringRow = {
  Id?: number;
  Title?: string;
  UserId?: string;
  PlanningSheetId?: string;
  PeriodStart?: string;
  PeriodEnd?: string;
  SupportEvaluationsJson?: string;
  EnvironmentFindingsJson?: string;
  EffectiveSupports?: string;
  DifficultiesObserved?: string;
  NewTriggersJson?: string;
  MedicalSafetyNotes?: string;
  UserFeedback?: string;
  FamilyFeedback?: string;
  RecommendedChangesJson?: string;
  Summary?: string;
  RecordedBy?: string;
  RecordedAt?: string;
  Created?: string;
  Modified?: string;
} & Record<string, unknown>;

// ---------------------------------------------------------------------------
// PlanningSheetReassessment_Master (Act)
// ---------------------------------------------------------------------------

export const PLANNING_SHEET_REASSESSMENT_LIST_TITLE =
  'PlanningSheetReassessment_Master' as const;

export const PLANNING_SHEET_REASSESSMENT_FIELDS = {
  planningSheetId: 'PlanningSheetId',
  userId: 'UserId',
  reassessmentTrigger: 'ReassessmentTrigger',
  reassessmentDate: 'ReassessmentDate',
  summary: 'Summary',
  createdByText: 'CreatedByText',
  createdAtText: 'CreatedAtText',
  versionNo: 'VersionNo',
  planChangeDecision: 'PlanChangeDecision',
  abcSummary: 'AbcSummary',
  hypothesisReview: 'HypothesisReview',
  procedureEffectiveness: 'ProcedureEffectiveness',
  environmentChange: 'EnvironmentChange',
  nextReassessmentAt: 'NextReassessmentAt',
  notes: 'Notes',
  reassessedBy: 'ReassessedBy',
} as const;

export const PLANNING_SHEET_REASSESSMENT_SELECT_FIELDS = [
  'Id',
  'Title',
  ...Object.values(PLANNING_SHEET_REASSESSMENT_FIELDS),
  'Created',
  'Modified',
] as const;

export type SpPlanningSheetReassessmentRow = {
  Id?: number;
  Title?: string;
  PlanningSheetId?: string;
  UserId?: string;
  ReassessmentTrigger?: string;
  ReassessmentDate?: string;
  Summary?: string;
  CreatedByText?: string;
  CreatedAtText?: string;
  VersionNo?: number;
  PlanChangeDecision?: string;
  AbcSummary?: string;
  HypothesisReview?: string;
  ProcedureEffectiveness?: string;
  EnvironmentChange?: string;
  NextReassessmentAt?: string;
  Notes?: string;
  ReassessedBy?: string;
  Created?: string;
  Modified?: string;
} & Record<string, unknown>;

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
