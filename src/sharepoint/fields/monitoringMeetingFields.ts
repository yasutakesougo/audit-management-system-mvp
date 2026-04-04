/**
 * monitoringMeetingFields.ts — MonitoringMeetings リストのフィールド定義
 *
 * SP 列の内部名を一箇所で管理し、Repository / Query 側で直接文字列を使わせない。
 *
 * @see /docs/monitoring-meetings-sp-schema.md (設計書)
 * @see src/domain/isp/monitoringMeeting.ts (Domain 型)
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

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

/**
 * MonitoringMeetings リスト用の動的 $select ビルダー
 */
export function buildMonitoringMeetingSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(MONITORING_MEETING_FIELDS, existingInternalNames, {
    alwaysInclude: ['Id', 'Title'],
    fallback: [...MONITORING_MEETING_SELECT],
  });
}

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
// Resilient Field Resolution & Provisioning
// ---------------------------------------------------------------------------

/**
 * 列解決候補 (Dynamic Schema Resolution 用)
 */
export const MONITORING_MEETING_CANDIDATES = {
  recordId:           [MONITORING_MEETING_FIELDS.recordId, 'RecordId', 'recordId', 'Record_x0020_Id', 'RecordId0', 'Title'],
  userId:             [MONITORING_MEETING_FIELDS.userId, 'UserId', 'UserID', 'UserCode', 'userId', 'User_x0020_Id', 'UserId0', 'cr013_userId'],
  ispId:              [MONITORING_MEETING_FIELDS.ispId, 'IspId', 'ISPId', 'ispId', 'Isp_x0020_Id', 'IspId0'],
  planningSheetId:    [MONITORING_MEETING_FIELDS.planningSheetId, 'PlanningSheetId', 'planningSheetId', 'Planning_x0020_Sheet_x0020_Id', 'PlanningSheetId0'],
  meetingType:        [MONITORING_MEETING_FIELDS.meetingType, 'MeetingType', 'meetingType', 'Meeting_x0020_Type', 'MeetingType0'],
  meetingDate:        [MONITORING_MEETING_FIELDS.meetingDate, 'MeetingDate', 'Meeting_x0020_Date', 'meetingDate', 'Date', 'RecordDate', 'cr013_date', 'MeetingDate0'],
  venue:              [MONITORING_MEETING_FIELDS.venue, 'Venue', 'venue', 'Venue0'],
  attendeesJson:      [MONITORING_MEETING_FIELDS.attendeesJson, 'AttendeesJson', 'Attendees', 'attendeesJson', 'Attendees_x0020_JSON', 'AttendeesJson0'],
  goalEvaluationsJson: [MONITORING_MEETING_FIELDS.goalEvaluationsJson, 'GoalEvaluationsJson', 'GoalEvaluations', 'goalEvaluationsJson', 'GoalEvaluations_x0020_JSON', 'GoalEvaluationsJson0'],
  overallAssessment:  [MONITORING_MEETING_FIELDS.overallAssessment, 'OverallAssessment', 'overallAssessment', 'Overall_x0020_Assessment', 'OverallAssessment0'],
  userFeedback:       [MONITORING_MEETING_FIELDS.userFeedback, 'UserFeedback', 'userFeedback', 'User_x0020_Feedback', 'UserFeedback0'],
  familyFeedback:     [MONITORING_MEETING_FIELDS.familyFeedback, 'FamilyFeedback', 'familyFeedback', 'Family_x0020_Feedback', 'FamilyFeedback0'],
  planChangeDecision: [MONITORING_MEETING_FIELDS.planChangeDecision, 'PlanChangeDecision', 'planChangeDecision', 'Plan_x0020_Change_x0020_Decision', 'PlanChangeDecision0'],
  changeReason:       [MONITORING_MEETING_FIELDS.changeReason, 'ChangeReason', 'changeReason', 'Change_x0020_Reason', 'ChangeReason0'],
  decisionsJson:      [MONITORING_MEETING_FIELDS.decisionsJson, 'DecisionsJson', 'Decisions', 'decisionsJson', 'Decisions_x0020_JSON', 'DecisionsJson0'],
  nextMonitoringDate: [MONITORING_MEETING_FIELDS.nextMonitoringDate, 'NextMonitoringDate', 'Next_x0020_Monitoring_x0020_Date', 'nextMonitoringDate', 'NextMonitoringDate0'],
  recordedBy:         [MONITORING_MEETING_FIELDS.recordedBy, 'RecordedBy', 'recordedBy', 'Recorded_x0020_By', 'RecordedBy0'],
  recordedAt:         [MONITORING_MEETING_FIELDS.recordedAt, 'RecordedAt', 'recordedAt', 'Recorded_x0020_At', 'RecordedAt0'],
} as const;

export type MonitoringMeetingCandidateKey = keyof typeof MONITORING_MEETING_CANDIDATES;
export type MonitoringMeetingFieldMapping = Partial<Record<MonitoringMeetingCandidateKey, string>>;


/**
 * 必須フィールド — この3点が解決できない場合は FAIL。
 *
 * - recordId: レコードの一意キー（検索・更新・削除に必須）
 * - userId: 誰のモニタリングか（一覧フィルタに必須）
 * - meetingDate: いつの会議か（時系列表示に必須）
 *
 * ispId は provisioning では required だが、ISP 紐付けなしでも会議情報を
 * 表示継続できるため essentials から除外（WARN 水準）。
 */
export const MONITORING_MEETING_ESSENTIALS: (keyof typeof MONITORING_MEETING_CANDIDATES)[] = [
  'recordId',
  'userId',
  'meetingDate',
];

/**
 * optional フィールドキー一覧（診断/警告用途）
 */
export const MONITORING_MEETING_OPTIONALS: MonitoringMeetingCandidateKey[] =
  (Object.keys(MONITORING_MEETING_CANDIDATES) as MonitoringMeetingCandidateKey[])
    .filter((key) => !MONITORING_MEETING_ESSENTIALS.includes(key));

/**
 * 自己修復 (Self-Healing) 用の列定義
 */
export const MONITORING_MEETING_ENSURE_FIELDS = [
  { internalName: MONITORING_MEETING_FIELDS.recordId, type: 'Text', required: true },
  { internalName: MONITORING_MEETING_FIELDS.userId, type: 'Text', required: true },
  { internalName: MONITORING_MEETING_FIELDS.ispId, type: 'Text', required: true },
  { internalName: MONITORING_MEETING_FIELDS.planningSheetId, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.meetingType, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.meetingDate, type: 'Text', required: true },
  { internalName: MONITORING_MEETING_FIELDS.venue, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.attendeesJson, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.goalEvaluationsJson, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.overallAssessment, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.userFeedback, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.familyFeedback, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.planChangeDecision, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.changeReason, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.decisionsJson, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.nextMonitoringDate, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.recordedBy, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.recordedAt, type: 'Text', required: false },
] as const;

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
