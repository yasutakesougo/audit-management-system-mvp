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
