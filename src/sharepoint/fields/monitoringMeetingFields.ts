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
  userName: 'cr014_userName',
  ispId: 'cr014_ispId',
  planningSheetId: 'cr014_planningSheetId',
  planningSheetTitle: 'cr014_planningSheetTitle',

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

  // ── 強度行動障害支援・監査強化 ──
  implementationSummary: 'cr014_implSummary',
  behaviorChangeSummary: 'cr014_behaviorChange',
  effectiveSupportSummary: 'cr014_effSupport',
  issueSummary: 'cr014_issueSummary',
  discussionSummary: 'cr014_discussionSummary',
  requiresPlanSheetUpdate: 'cr014_reqPlanSheetUpd',
  requiresIspUpdate: 'cr014_reqIspUpd',
  hasBasicTrainedMember: 'cr014_hasBasicTrained',
  hasPracticalTrainedMember: 'cr014_hasPractTrained',
  qualificationCheckStatus: 'cr014_qualCheckStatus',
  nextActions: 'cr014_nextActions',

  // ── 監査ステータス ──
  status: 'cr014_status',
  finalizedAt: 'cr014_finalizedAt',
  finalizedBy: 'cr014_finalizedBy',
  previousMeetingId: 'cr014_prevMeetingId',
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
  cr014_userName?: string;
  cr014_ispId?: string;
  cr014_planningSheetId?: string;
  cr014_planningSheetTitle?: string;

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

  cr014_implSummary?: string;
  cr014_behaviorChange?: string;
  cr014_effSupport?: string;
  cr014_issueSummary?: string;
  cr014_discussionSummary?: string;
  cr014_reqPlanSheetUpd?: boolean;
  cr014_reqIspUpd?: boolean;
  cr014_hasBasicTrained?: boolean;
  cr014_hasPractTrained?: boolean;
  cr014_qualCheckStatus?: string;
  cr014_nextActions?: string;

  cr014_status?: string;
  cr014_finalizedAt?: string;
  cr014_finalizedBy?: string;
  cr014_prevMeetingId?: string;

  '@odata.etag'?: string;
} & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Resilient Field Resolution & Provisioning
// ---------------------------------------------------------------------------

/**
 * 列解決候補 (Dynamic Schema Resolution 用)
 */
