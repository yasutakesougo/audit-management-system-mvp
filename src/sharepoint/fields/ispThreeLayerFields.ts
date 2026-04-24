/**
 * SharePoint フィールド定義 — ISP 三層モデル
 *
 * 3リスト分の Internal Name を SSOT として定数化。
 * 既存の planGoalFields.ts / supportPlanFields.ts と同じパターン。
 *
 * @see docs/sharepoint/support-plan-three-layer-lists.md
 */

import { buildSelectFieldsFromMap } from './fieldUtils';

// ═════════════════════════════════════════════
// A. ISP_Master — 個別支援計画本体
// ═════════════════════════════════════════════

export const ISP_MASTER_LIST_TITLE = 'ISP_Master' as const;

export const ISP_MASTER_FIELDS = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode',
  planStartDate: 'PlanStartDate',
  planEndDate: 'PlanEndDate',
  userIntent: 'UserIntent',
  familyIntent: 'FamilyIntent',
  overallSupportPolicy: 'OverallSupportPolicy',
  qolIssues: 'QolIssues',
  longTermGoalsJson: 'LongTermGoalsJson',
  shortTermGoalsJson: 'ShortTermGoalsJson',
  supportSummary: 'SupportSummary',
  precautions: 'Precautions',
  consentAt: 'ConsentAt',
  deliveredAt: 'DeliveredAt',
  monitoringSummary: 'MonitoringSummary',
  lastMonitoringAt: 'LastMonitoringAt',
  nextReviewAt: 'NextReviewAt',
  status: 'Status',
  versionNo: 'VersionNo',
  isCurrent: 'IsCurrent',
  formDataJson: 'FormDataJson',
  userSnapshotJson: 'UserSnapshotJson',
  created: 'Created',
  modified: 'Modified',
} as const;

export const ISP_MASTER_SELECT_FIELDS = [
  ISP_MASTER_FIELDS.id,
  ISP_MASTER_FIELDS.title,
  ISP_MASTER_FIELDS.userCode,
  ISP_MASTER_FIELDS.planStartDate,
  ISP_MASTER_FIELDS.planEndDate,
  ISP_MASTER_FIELDS.status,
  ISP_MASTER_FIELDS.versionNo,
  ISP_MASTER_FIELDS.isCurrent,
  ISP_MASTER_FIELDS.consentAt,
  ISP_MASTER_FIELDS.deliveredAt,
  ISP_MASTER_FIELDS.lastMonitoringAt,
  ISP_MASTER_FIELDS.nextReviewAt,
  ISP_MASTER_FIELDS.formDataJson,
  ISP_MASTER_FIELDS.userSnapshotJson,
  ISP_MASTER_FIELDS.created,
  ISP_MASTER_FIELDS.modified,
] as const;

/** ISP_Master 行の読み取り型 */
export interface SpIspMasterRow {
  Id: number;
  Title: string;
  UserCode: string | null;
  PlanStartDate: string | null;
  PlanEndDate: string | null;
  UserIntent?: string | null;
  FamilyIntent?: string | null;
  OverallSupportPolicy?: string | null;
  QolIssues?: string | null;
  LongTermGoalsJson?: string | null;
  ShortTermGoalsJson?: string | null;
  SupportSummary?: string | null;
  Precautions?: string | null;
  ConsentAt?: string | null;
  DeliveredAt?: string | null;
  MonitoringSummary?: string | null;
  LastMonitoringAt?: string | null;
  NextReviewAt?: string | null;
  Status: string;
  VersionNo: number;
  IsCurrent: boolean;
  FormDataJson?: string | null;
  UserSnapshotJson?: string | null;
  Created?: string | null;
  Modified?: string | null;
}

/** ISP_Master 作成/更新用ペイロード型 */
export interface SpIspMasterPayload {
  Title?: string;
  UserCode?: string;
  PlanStartDate?: string;
  PlanEndDate?: string;
  UserIntent?: string;
  FamilyIntent?: string;
  OverallSupportPolicy?: string;
  QolIssues?: string;
  LongTermGoalsJson?: string;
  ShortTermGoalsJson?: string;
  SupportSummary?: string;
  Precautions?: string;
  ConsentAt?: string | null;
  DeliveredAt?: string | null;
  MonitoringSummary?: string;
  LastMonitoringAt?: string | null;
  NextReviewAt?: string | null;
  Status?: string;
  VersionNo?: number;
  IsCurrent?: boolean;
  FormDataJson?: string;
  UserSnapshotJson?: string;
}

/** 動的 $select ビルダー */
export function buildIspMasterSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(ISP_MASTER_FIELDS, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [...ISP_MASTER_SELECT_FIELDS],
  });
}

