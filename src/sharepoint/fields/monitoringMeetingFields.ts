/**
 * monitoringMeetingFields.ts — MonitoringMeetings リストのフィールド定義
 *
 * SP 列の内部名を一箇所で管理し、Repository / Query 側で直接文字列を使わせない。
 *
 * @see /docs/monitoring-meetings-sp-schema.md (設計書)
 * @see src/domain/isp/monitoringMeeting.ts (Domain 型)
 */

// ---------------------------------------------------------------------------
// Field Map
// ---------------------------------------------------------------------------

export const MONITORING_MEETING_FIELDS = {
  // ── 主キー・参照 ──
  recordId: 'cr014_recordId',
  userId: 'cr014_userId',
  ispId: 'cr014_ispId',
  planningSheetId: 'cr014_planningSheetId',

  // ── 会議情報 ──
  meetingType: 'cr014_meetingType',
  meetingDate: 'cr014_meetingDate',
  venue: 'cr014_venue',

  // ── 参加者 (JSON) ──
  attendeesJson: 'cr014_attendeesJson',

  // ── 評価内容 ──
  goalEvaluationsJson: 'cr014_goalEvaluationsJson',
  overallAssessment: 'cr014_overallAssessment',
  userFeedback: 'cr014_userFeedback',
  familyFeedback: 'cr014_familyFeedback',

  // ── 決定事項 ──
  planChangeDecision: 'cr014_planChangeDecision',
  changeReason: 'cr014_changeReason',
  decisionsJson: 'cr014_decisionsJson',
  nextMonitoringDate: 'cr014_nextMonitoringDate',

  // ── メタ ──
  recordedBy: 'cr014_recordedBy',
  recordedAt: 'cr014_recordedAt',
} as const;

export type MonitoringMeetingFieldKey = keyof typeof MONITORING_MEETING_FIELDS;
export type MonitoringMeetingSPField =
  (typeof MONITORING_MEETING_FIELDS)[MonitoringMeetingFieldKey];

// ---------------------------------------------------------------------------
// OData $select 用の列一覧
// ---------------------------------------------------------------------------

/** listItems の $select に渡す完全な列リスト */
export const MONITORING_MEETING_SELECT = [
  'Id',
  'Title',
  ...Object.values(MONITORING_MEETING_FIELDS),
] as const;

// ---------------------------------------------------------------------------
// SP Row 型（REST API レスポンス）
// ---------------------------------------------------------------------------

/**
 * SharePoint REST API から返る生の行データ。
 * Repository の mapSp → Domain 変換の入力型として使用。
 */
export type SpMonitoringMeetingRow = {
  Id?: number;
  Title?: string;

  cr014_recordId?: string;
  cr014_userId?: string;
  cr014_ispId?: string;
  cr014_planningSheetId?: string;

  cr014_meetingType?: string;
  cr014_meetingDate?: string;
  cr014_venue?: string;

  cr014_attendeesJson?: string;

  cr014_goalEvaluationsJson?: string;
  cr014_overallAssessment?: string;
  cr014_userFeedback?: string;
  cr014_familyFeedback?: string;

  cr014_planChangeDecision?: string;
  cr014_changeReason?: string;
  cr014_decisionsJson?: string;
  cr014_nextMonitoringDate?: string;

  cr014_recordedBy?: string;
  cr014_recordedAt?: string;

  '@odata.etag'?: string;
} & Record<string, unknown>;

// ---------------------------------------------------------------------------
// JSON パース用ユーティリティ
// ---------------------------------------------------------------------------

/**
 * SP の Note 列 (JSON 文字列) を安全にパースする。
 * 空文字・null・不正JSONの場合は fallback を返す。
 */
export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
