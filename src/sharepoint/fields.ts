import type { SpDailyItem, SpScheduleItem, SpStaffItem, SpUserItem } from '@/types';

// SharePoint フィールド定義（暫定安全セット）

export type UserRow = SpUserItem;
export type StaffRow = SpStaffItem;
export type ScheduleRow = SpScheduleItem;
export type DailyRow = SpDailyItem;

export interface IUserMaster {
  Id: number;
  Title?: string | null;
  UserID: string;
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag?: boolean | null;
  IsActive?: boolean | null;
  TransportToDays?: string[] | null;
  TransportFromDays?: string[] | null;
  AttendanceDays?: string[] | null;
  RecipientCertNumber?: string | null;
  RecipientCertExpiry?: string | null;
  Modified?: string | null;
  Created?: string | null;
}

export interface IUserMasterCreateDto {
  UserID: string;
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag?: boolean | null;
  IsActive?: boolean | null;
  TransportToDays?: string[] | null;
  TransportFromDays?: string[] | null;
  AttendanceDays?: string[] | null;
  RecipientCertNumber?: string | null;
  RecipientCertExpiry?: string | null;
}

export const joinSelect = (arr: readonly string[]) => arr.join(',');

export enum ListKeys {
  UsersMaster = 'Users_Master',
  StaffMaster = 'Staff_Master',
  ComplianceCheckRules = 'Compliance_CheckRules',
}

export const LIST_CONFIG: Record<ListKeys, { title: string }> = {
  [ListKeys.UsersMaster]: { title: 'Users_Master' },
  [ListKeys.StaffMaster]: { title: 'Staff_Master' },
  [ListKeys.ComplianceCheckRules]: { title: 'Compliance_CheckRules' },
};

export const FIELD_MAP = {
  Users_Master: {
    id: 'Id',
    title: 'Title',
    userId: 'UserID',
    fullName: 'FullName',
    furigana: 'Furigana',
    fullNameKana: 'FullNameKana',
    contractDate: 'ContractDate',
    serviceStartDate: 'ServiceStartDate',
    serviceEndDate: 'ServiceEndDate',
    isHighIntensitySupportTarget: 'IsHighIntensitySupportTarget',
    isSupportProcedureTarget: 'IsSupportProcedureTarget',
    severeFlag: 'severeFlag',
    isActive: 'IsActive',
    transportToDays: 'TransportToDays',
    transportFromDays: 'TransportFromDays',
    attendanceDays: 'AttendanceDays',
    recipientCertNumber: 'RecipientCertNumber',
    recipientCertExpiry: 'RecipientCertExpiry',
    modified: 'Modified',
    created: 'Created',
    // 400s or optional columns intentionally omitted for now
  },
  Staff_Master: {
    id: 'Id',
    title: 'Title',
    staffId: 'StaffID',
    fullName: 'FullName',
    furigana: 'Furigana',
    fullNameKana: 'FullNameKana',
    jobTitle: 'JobTitle',
    employmentType: 'EmploymentType',
    rbacRole: 'RBACRole',
  role: 'Role',
  isActive: 'IsActive',
    department: 'Department',
    workDaysText: 'Work_x0020_Days',
  workDays: 'WorkDays',
  baseShiftStartTime: 'BaseShiftStartTime',
  baseShiftEndTime: 'BaseShiftEndTime',
  baseWorkingDays: 'BaseWorkingDays',
    hireDate: 'HireDate',
    resignDate: 'ResignDate',
    email: 'Email',
    phone: 'Phone',
    certifications: 'Certifications',
  },
  Schedules: {
    id: 'Id',
    title: 'Title',
    start: 'StartDateTime',
    end: 'EndDateTime',
    status: 'Status',
    notes: 'Note',
    serviceType: 'ServiceType',
    staffIds: 'AssignedStaffId',
    billingFlags: 'BillingFlags',
    relatedResourceIds: 'RelatedResourceId',
    targetUserIds: 'TargetUserId',
    created: 'Created',
    modified: 'Modified',
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    rowKey: 'RowKey',
    dayKey: 'Date',
    monthKey: 'MonthKey',
  },
} as const;

export const USERS_SELECT_FIELDS_SAFE = [
  FIELD_MAP.Users_Master.id,
  FIELD_MAP.Users_Master.title,
  FIELD_MAP.Users_Master.userId,
  FIELD_MAP.Users_Master.fullName,
  FIELD_MAP.Users_Master.furigana,
  FIELD_MAP.Users_Master.fullNameKana,
  FIELD_MAP.Users_Master.contractDate,
  FIELD_MAP.Users_Master.serviceStartDate,
  FIELD_MAP.Users_Master.serviceEndDate,
  FIELD_MAP.Users_Master.isHighIntensitySupportTarget,
  FIELD_MAP.Users_Master.isSupportProcedureTarget,
  FIELD_MAP.Users_Master.severeFlag,
  FIELD_MAP.Users_Master.isActive,
  FIELD_MAP.Users_Master.transportToDays,
  FIELD_MAP.Users_Master.transportFromDays,
  FIELD_MAP.Users_Master.attendanceDays,
  FIELD_MAP.Users_Master.recipientCertNumber,
  FIELD_MAP.Users_Master.recipientCertExpiry,
  FIELD_MAP.Users_Master.modified,
  FIELD_MAP.Users_Master.created,
  // Provisioned lowercase aliases (tolerant reads)
  'furigana',
  'email',
  'phone',
  'isActive',
] as const;

export const STAFF_SELECT_FIELDS_CANONICAL = [
  FIELD_MAP.Staff_Master.id,
  FIELD_MAP.Staff_Master.title,
  FIELD_MAP.Staff_Master.staffId,
  FIELD_MAP.Staff_Master.fullName,
  FIELD_MAP.Staff_Master.jobTitle,
  FIELD_MAP.Staff_Master.employmentType,
  FIELD_MAP.Staff_Master.rbacRole,
  FIELD_MAP.Staff_Master.department,
  FIELD_MAP.Staff_Master.hireDate,
  FIELD_MAP.Staff_Master.resignDate,
  FIELD_MAP.Staff_Master.certifications,
  FIELD_MAP.Staff_Master.email,
  FIELD_MAP.Staff_Master.phone,
  FIELD_MAP.Staff_Master.furigana,
  FIELD_MAP.Staff_Master.fullNameKana,
  FIELD_MAP.Staff_Master.workDaysText,
] as const;

export const USERS_SELECT_SAFE = joinSelect(USERS_SELECT_FIELDS_SAFE as readonly string[]);
export const STAFF_SELECT = joinSelect(STAFF_SELECT_FIELDS_CANONICAL as readonly string[]);

// Backwards compatibility exports (legacy names still in use)
export const USERS_SELECT_FIELDS = USERS_SELECT_FIELDS_SAFE;

// ──────────────────────────────────────────────────────────────
// Daily record list fields
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

// ──────────────────────────────────────────────────────────────
// Schedule list fields
// ──────────────────────────────────────────────────────────────

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