/** Dynamic Schema Resolution 用候補定義: ISP_Master */
export const ISP_MASTER_CANDIDATES = {
  id: ['Id', 'ID'],
  title: ['Title'],
  userCode: ['UserCode', 'UserID', 'User_ID', 'cr013_userCode'],
  planStartDate: ['PlanStartDate', 'StartDate', 'cr013_planStartDate'],
  planEndDate: ['PlanEndDate', 'EndDate', 'cr013_planEndDate'],
  userIntent: ['UserIntent', 'Intent', 'cr013_userIntent'],
  status: ['Status', 'UsageStatus', 'cr013_status'],
  versionNo: ['VersionNo', 'Version', 'cr013_versionNo'],
  isCurrent: ['IsCurrent', 'Current', 'cr013_isCurrent'],
  formDataJson: ['FormDataJson', 'cr013_formDataJson'],
  userSnapshotJson: ['UserSnapshotJson', 'cr013_userSnapshotJson'],
} as const;

export const ISP_MASTER_ESSENTIALS: (keyof typeof ISP_MASTER_CANDIDATES)[] = [
  'userCode', 'planStartDate', 'status'
];

// ═════════════════════════════════════════════
// B. SupportPlanningSheet_Master — 支援計画シート
// ═════════════════════════════════════════════

export const PLANNING_SHEET_LIST_TITLE = 'SupportPlanningSheet_Master' as const;

export const PLANNING_SHEET_FIELDS = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode',
  ispLookupId: 'ISPLookupId',
  ispId: 'ISPId',
  targetScene: 'TargetScene',
  targetDomain: 'TargetDomain',
  observationFacts: 'ObservationFacts',
  collectedInformation: 'CollectedInformation',
  interpretationHypothesis: 'InterpretationHypothesis',
  supportIssues: 'SupportIssues',
  supportPolicy: 'SupportPolicy',
  environmentalAdjustments: 'EnvironmentalAdjustments',
  concreteApproaches: 'ConcreteApproaches',
  appliedFrom: 'AppliedFrom',
  nextReviewAt: 'NextReviewAt',
  status: 'Status',
  versionNo: 'VersionNo',
  isCurrent: 'IsCurrent',
  formDataJson: 'FormDataJson',
  // 制度項目
  authoredByStaffId: 'AuthoredByStaffId',
  authoredByQualification: 'AuthoredByQualification',
  authoredAt: 'AuthoredAt',
  applicableServiceType: 'ApplicableServiceType',
  applicableAddOnTypesJson: 'ApplicableAddOnTypesJson',
  deliveredToUserAt: 'DeliveredToUserAt',
  reviewedAt: 'ReviewedAt',
  hasMedicalCoordination: 'HasMedicalCoordination',
  hasEducationCoordination: 'HasEducationCoordination',
  regulatoryBasisSnapshotJson: 'RegulatoryBasisSnapshotJson',
  // 実務モデル JSON
  intakeJson: 'IntakeJson',
  assessmentJson: 'AssessmentJson',
  planningJson: 'PlanningJson',
  created: 'Created',
  modified: 'Modified',
} as const;

export const PLANNING_SHEET_SELECT_FIELDS = [
  PLANNING_SHEET_FIELDS.id,
  PLANNING_SHEET_FIELDS.title,
  PLANNING_SHEET_FIELDS.userCode,
  PLANNING_SHEET_FIELDS.ispLookupId,
  PLANNING_SHEET_FIELDS.ispId,
  PLANNING_SHEET_FIELDS.targetScene,
  PLANNING_SHEET_FIELDS.status,
  PLANNING_SHEET_FIELDS.versionNo,
  PLANNING_SHEET_FIELDS.isCurrent,
  PLANNING_SHEET_FIELDS.appliedFrom,
  PLANNING_SHEET_FIELDS.nextReviewAt,
  PLANNING_SHEET_FIELDS.formDataJson,
  // 制度項目
  PLANNING_SHEET_FIELDS.authoredByStaffId,
  PLANNING_SHEET_FIELDS.authoredByQualification,
  PLANNING_SHEET_FIELDS.authoredAt,
  PLANNING_SHEET_FIELDS.applicableServiceType,
  PLANNING_SHEET_FIELDS.applicableAddOnTypesJson,
  PLANNING_SHEET_FIELDS.deliveredToUserAt,
  PLANNING_SHEET_FIELDS.reviewedAt,
  PLANNING_SHEET_FIELDS.hasMedicalCoordination,
  PLANNING_SHEET_FIELDS.hasEducationCoordination,
  PLANNING_SHEET_FIELDS.regulatoryBasisSnapshotJson,
  // 実務モデル JSON
  PLANNING_SHEET_FIELDS.intakeJson,
  PLANNING_SHEET_FIELDS.assessmentJson,
  PLANNING_SHEET_FIELDS.planningJson,
  PLANNING_SHEET_FIELDS.created,
  PLANNING_SHEET_FIELDS.modified,
] as const;

