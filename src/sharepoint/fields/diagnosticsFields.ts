/**
 * SharePoint フィールド定義 — Diagnostics_Reports
 */

export const DIAGNOSTICS_REPORTS_LIST_TITLE = 'Diagnostics_Reports' as const;

/**
 * Diagnostics_Reports リスト用フィールド定義（内部名マップ）
 *
 * 使用方法：
 * - コード内では logicalName（左側）を使用
 * - SharePoint API呼び出し時は value（右側）の内部名を使用
 *
 * 内部名が変わった場合:
 * - このオブジェクトの value のみ修正すれば、全コード自動対応
 *
 * @example
 * // ✅ 使用パターン
 * const fieldName = FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink;
 * // fieldName = 'Report_x0020_Link' (内部名)
 *
 * // ❌ 非推奨（内部名をハードコード）
 * const fieldName = 'Report_x0020_Link';
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
 * Diagnostics_Reports の select フィールド（固定）
 *
 * Power Automate/SharePoint は環境で返却形式が微妙に異なるため、
 * 取得列を固定しておくと、互換性問題を最小化できます。
 *
 * 全キーを field map 経由で定義しているため、内部名変更時は
 * FIELD_MAP_DIAGNOSTICS_REPORTS を修正するだけで OK
 */
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

export const DRIFT_LOG_LIST_TITLE = 'DriftEventsLog' as const;

export const DRIFT_LOG_CANDIDATES = {
  listName: ['ListName', 'NameOfList', 'ListTitle', 'ListName0'],
  fieldName: ['FieldName', 'InternalName', 'ColumnName', 'FieldName0'],
  detectedAt: ['DetectedAt', 'OccurredAt', 'Detected_At', 'DetectedAt0'],
  severity: ['Severity', 'Level', 'Status', 'Severity0'],
  resolutionType: ['ResolutionType', 'Resolution', 'Type', 'ResolutionType0'],
  resolved: ['Resolved', 'IsResolved', 'Fixed', 'Resolved0'],
  driftType: ['DriftType', 'Type', 'Category', 'DriftType0'],
} as const;
