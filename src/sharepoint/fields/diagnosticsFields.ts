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
  summaryText: [FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText],
  reportLink: [FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink],
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
  listName: ['List_x0020_Name', 'ListName', 'NameOfList', 'ListTitle', 'ListName0'],
  fieldName: ['Field_x0020_Name', 'FieldName', 'InternalName', 'ColumnName', 'FieldName0'],
  detectedAt: ['Detected_x0020_At', 'DetectedAt', 'OccurredAt', 'Detected_At', 'DetectedAt0'],
  loggedAt: ['Logged_x0020_At', 'LoggedAt', 'RecordedAt', 'LoggedAt0'],
  severity: ['Severity', 'Level', 'Status', 'Severity0'],
  resolutionType: ['ResolutionType', 'Resolution', 'Type', 'ResolutionType0'],
  resolved: ['Resolved', 'IsResolved', 'Fixed', 'Resolved0'],
  driftType: ['DriftType', 'Type', 'Category', 'DriftType0'],
} as const;