/** SupportPlanningSheet_Master 行の読み取り型 */
export interface SpPlanningSheetRow {
  Id: number;
  Title: string;
  UserCode: string | null;
  ISPLookupId: number | null;
  ISPId: string | null;
  TargetScene?: string | null;
  TargetDomain?: string | null;
  ObservationFacts?: string | null;
  CollectedInformation?: string | null;
  InterpretationHypothesis?: string | null;
  SupportIssues?: string | null;
  SupportPolicy?: string | null;
  EnvironmentalAdjustments?: string | null;
  ConcreteApproaches?: string | null;
  AppliedFrom?: string | null;
  NextReviewAt?: string | null;
  Status: string;
  VersionNo: number;
  IsCurrent: boolean;
  FormDataJson?: string | null;
  // 制度項目
  AuthoredByStaffId?: string | null;
  AuthoredByQualification?: string | null;
  AuthoredAt?: string | null;
  ApplicableServiceType?: string | null;
  ApplicableAddOnTypesJson?: string | null;
  DeliveredToUserAt?: string | null;
  ReviewedAt?: string | null;
  HasMedicalCoordination?: boolean | null;
  HasEducationCoordination?: boolean | null;
  RegulatoryBasisSnapshotJson?: string | null;
  // 実務モデル JSON
  IntakeJson?: string | null;
  AssessmentJson?: string | null;
  PlanningJson?: string | null;
  Created?: string | null;
  Modified?: string | null;
}

/** SupportPlanningSheet_Master 作成/更新用ペイロード型 */
export interface SpPlanningSheetPayload {
  Title?: string;
  UserCode?: string;
  ISPLookupId?: number;
  ISPId?: string;
  TargetScene?: string;
  TargetDomain?: string;
  ObservationFacts?: string;
  CollectedInformation?: string;
  InterpretationHypothesis?: string;
  SupportIssues?: string;
  SupportPolicy?: string;
  EnvironmentalAdjustments?: string;
  ConcreteApproaches?: string;
  AppliedFrom?: string | null;
  NextReviewAt?: string | null;
  Status?: string;
  VersionNo?: number;
  IsCurrent?: boolean;
  FormDataJson?: string;
  // 制度項目
  AuthoredByStaffId?: string;
  AuthoredByQualification?: string;
  AuthoredAt?: string | null;
  ApplicableServiceType?: string;
  ApplicableAddOnTypesJson?: string;
  DeliveredToUserAt?: string | null;
  ReviewedAt?: string | null;
  HasMedicalCoordination?: boolean;
  HasEducationCoordination?: boolean;
  RegulatoryBasisSnapshotJson?: string;
  // 実務モデル JSON
  IntakeJson?: string;
  AssessmentJson?: string;
  PlanningJson?: string;
}

/** 動的 $select ビルダー */
export function buildPlanningSheetSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(PLANNING_SHEET_FIELDS, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [...PLANNING_SHEET_SELECT_FIELDS],
  });
}

/** Dynamic Schema Resolution 用候補定義: SupportPlanningSheet_Master */
export const PLANNING_SHEET_CANDIDATES = {
  id: ['Id', 'ID'],
  title: ['Title'],
  userCode: ['UserCode', 'UserID', 'User_ID', 'cr013_userCode'],
  ispId: ['ISPId', 'ISPLookupId', 'cr013_ispId'],
  targetScene: ['TargetScene', 'Scene', 'cr013_targetScene'],
  status: ['Status', 'UsageStatus', 'cr013_status'],
  versionNo: ['VersionNo', 'Version', 'cr013_versionNo'],
  isCurrent: ['IsCurrent', 'Current', 'cr013_isCurrent'],
  formDataJson: ['FormDataJson', 'cr013_formDataJson'],
  intakeJson: ['IntakeJson', 'cr013_intakeJson'],
  assessmentJson: ['AssessmentJson', 'cr013_assessmentJson'],
  planningJson: ['PlanningJson', 'cr013_planningJson'],
} as const;

export const PLANNING_SHEET_ESSENTIALS: (keyof typeof PLANNING_SHEET_CANDIDATES)[] = [
  'userCode', 'status'
];

// ═════════════════════════════════════════════
// C. SupportProcedureRecord_Daily — 支援手順書兼記録
// ═════════════════════════════════════════════

export const PROCEDURE_RECORD_LIST_TITLE = 'SupportProcedureRecord_Daily' as const;

