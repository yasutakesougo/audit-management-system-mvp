/**
 * SharePoint フィールド定義 — Schedules
 */
import type { SpScheduleItem } from '@/types';
import { joinSelect } from './fieldUtils';

export type ScheduleRow = SpScheduleItem;

export const SCHEDULES_FIELD_MAP = {
  // Standard SharePoint columns
  id: 'Id',
  title: 'Title',
  created: 'Created',
  modified: 'Modified',

  // Phase 1 mandatory fields (validated in app-test staging)
  EventDate: 'EventDate', // DateTime
  EndDate: 'EndDate',     // DateTime
  Status: 'Status',       // Choice
  ServiceType: 'ServiceType', // Text
  cr014_personType: 'cr014_personType',  // Choice: User/Staff/Org
  cr014_personId: 'cr014_personId',      // Text
  cr014_personName: 'cr014_personName',  // Text (optional)
  AssignedStaffId: 'AssignedStaffId',    // Text (optional)
  TargetUserId: 'TargetUserId',          // Text (optional)
  RowKey: 'RowKey',                      // Text (identifier)
  cr014_dayKey: 'cr014_dayKey',          // DateTime → normalize to YYYY-MM-DD
  MonthKey: 'MonthKey',                  // Text: YYYY-MM
  cr014_fiscalYear: 'cr014_fiscalYear',  // Text
  cr014_orgAudience: 'cr014_orgAudience', // Text (optional)
  Note: 'Note',                          // Text (optional notes)
  CreatedAt: 'CreatedAt',                // DateTime (metadata)
  UpdatedAt: 'UpdatedAt',                // DateTime (metadata)

  // Legacy aliases (kept for backwards compatibility)
  start: 'EventDate',
  end: 'EndDate',
  notes: 'Note',
  rowKey: 'RowKey',
  dayKey: 'cr014_dayKey',
  monthKey: 'MonthKey',
  staffIds: 'AssignedStaffId',
  targetUserIds: 'TargetUserId',
} as const;

// ── Individual schedule field constants ──
export const SCHEDULE_FIELD_START = 'EventDate' as const;
export const SCHEDULE_FIELD_END = 'EndDate' as const;
export const SCHEDULE_FIELD_STATUS = 'Status' as const;
export const SCHEDULE_FIELD_CATEGORY = 'cr014_category' as const;
export const SCHEDULE_FIELD_SERVICE_TYPE = 'ServiceType' as const;
export const SCHEDULE_FIELD_PERSON_TYPE = 'cr014_personType' as const;
export const SCHEDULE_FIELD_PERSON_ID = 'cr014_personId' as const;
export const SCHEDULE_FIELD_PERSON_NAME = 'cr014_personName' as const;
export const SCHEDULE_FIELD_EXTERNAL_NAME = 'cr014_externalPersonName' as const;
export const SCHEDULE_FIELD_EXTERNAL_ORG = 'cr014_externalPersonOrg' as const;
export const SCHEDULE_FIELD_EXTERNAL_CONTACT = 'cr014_externalPersonContact' as const;
export const SCHEDULE_FIELD_STAFF_IDS = 'cr014_staffIds' as const;
export const SCHEDULE_FIELD_STAFF_NAMES = 'cr014_staffNames' as const;
export const SCHEDULE_FIELD_BILLING_FLAGS = 'BillingFlags' as const;
export const SCHEDULE_FIELD_NOTE = 'Note' as const;
export const SCHEDULE_FIELD_ASSIGNED_STAFF = 'AssignedStaff' as const;
export const SCHEDULE_FIELD_ASSIGNED_STAFF_ID = 'AssignedStaffId' as const;
export const SCHEDULE_FIELD_TARGET_USER = 'TargetUser' as const;
export const SCHEDULE_FIELD_TARGET_USER_ID = 'TargetUserId' as const;
export const SCHEDULE_FIELD_RELATED_RESOURCE = 'RelatedResource' as const;
export const SCHEDULE_FIELD_RELATED_RESOURCE_ID = 'RelatedResourceId' as const;
export const SCHEDULE_FIELD_ROW_KEY = 'RowKey' as const;
export const SCHEDULE_FIELD_DAY_KEY = 'cr014_dayKey' as const;
export const SCHEDULE_FIELD_FISCAL_YEAR = 'cr014_fiscalYear' as const;
export const SCHEDULE_FIELD_MONTH_KEY = 'MonthKey' as const;
export const SCHEDULE_FIELD_ENTRY_HASH = 'EntryHash' as const;
export const SCHEDULE_FIELD_SUB_TYPE = 'SubType' as const;
export const SCHEDULE_FIELD_ORG_AUDIENCE = 'cr014_orgAudience' as const;
export const SCHEDULE_FIELD_ORG_RESOURCE_ID = 'cr014_resourceId' as const;
export const SCHEDULE_FIELD_ORG_EXTERNAL_NAME = 'ExternalOrgName' as const;
export const SCHEDULE_FIELD_DAY_PART = 'cr014_dayPart' as const;
export const SCHEDULE_FIELD_CREATED_AT = 'CreatedAt' as const;
export const SCHEDULE_FIELD_UPDATED_AT = 'UpdatedAt' as const;

