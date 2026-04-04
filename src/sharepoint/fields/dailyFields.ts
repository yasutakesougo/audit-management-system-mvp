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
  title: ['Title', 'title'], // YYYY-MM-DD
  recordDate: ['RecordDate', 'Date', 'recordDate', 'Record_x0020_Date', 'RecordDate0', 'cr013_date', 'record_date'],
  reporterName: ['ReporterName', 'reporterName', 'ReporterName0', 'cr013_reporterName', 'StaffName'],
  reporterRole: ['ReporterRole', 'reporterRole', 'ReporterRole0', 'cr013_reporterRole'],
  userRowsJSON: ['UserRowsJSON', 'userRowsJSON', 'UserRowsJSON0', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON'],
  userCount: ['UserCount', 'userCount', 'UserCount0', 'cr013_userCount'],
  approvalStatus: ['ApprovalStatus', 'approvalStatus', 'ApprovalStatus0', 'cr013_approvalStatus'],
  approvedBy: ['ApprovedBy', 'approvedBy', 'ApprovedBy0', 'cr013_approvedBy'],
  approvedAt: ['ApprovedAt', 'approvedAt', 'ApprovedAt0', 'cr013_approvedAt'],
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
export * from './activityDiaryFields';


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