export const PROCEDURE_RECORD_FIELDS = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode',
  ispLookupId: 'ISPLookupId',
  ispId: 'ISPId',
  planningSheetLookupId: 'PlanningSheetLookupId',
  planningSheetId: 'PlanningSheetId',
  recordDate: 'RecordDate',
  timeSlot: 'TimeSlot',
  activity: 'Activity',
  procedureText: 'ProcedureText',
  executionStatus: 'ExecutionStatus',
  userResponse: 'UserResponse',
  specialNotes: 'SpecialNotes',
  handoffNotes: 'HandoffNotes',
  performedBy: 'PerformedBy',
  performedAt: 'PerformedAt',
  created: 'Created',
  modified: 'Modified',
} as const;

export const PROCEDURE_RECORD_SELECT_FIELDS = [
  PROCEDURE_RECORD_FIELDS.id,
  PROCEDURE_RECORD_FIELDS.title,
  PROCEDURE_RECORD_FIELDS.userCode,
  PROCEDURE_RECORD_FIELDS.ispId,
  PROCEDURE_RECORD_FIELDS.planningSheetId,
  PROCEDURE_RECORD_FIELDS.recordDate,
  PROCEDURE_RECORD_FIELDS.timeSlot,
  PROCEDURE_RECORD_FIELDS.activity,
  PROCEDURE_RECORD_FIELDS.procedureText,
  PROCEDURE_RECORD_FIELDS.executionStatus,
  PROCEDURE_RECORD_FIELDS.userResponse,
  PROCEDURE_RECORD_FIELDS.specialNotes,
  PROCEDURE_RECORD_FIELDS.handoffNotes,
  PROCEDURE_RECORD_FIELDS.performedBy,
  PROCEDURE_RECORD_FIELDS.performedAt,
  PROCEDURE_RECORD_FIELDS.created,
  PROCEDURE_RECORD_FIELDS.modified,
] as const;

/** SupportProcedureRecord_Daily 行の読み取り型 */
export interface SpProcedureRecordRow {
  Id: number;
  Title: string;
  UserCode: string | null;
  ISPLookupId?: number | null;
  ISPId?: string | null;
  PlanningSheetLookupId: number | null;
  PlanningSheetId: string | null;
  RecordDate: string | null;
  TimeSlot?: string | null;
  Activity?: string | null;
  ProcedureText: string;
  ExecutionStatus: string;
  UserResponse?: string | null;
  SpecialNotes?: string | null;
  HandoffNotes?: string | null;
  PerformedBy: string;
  PerformedAt: string;
  Created?: string | null;
  Modified?: string | null;
}

/** SupportProcedureRecord_Daily 作成/更新用ペイロード型 */
export interface SpProcedureRecordPayload {
  Title?: string;
  UserCode?: string;
  ISPLookupId?: number | null;
  ISPId?: string | null;
  PlanningSheetLookupId?: number;
  PlanningSheetId?: string;
  RecordDate?: string;
  TimeSlot?: string;
  Activity?: string;
  ProcedureText?: string;
  ExecutionStatus?: string;
  UserResponse?: string;
  SpecialNotes?: string;
  HandoffNotes?: string;
  PerformedBy?: string;
  PerformedAt?: string;
}

/** 動的 $select ビルダー */
export function buildProcedureRecordSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(PROCEDURE_RECORD_FIELDS, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [...PROCEDURE_RECORD_SELECT_FIELDS],
  });
}

/** Dynamic Schema Resolution 用候補定義: SupportProcedureRecord_Daily */
export const PROCEDURE_RECORD_CANDIDATES = {
  id: ['Id', 'ID'],
  title: ['Title'],
  userCode: ['UserCode', 'UserID', 'User_ID', 'cr013_userCode'],
  planningSheetId: ['PlanningSheetId', 'PlanningSheetLookupId', 'cr013_planningSheetId'],
  recordDate: ['RecordDate', 'Date', 'cr013_recordDate'],
  timeSlot: ['TimeSlot', 'Time', 'cr013_timeSlot'],
  activity: ['Activity', 'Action', 'cr013_activity'],
  procedureText: ['ProcedureText', 'Procedure', 'cr013_procedureText'],
  executionStatus: ['ExecutionStatus', 'Status', 'cr013_executionStatus'],
  performedBy: ['PerformedBy', 'Staff', 'cr013_performedBy'],
  performedAt: ['PerformedAt', 'Time', 'cr013_performedAt'],
  ispId: ['ISPId', 'ISPLookupId', 'cr013_ispId'],
  handoffNotes: ['HandoffNotes', 'Handoff_x0020_Notes', 'cr013_handoffNotes'],
} as const;

export const PROCEDURE_RECORD_ESSENTIALS: (keyof typeof PROCEDURE_RECORD_CANDIDATES)[] = [
  'userCode', 'planningSheetId', 'recordDate'
];