export const SCHEDULES_BASE_FIELDS = [
  'Id',
  'Title',
  SCHEDULE_FIELD_START,
  SCHEDULE_FIELD_END,
  SCHEDULE_FIELD_STATUS,
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_EXTERNAL_ORG,
  SCHEDULE_FIELD_EXTERNAL_CONTACT,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
  SCHEDULE_FIELD_BILLING_FLAGS,
  SCHEDULE_FIELD_NOTE,
  SCHEDULE_FIELD_ASSIGNED_STAFF,
  SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
  SCHEDULE_FIELD_TARGET_USER,
  SCHEDULE_FIELD_TARGET_USER_ID,
  SCHEDULE_FIELD_RELATED_RESOURCE,
  SCHEDULE_FIELD_RELATED_RESOURCE_ID,
  SCHEDULE_FIELD_ROW_KEY,
  SCHEDULE_FIELD_ENTRY_HASH,
  SCHEDULE_FIELD_DAY_KEY,
  SCHEDULE_FIELD_FISCAL_YEAR,
  SCHEDULE_FIELD_MONTH_KEY,
  SCHEDULE_FIELD_SUB_TYPE,
  SCHEDULE_FIELD_ORG_AUDIENCE,
  SCHEDULE_FIELD_ORG_RESOURCE_ID,
  SCHEDULE_FIELD_ORG_EXTERNAL_NAME,
  SCHEDULE_FIELD_DAY_PART,
  SCHEDULE_FIELD_CREATED_AT,
  SCHEDULE_FIELD_UPDATED_AT,
  'Created',
  'Modified',
  '@odata.etag',
] as const;

// SharePoint OData URL制限対応：最小限のフィールドセット（フィルター条件に必要なフィールドを含む）
// 開発環境では存在しない可能性のあるカスタムフィールドを除外
export const SCHEDULES_MINIMAL_FIELDS = [
  'Id',           // SharePoint既定フィールド（必須）
  'Title',        // SharePoint既定フィールド（必須）
  'Created',      // SharePoint既定フィールド（必須）
  'Modified',     // SharePoint既定フィールド（必須）
  '@odata.etag',  // データ更新で必要
] as const;

// 開発環境で利用可能な場合に追加で試行するフィールド
export const SCHEDULES_DEVELOPMENT_OPTIONAL_FIELDS = [
  'EventDate',    // フィルター条件で必要（存在する場合）
  'EndDate',      // フィルター条件で必要（存在する場合）
  SCHEDULE_FIELD_CATEGORY, // フィルター条件で必要（存在する場合）
] as const;

export const SCHEDULES_COMMON_OPTIONAL_FIELDS = [] as const;

export const SCHEDULES_STAFF_TEXT_FIELDS = [] as const;

// URL制限対応：開発環境では短いフィールドセットを使用
const isVitestRuntime = typeof process !== 'undefined' && process.env?.VITEST === 'true';
const shouldUseMinimalScheduleFields =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost' && !isVitestRuntime;

export const SCHEDULES_SELECT_FIELDS = joinSelect(
  shouldUseMinimalScheduleFields
    ? SCHEDULES_MINIMAL_FIELDS as readonly string[]
    : SCHEDULES_BASE_FIELDS as readonly string[]
);
