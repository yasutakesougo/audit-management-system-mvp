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

/** Dynamic Schema Resolution 用候補定義: BehaviorMonitoringRecord_Master */
export const BEHAVIOR_MONITORING_CANDIDATES = {
  id: ['ID', 'Id'],
  userId: ['UserId', 'UserCode', 'User_x0020_ID', 'cr013_userId'],
  planningSheetId: ['PlanningSheetId', 'Planning_x0020_Sheet_x0020_ID', 'cr013_planningSheetId'],
  periodStart: ['PeriodStart', 'PeriodStart0', 'cr013_periodStart'],
  periodEnd: ['PeriodEnd', 'Period_x0020_End', 'cr013_periodEnd'],
  supportEvaluationsJson: ['SupportEvaluationsJson', 'SupportEvaluationsJson0', 'cr013_supportEvaluationsJson'],
  environmentFindingsJson: ['EnvironmentFindingsJson', 'EnvironmentFindingsJson0', 'cr013_environmentFindingsJson'],
  effectiveSupports: ['EffectiveSupports', 'EffectiveSupports0', 'cr013_effectiveSupports'],
  difficultiesObserved: ['DifficultiesObserved', 'DifficultiesObserved0', 'cr013_difficultiesObserved'],
  newTriggersJson: ['NewTriggersJson', 'NewTriggersJson0', 'cr013_newTriggersJson'],
  medicalSafetyNotes: ['MedicalSafetyNotes', 'MedicalSafetyNotes0', 'cr013_medicalSafetyNotes'],
  userFeedback: ['UserFeedback', 'UserFeedback0', 'cr013_userFeedback'],
  familyFeedback: ['FamilyFeedback', 'FamilyFeedback0', 'cr013_familyFeedback'],
  recommendedChangesJson: ['RecommendedChangesJson', 'RecommendedChangesJson0', 'cr013_recommendedChangesJson'],
  summary: ['Summary', 'Summary0', 'cr013_summary'],
  recordedBy: ['RecordedBy', 'RecordedBy0', 'cr013_recordedBy'],
  recordedAt: ['RecordedAt', 'RecordedAt0', 'cr013_recordedAt'],
} as const;

export const BEHAVIOR_MONITORING_ESSENTIALS: (keyof typeof BEHAVIOR_MONITORING_CANDIDATES)[] = [
  'userId', 'planningSheetId', 'periodEnd'
];

/** Dynamic Schema Resolution 用候補定義: PlanningSheetReassessment_Master */
export const REASSESSMENT_CANDIDATES = {
  id: ['ID', 'Id'],
  planningSheetId: ['PlanningSheetId', 'Planning_x0020_Sheet_x0020_ID', 'cr013_planningSheetId'],
  userId: ['UserId', 'UserCode', 'cr013_userId'],
  reassessmentTrigger: ['ReassessmentTrigger', 'ReassessmentTrigger0', 'cr013_reassessmentTrigger'],
  reassessmentDate: ['ReassessmentDate', 'Reassessment_x0020_Date', 'cr013_reassessmentDate'],
  summary: ['Summary', 'Summary0', 'cr013_summary'],
  planChangeDecision: ['PlanChangeDecision', 'PlanChangeDecision0', 'cr013_planChangeDecision'],
  abcSummary: ['AbcSummary', 'AbcSummary0', 'cr013_abcSummary'],
  hypothesisReview: ['HypothesisReview', 'HypothesisReview0', 'cr013_hypothesisReview'],
  procedureEffectiveness: ['ProcedureEffectiveness', 'ProcedureEffectiveness0', 'cr013_procedureEffectiveness'],
  environmentChange: ['EnvironmentChange', 'EnvironmentChange0', 'cr013_environmentChange'],
  nextReassessmentAt: ['NextReassessmentAt', 'NextReassessmentAt0', 'cr013_nextReassessmentAt'],
  notes: ['Notes', 'Notes0', 'cr013_notes'],
  reassessedBy: ['ReassessedBy', 'ReassessedBy0', 'cr013_reassessedBy'],
} as const;

export const REASSESSMENT_ESSENTIALS: (keyof typeof REASSESSMENT_CANDIDATES)[] = [
  'planningSheetId', 'reassessmentDate'
];

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
