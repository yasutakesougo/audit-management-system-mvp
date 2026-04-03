/**
 * SharePoint フィールド定義 — DailyActivityRecords + Daily record fields
 */
import type { SpDailyItem } from '@/types';
import { buildSelectFieldsFromMap } from './fieldUtils';

export type DailyRow = SpDailyItem;

/**
 * DailyActivityRecords リスト用フィールド定義（内部名）
 * Fields API で確認済み: UserCode, RecordDate, TimeSlot, Observation, Behavior, version, duration, Order
 *
 * NOTE: `intensity` → `version` と `duration` → `duration` は SharePoint 内部名が小文字。
 * これはレガシースキーマの仕様であり、意図的なマッピング（変更不可）。
 */
export const FIELD_MAP_DAILY_ACTIVITY = {
  id: 'Id',
  userId: 'UserCode',
  recordDate: 'RecordDate',
  timeSlot: 'TimeSlot',
  planSlotKey: 'PlanSlotKey',
  plannedActivity: 'PlannedActivity',
  recordedAtText: 'RecordedAtText',
  observation: 'Observation',
  behavior: 'Behavior',
  intensity: 'version',
  duration: 'duration',
  order: 'Order',
  created: 'Created',
  modified: 'Modified',
} as const;

export const DAILY_ACTIVITY_SELECT_FIELDS = [
  FIELD_MAP_DAILY_ACTIVITY.id,
  FIELD_MAP_DAILY_ACTIVITY.userId,
  FIELD_MAP_DAILY_ACTIVITY.recordDate,
  FIELD_MAP_DAILY_ACTIVITY.timeSlot,
  FIELD_MAP_DAILY_ACTIVITY.planSlotKey,
  FIELD_MAP_DAILY_ACTIVITY.plannedActivity,
  FIELD_MAP_DAILY_ACTIVITY.recordedAtText,
  FIELD_MAP_DAILY_ACTIVITY.observation,
  FIELD_MAP_DAILY_ACTIVITY.behavior,
  FIELD_MAP_DAILY_ACTIVITY.intensity,
  FIELD_MAP_DAILY_ACTIVITY.duration,
  FIELD_MAP_DAILY_ACTIVITY.order,
  FIELD_MAP_DAILY_ACTIVITY.created,
] as const;

/**
 * 0. DailyActivityRecords リストのフィールド候補
 */
export const DAILY_ACTIVITY_RECORDS_CANDIDATES = {
  userId: ['UserCode', 'userId', 'cr013_usercode', 'cr013_personId', 'UserId', 'UserID'],
  recordDate: ['RecordDate', 'recordDate', 'cr013_recorddate', 'Date', 'record_date', 'cr013_date'],
  timeSlot: ['TimeSlot', 'timeSlot', 'cr013_timeSlot'],
  planSlotKey: ['PlanSlotKey', 'planSlotKey', 'cr013_planSlotKey'],
  plannedActivity: ['PlannedActivity', 'plannedActivity', 'cr013_plannedActivity'],
  recordedAtText: ['RecordedAtText', 'recordedAtText', 'cr013_recordedAtText'],
  observation: ['Observation', 'observation', 'cr013_observation', 'Notes'],
  behavior: ['Behavior', 'behavior', 'cr013_behavior'],
  intensity: ['version', 'intensity', 'cr013_version', 'Intensity'],
  duration: ['duration', 'Duration', 'cr013_duration'],
  order: ['Order', 'order', 'cr013_order'],
} as const;

export const DAILY_ACTIVITY_RECORDS_ESSENTIALS: (keyof typeof DAILY_ACTIVITY_RECORDS_CANDIDATES)[] = [
  'userId', 'recordDate', 'timeSlot', 'observation'
];

/**
 * DailyActivityRecords リスト用の動的 $select ビルダー
 */
export function buildDailyActivitySelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_DAILY_ACTIVITY, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [
      'Id',
      'UserCode',
      'RecordDate',
      'TimeSlot',
      'PlanSlotKey',
      'PlannedActivity',
      'RecordedAtText',
      'Observation',
      'Behavior',
      'version',
      'duration',
      'Order',
      'Created',
      'Modified',
    ],
  });
}

// ──────────────────────────────────────────────────────────────
// Daily record list fields (individual constants)
// ──────────────────────────────────────────────────────────────

export const DAILY_FIELD_DATE = 'Date' as const;
export const DAILY_FIELD_START_TIME = 'StartTime' as const;
export const DAILY_FIELD_END_TIME = 'EndTime' as const;
export const DAILY_FIELD_LOCATION = 'Location' as const;
export const DAILY_FIELD_STAFF_ID = 'StaffIdId' as const;
export const DAILY_FIELD_USER_ID = 'UserIdId' as const;
export const DAILY_FIELD_NOTES = 'Notes' as const;
export const DAILY_FIELD_MEAL_LOG = 'MealLog' as const;
export const DAILY_FIELD_BEHAVIOR_LOG = 'BehaviorLog' as const;
export const DAILY_FIELD_DRAFT = 'Draft' as const;
export const DAILY_FIELD_STATUS = 'Status' as const;

import type { SpFieldDef } from '@/lib/sp/types';

/**
 * 1. Canonical Daily Record (日次集約済 1日1レコード形式) のフィールド候補
 */
