/**
 * SharePoint フィールド定義 — Diagnostics_Reports
 */

export const DIAGNOSTICS_REPORTS_LIST_TITLE = 'Diagnostics_Reports' as const;

/**
 * Diagnostics_Reports リスト用フィールド定義（内部名マップ）
 */
export const FIELD_MAP_DIAGNOSTICS_REPORTS = {
  id: 'Id',                    // SharePoint システムフィールド
  title: 'Title',              // 一意キー: health:<tenant>:<site>
  overall: 'Overall',          // Choice: pass | warn | fail
  topIssue: 'TopIssue',        // 最上位課題（1行）
  summaryText: 'SummaryText',  // 詳細サマリー（複数行）
  reportLink: 'ReportLink',    // 診断レポートへのリンク
  notified: 'Notified',        // 通知フラグ（Power Automate制御）
  notifiedAt: 'NotifiedAt',    // 通知日時
  created: 'Created',          // SharePoint システムフィールド
  modified: 'Modified',        // SharePoint システムフィールド
} as const;

/**
 * Diagnostics_Reports の drift 耐性候補
 */
export const DIAGNOSTICS_REPORTS_CANDIDATES = {
  id: [FIELD_MAP_DIAGNOSTICS_REPORTS.id],
  title: [FIELD_MAP_DIAGNOSTICS_REPORTS.title],
  overall: [FIELD_MAP_DIAGNOSTICS_REPORTS.overall],
  topIssue: [FIELD_MAP_DIAGNOSTICS_REPORTS.topIssue, 'TopIssue0', 'Top_x0020_Issue'],
  summaryText: [FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText, 'Summary_x0020_Text'],
  reportLink: [FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink, 'Report_x0020_Link'],
  notified: [FIELD_MAP_DIAGNOSTICS_REPORTS.notified],
  notifiedAt: [FIELD_MAP_DIAGNOSTICS_REPORTS.notifiedAt, 'Notified_x0020_At', 'NotifiedAt0'],
  created: [FIELD_MAP_DIAGNOSTICS_REPORTS.created],
  modified: [FIELD_MAP_DIAGNOSTICS_REPORTS.modified],
} as const;

export const DIAGNOSTICS_REPORTS_SELECT_FIELDS = [
  FIELD_MAP_DIAGNOSTICS_REPORTS.id,
  FIELD_MAP_DIAGNOSTICS_REPORTS.title,
  FIELD_MAP_DIAGNOSTICS_REPORTS.overall,
  FIELD_MAP_DIAGNOSTICS_REPORTS.topIssue,
  FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText,
  FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink,
  FIELD_MAP_DIAGNOSTICS_REPORTS.notified,
  FIELD_MAP_DIAGNOSTICS_REPORTS.notifiedAt,
  FIELD_MAP_DIAGNOSTICS_REPORTS.created,
  FIELD_MAP_DIAGNOSTICS_REPORTS.modified,
] as const;

/**
 * ── DriftEventsLog (Drift Logging) ──────────────────────────
 */

export const DRIFT_LOG_LIST_TITLE = 'DriftEventsLog_v2' as const;

export const DRIFT_LOG_CANDIDATES = {
  listName: ['List_x0020_Name', 'ListName', 'NameOfList', 'ListTitle', 'ListName0', 'cr013_listName'],
  fieldName: ['Field_x0020_Name', 'FieldName', 'InternalName', 'ColumnName', 'FieldName0', 'cr013_fieldName'],
  detectedAt: ['Detected_x0020_At', 'DetectedAt', 'OccurredAt', 'Detected_At', 'DetectedAt0', 'cr013_detectedAt'],
  loggedAt: ['Logged_x0020_At', 'LoggedAt', 'RecordedAt', 'LoggedAt0', 'cr013_loggedAt'],
  severity: ['Severity', 'Level', 'Status', 'Severity0', '_Level', 'cr013_severity'],
  resolutionType: ['ResolutionType', 'Resolution', 'Type', 'ResolutionType0', 'cr013_resolutionType'],
  resolved: ['Resolved', 'IsResolved', 'Fixed', 'Resolved0', 'cr013_resolved'],
  driftType: ['DriftType', 'Type', 'Category', 'DriftType0', 'cr013_driftType'],
  description: ['Description', 'Details', 'Desc', 'Description0', 'cr013_description'],
  remediationSource: ['RemediationSource', 'Source', 'RemediationSource0', 'cr013_remediationSource'],
} as const;

/**
 * Remediation_AuditLog の drift 耐性候補
 */
export const REMEDIATION_AUDIT_CANDIDATES = {
  correlationId: ['CorrelationId', 'Correlation_x0020_ID', 'CorrelationId0', 'cr013_correlationId'],
  planId: ['PlanId', 'Plan_x0020_ID', 'PlanId0', 'cr013_planId'],
  phase: ['Phase', 'AuditPhase', 'Phase0', 'cr013_phase'],
  targetType: ['TargetType', 'RemediationTargetType', 'TargetType0', 'cr013_targetType'],
  listKey: ['ListKey', 'TargetList', 'ListKey0', 'cr013_listKey'],
  fieldName: ['FieldName', 'TargetField', 'FieldName0', 'cr013_fieldName'],
  action: ['Action', 'RemediationAction', 'Action0', 'cr013_action'],
  risk: ['Risk', 'Severity', 'Risk0', 'cr013_risk'],
  autoExecutable: ['AutoExecutable', 'IsAuto', 'AutoExecutable0', 'cr013_autoExecutable'],
  requiresApproval: ['RequiresApproval', 'NeedApproval', 'RequiresApproval0', 'cr013_requiresApproval'],
  reason: ['Reason', 'Justification', 'Reason0', 'cr013_reason'],
  source: ['Source', 'PlanSource', 'Source0', 'cr013_source'],
  executionStatus: ['ExecutionStatus', 'Status', 'ExecutionStatus0', 'cr013_executionStatus', 'Status0'],
  executionError: ['ExecutionError', 'ErrorMessage', 'ExecutionError0', 'cr013_executionError'],
  timestamp: ['Timestamp', 'OccurredAt', 'Timestamp0', 'cr013_timestamp'],
  payload: ['Payload', 'PayloadJSON', 'Data', 'Payload0', 'cr013_payload'],
} as const;