export const MONITORING_MEETING_CANDIDATES = {
  recordId: [MONITORING_MEETING_FIELDS.recordId, 'RecordId', 'recordId', 'Record_x0020_Id', 'Title'],
  userId: [MONITORING_MEETING_FIELDS.userId, 'UserId', 'UserID', 'UserCode', 'userId', 'User_x0020_Id', 'cr013_userId'],
  userName: [MONITORING_MEETING_FIELDS.userName, 'UserName', 'userName'],
  ispId: [MONITORING_MEETING_FIELDS.ispId, 'IspId', 'ISPId', 'ispId'],
  planningSheetId: [MONITORING_MEETING_FIELDS.planningSheetId, 'PlanningSheetId', 'planningSheetId'],
  planningSheetTitle: [MONITORING_MEETING_FIELDS.planningSheetTitle, 'PlanningSheetTitle', 'planningSheetTitle'],
  meetingType: [MONITORING_MEETING_FIELDS.meetingType, 'MeetingType', 'meetingType'],
  meetingDate: [MONITORING_MEETING_FIELDS.meetingDate, 'MeetingDate', 'Meeting_x0020_Date', 'meetingDate', 'Date', 'RecordDate', 'cr013_date'],
  venue: [MONITORING_MEETING_FIELDS.venue, 'Venue', 'venue'],
  attendeesJson: [MONITORING_MEETING_FIELDS.attendeesJson, 'AttendeesJson', 'Attendees', 'attendeesJson'],
  goalEvaluationsJson: [MONITORING_MEETING_FIELDS.goalEvaluationsJson, 'GoalEvaluationsJson', 'GoalEvaluations', 'goalEvaluationsJson'],
  overallAssessment: [MONITORING_MEETING_FIELDS.overallAssessment, 'OverallAssessment', 'overallAssessment'],
  userFeedback: [MONITORING_MEETING_FIELDS.userFeedback, 'UserFeedback', 'userFeedback'],
  familyFeedback: [MONITORING_MEETING_FIELDS.familyFeedback, 'FamilyFeedback', 'familyFeedback'],
  planChangeDecision: [MONITORING_MEETING_FIELDS.planChangeDecision, 'PlanChangeDecision', 'planChangeDecision'],
  changeReason: [MONITORING_MEETING_FIELDS.changeReason, 'ChangeReason', 'changeReason'],
  decisionsJson: [MONITORING_MEETING_FIELDS.decisionsJson, 'DecisionsJson', 'Decisions', 'decisionsJson'],
  nextMonitoringDate: [MONITORING_MEETING_FIELDS.nextMonitoringDate, 'NextMonitoringDate', 'Next_x0020_Monitoring_x0020_Date', 'nextMonitoringDate'],
  recordedBy: [MONITORING_MEETING_FIELDS.recordedBy, 'RecordedBy', 'recordedBy'],
  recordedAt: [MONITORING_MEETING_FIELDS.recordedAt, 'RecordedAt', 'recordedAt'],
  implementationSummary: [MONITORING_MEETING_FIELDS.implementationSummary, 'ImplementationSummary', 'implSummary'],
  behaviorChangeSummary: [MONITORING_MEETING_FIELDS.behaviorChangeSummary, 'BehaviorChangeSummary', 'behaviorChange'],
  effectiveSupportSummary: [MONITORING_MEETING_FIELDS.effectiveSupportSummary, 'EffectiveSupportSummary', 'effSupport'],
  issueSummary: [MONITORING_MEETING_FIELDS.issueSummary, 'IssueSummary', 'issueSummary'],
  discussionSummary: [MONITORING_MEETING_FIELDS.discussionSummary, 'DiscussionSummary', 'discussionSummary'],
  requiresPlanSheetUpdate: [MONITORING_MEETING_FIELDS.requiresPlanSheetUpdate, 'RequiresPlanSheetUpdate', 'reqPlanSheetUpd'],
  requiresIspUpdate: [MONITORING_MEETING_FIELDS.requiresIspUpdate, 'RequiresIspUpdate', 'reqIspUpd'],
  hasBasicTrainedMember: [MONITORING_MEETING_FIELDS.hasBasicTrainedMember, 'HasBasicTrainedMember', 'hasBasicTrained'],
  hasPracticalTrainedMember: [MONITORING_MEETING_FIELDS.hasPracticalTrainedMember, 'HasPracticalTrainedMember', 'hasPractTrained'],
  qualificationCheckStatus: [MONITORING_MEETING_FIELDS.qualificationCheckStatus, 'QualificationCheckStatus', 'qualCheckStatus'],
  nextActions: [MONITORING_MEETING_FIELDS.nextActions, 'NextActions', 'nextActions'],
  status: [MONITORING_MEETING_FIELDS.status, 'Status', 'status'],
  finalizedAt: [MONITORING_MEETING_FIELDS.finalizedAt, 'FinalizedAt', 'finalizedAt'],
  finalizedBy: [MONITORING_MEETING_FIELDS.finalizedBy, 'FinalizedBy', 'finalizedBy'],
  previousMeetingId: [MONITORING_MEETING_FIELDS.previousMeetingId, 'PreviousMeetingId', 'prevMeetingId'],
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
  { internalName: MONITORING_MEETING_FIELDS.userName, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.ispId, type: 'Text', required: true },
  { internalName: MONITORING_MEETING_FIELDS.planningSheetId, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.planningSheetTitle, type: 'Text', required: false },
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
  { internalName: MONITORING_MEETING_FIELDS.implementationSummary, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.behaviorChangeSummary, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.effectiveSupportSummary, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.issueSummary, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.discussionSummary, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.requiresPlanSheetUpdate, type: 'Boolean', required: false },
  { internalName: MONITORING_MEETING_FIELDS.requiresIspUpdate, type: 'Boolean', required: false },
  { internalName: MONITORING_MEETING_FIELDS.hasBasicTrainedMember, type: 'Boolean', required: false },
  { internalName: MONITORING_MEETING_FIELDS.hasPracticalTrainedMember, type: 'Boolean', required: false },
  { internalName: MONITORING_MEETING_FIELDS.qualificationCheckStatus, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.nextActions, type: 'Note', required: false },
  { internalName: MONITORING_MEETING_FIELDS.status, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.finalizedAt, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.finalizedBy, type: 'Text', required: false },
  { internalName: MONITORING_MEETING_FIELDS.previousMeetingId, type: 'Text', required: false },
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