export const DAILY_RECORD_CANONICAL_CANDIDATES = {
  title: ['Title'], // YYYY-MM-DD
  recordDate: ['RecordDate', 'Date', 'recordDate', 'cr013_date', 'record_date'],
  reporterName: ['ReporterName', 'reporterName', 'cr013_reporterName', 'StaffName'],
  reporterRole: ['ReporterRole', 'reporterRole', 'cr013_reporterRole'],
  userRowsJSON: ['UserRowsJSON', 'userRowsJSON', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON'],
  userCount: ['UserCount', 'userCount', 'cr013_userCount'],
  approvalStatus: ['ApprovalStatus', 'approvalStatus', 'cr013_approvalStatus'],
  approvedBy: ['ApprovedBy', 'approvedBy', 'cr013_approvedBy'],
  approvedAt: ['ApprovedAt', 'approvedAt', 'cr013_approvedAt'],
} as const;

export const DAILY_RECORD_CANONICAL_ESSENTIALS: (keyof typeof DAILY_RECORD_CANONICAL_CANDIDATES)[] = [
  'title', 'recordDate', 'userRowsJSON'
];

/**
 * 2. Row Aggregate Fallback (支援記録/個別記録 行単位形式) のフィールド候補
 */
export const DAILY_RECORD_ROW_AGGREGATE_CANDIDATES = {
  title: ['Title'],
  ParentID: ['ParentID', 'Parent_x0020_ID', 'cr013_parentid'],
  userId: ['UserCode', 'cr013_usercode', 'cr013_personId', 'cr013_userid', 'UserId', 'UserID', 'userId'],
  recordDate: ['RecordDate', 'cr013_date', 'cr013_recorddate', 'Date', 'recordDate'],
  status: ['Status', 'status', 'cr013_status'],
  reporterName: ['ReporterName', 'reporterName', 'cr013_reporterName', 'cr013_fullname'],
  payload: ['Payload', 'payload', 'cr013_payload', 'cr013_draftJson'],
  kind: ['Kind', 'kind', 'cr013_kind'],
  group: ['Group', 'group', 'cr013_group'],
  specialNote: ['SpecialNote', 'specialNote', 'cr013_specialnote'],
} as const;

export const DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS: (keyof typeof DAILY_RECORD_ROW_AGGREGATE_CANDIDATES)[] = [
  'userId', 'recordDate'
];

// ──────────────────────────────────────────────────────────────
// ActivityDiary フィールド定義
//
// spActivityDiary.ts が実際に書き込むフィールドから導出。
// UserID (Text) と UserIdId (Lookup) の両スキーマを candidates で吸収する。
// ──────────────────────────────────────────────────────────────

/**
 * ActivityDiary リストのフィールド候補マップ
 *
 * 各候補配列の先頭が「provisioningFields に記載されている基準名」。
 * 以降は SharePoint がリネームした可能性のある代替名。
 */
export const ACTIVITY_DIARY_CANDIDATES = {
  /** ユーザー識別子。Text 型の UserID と Lookup 型 UserId/UserIdId の両方を吸収 */
  userId:          ['UserID', 'UserId', 'UserIdId', 'user_id', 'cr013_userId'],
  /** 記録日 */
  date:            ['Date', 'date', 'RecordDate', 'EntryDate', 'cr013_date'],
  /** 時間帯 (AM / PM / 1日) */
  shift:           ['Shift', 'shift', 'Period', 'TimeSlot', 'cr013_shift'],
  /** 活動カテゴリ */
  category:        ['Category', 'category', 'ActivityCategory', 'cr013_category'],
  /** 昼食量 */
  lunchAmount:     ['LunchAmount', 'lunchAmount', 'Lunch', 'cr013_lunchAmount'],
  /** 主食量 */
  mealMain:        ['MealMain', 'mealMain', 'cr013_mealMain'],
  /** 副食量 */
  mealSide:        ['MealSide', 'mealSide', 'cr013_mealSide'],
  /** 問題行動あり/なし */
  problemBehavior: ['ProblemBehavior', 'problemBehavior', 'cr013_problemBehavior'],
  /** 問題行動種別 */
  behaviorType:    ['BehaviorType', 'behaviorType', 'cr013_behaviorType'],
  /** 問題行動メモ */
  behaviorNote:    ['BehaviorNote', 'behaviorNote', 'cr013_behaviorNote'],
  /** てんかん発作あり/なし */
  seizure:         ['Seizure', 'seizure', 'cr013_seizure'],
  /** てんかん発作時刻 */
  seizureAt:       ['SeizureAt', 'seizureAt', 'cr013_seizureAt'],
  /** 目標ID列 (カンマ区切り) */
  goals:           ['Goals', 'goals', 'GoalIds', 'cr013_goals'],
  /** 備考 */
  notes:           ['Notes', 'notes', 'cr013_notes'],
} as const;

/**
 * ActivityDiary の必須フィールド。
 * この 4 つが解決できない場合、リストをソースとして使えない。
 */
export const ACTIVITY_DIARY_ESSENTIALS: (keyof typeof ACTIVITY_DIARY_CANDIDATES)[] = [
  'userId', 'date', 'shift', 'category',
];

/**
 * Canonical Daily Record リストのプロビジョニング定義
 */
export const DAILY_RECORD_CANONICAL_ENSURE_FIELDS: SpFieldDef[] = [
  { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly' },
  { internalName: 'ReporterName', type: 'Text', displayName: 'Reporter Name' },
  { internalName: 'ReporterRole', type: 'Text', displayName: 'Reporter Role' },
  { internalName: 'UserRowsJSON', type: 'Note', displayName: 'User Rows JSON', required: true },
  { internalName: 'UserCount', type: 'Number', displayName: 'User Count' },
  { internalName: 'ApprovalStatus', type: 'Text', displayName: 'Approval Status' },
  { internalName: 'ApprovedBy', type: 'Text', displayName: 'Approved By' },
  { internalName: 'ApprovedAt', type: 'DateTime', displayName: 'Approved At', dateTimeFormat: 'DateTime' },
];
