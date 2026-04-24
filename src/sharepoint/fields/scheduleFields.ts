import type { SpFieldDef } from '@/lib/sp/types';

/**
 * 1. Schedules Field Candidates
 */
/**
 * schedule_events リストのフィールド解決候補マップ (Drift Resistance)
 */
export const SCHEDULE_EVENTS_CANDIDATES = {
  title: ['Title'],
  start: ['EventDate', 'Start', 'StartDate', 'StartTime', 'Begin', 'Date', 'date'],
  end: ['EndDate', 'End', 'EndDate', 'EndDateTime', 'EndTime', 'Finish', 'Date', 'date'],
  status: ['Status', 'cr014_status'],
  serviceType: ['ServiceType', 'Category', 'cr014_serviceType'],
  userId: ['TargetUserId', 'TargetUser', 'UserCode', 'cr013_usercode', 'cr013_personId', 'UserId', 'UserID'],
  userName: ['cr014_personName', 'UserName', 'PersonName'],
  assignedStaffId: ['AssignedStaffId', 'AssignedTo', 'AssignedStaff', 'cr014_staffIds'],
  locationName: ['LocationName', 'Location', 'cr014_locationName'],
  notes: ['Note', 'Notes', 'cr014_note'],
  rowKey: ['RowKey', 'cr014_rowKey'],
  dayKey: ['cr014_dayKey', 'DayKey'],
  monthKey: ['MonthKey', 'cr014_monthKey'],
  fiscalYear: ['cr014_fiscalYear', 'FiscalYear'],
  vehicleId: ['VehicleId', 'cr014_vehicleId', 'Vehicle', 'CarId'],
  visibility: ['Visibility', 'cr014_visibility', 'AccessLevel'],
  statusReason: ['StatusReason', 'Status_x0020_Reason', 'Reason', 'cr014_statusReason'],
  acceptedOn: ['AcceptedOn', 'Accepted_x0020_On', 'AcceptedDate', 'cr014_acceptedOn'],
  acceptedBy: ['AcceptedBy', 'Accepted_x0020_By', 'AcceptedStaff', 'cr014_acceptedBy'],
  acceptedNote: ['AcceptedNote', 'Accepted_x0020_Note', 'AcceptanceNote', 'cr014_acceptedNote'],
  category: ['Category', 'cr014_category', 'PersonType'],
} as const;

/**
 * 予定表の「拡張」フィールド（存在すれば使用するが、無くても警告バッチを出さないもの）
 */
export const SCHEDULE_EXTENSIONS = {
  orgAudience: ['cr014_orgAudience', 'OrgAudience'],
} as const;

export const SCHEDULE_EVENTS_ESSENTIALS: (keyof typeof SCHEDULE_EVENTS_CANDIDATES)[] = [
  'title', 'start', 'end'
];

/**
 * 2. Schedules Provisioning Definition
 */
export const SCHEDULE_ENSURE_FIELDS: SpFieldDef[] = [
  { internalName: 'EventDate', type: 'DateTime', displayName: 'Start Time', required: true, dateTimeFormat: 'DateTime' },
  { internalName: 'EndDate', type: 'DateTime', displayName: 'End Time', required: true, dateTimeFormat: 'DateTime' },
  { internalName: 'Status', type: 'Choice', displayName: 'Status', choices: ['Planned', 'Postponed', 'Cancelled'] },
  { internalName: 'ServiceType', type: 'Text', displayName: 'Service Type' },
  { internalName: 'TargetUserId', type: 'Text', displayName: 'User ID' },
  { internalName: 'AssignedStaffId', type: 'Text', displayName: 'Staff ID' },
  { internalName: 'RowKey', type: 'Text', displayName: 'Row Key' },
  { internalName: 'Note', type: 'Note', displayName: 'Note' },
  { internalName: 'Visibility', type: 'Choice', displayName: 'Visibility', choices: ['org', 'team', 'private'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Legacy Compatibility (for index.ts / FIELD_MAP)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_START = SCHEDULE_EVENTS_CANDIDATES.start[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_END = SCHEDULE_EVENTS_CANDIDATES.end[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_STATUS = SCHEDULE_EVENTS_CANDIDATES.status[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_SERVICE_TYPE = SCHEDULE_EVENTS_CANDIDATES.serviceType[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_TARGET_USER_ID = SCHEDULE_EVENTS_CANDIDATES.userId[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_ASSIGNED_STAFF_ID = SCHEDULE_EVENTS_CANDIDATES.assignedStaffId[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_NOTE = SCHEDULE_EVENTS_CANDIDATES.notes[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_ROW_KEY = SCHEDULE_EVENTS_CANDIDATES.rowKey[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_DAY_KEY = SCHEDULE_EVENTS_CANDIDATES.dayKey[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_MONTH_KEY = SCHEDULE_EVENTS_CANDIDATES.monthKey[0];
/** @deprecated Use SCHEDULE_EVENTS_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_FISCAL_YEAR = SCHEDULE_EVENTS_CANDIDATES.fiscalYear[0];

// Additional constants common in index.ts
export const SCHEDULE_FIELD_ASSIGNED_STAFF = 'AssignedStaff';
export const SCHEDULE_FIELD_BILLING_FLAGS = 'cr014_billingFlags';
export const SCHEDULE_FIELD_CATEGORY = 'Category';
export const SCHEDULE_FIELD_CREATED_AT = 'Created';
export const SCHEDULE_FIELD_DAY_PART = 'cr014_dayPart';
export const SCHEDULE_FIELD_ENTRY_HASH = 'EntryHash';
export const SCHEDULE_FIELD_EXTERNAL_CONTACT = 'ExternalContact';
export const SCHEDULE_FIELD_EXTERNAL_NAME = 'ExternalName';
export const SCHEDULE_FIELD_EXTERNAL_ORG = 'ExternalOrg';
export const SCHEDULE_FIELD_ORG_AUDIENCE = 'OrgAudience';
export const SCHEDULE_FIELD_ORG_EXTERNAL_NAME = 'OrgExternalName';
export const SCHEDULE_FIELD_ORG_RESOURCE_ID = 'OrgResourceId';
export const SCHEDULE_FIELD_PERSON_ID = 'UserCode';
export const SCHEDULE_FIELD_PERSON_NAME = 'PersonName';
export const SCHEDULE_FIELD_PERSON_TYPE = 'PersonType';
export const SCHEDULE_FIELD_RELATED_RESOURCE = 'RelatedResource';
export const SCHEDULE_FIELD_RELATED_RESOURCE_ID = 'RelatedResourceId';
export const SCHEDULE_FIELD_STAFF_IDS = 'cr014_staffIds';
export const SCHEDULE_FIELD_STAFF_NAMES = 'cr014_staffNames';
export const SCHEDULE_FIELD_CR014_PERSON_TYPE = 'cr014_personType';
export const SCHEDULE_FIELD_CR014_PERSON_ID = 'cr014_personId';
export const SCHEDULE_FIELD_SUB_TYPE = 'SubType';
export const SCHEDULE_FIELD_TARGET_USER = 'TargetUser';
export const SCHEDULE_FIELD_UPDATED_AT = 'Modified';

/** @deprecated Use dynamic resolution results instead */
export const SCHEDULES_FIELD_MAP = {
  id: 'Id',
  title: 'Title',
  start: SCHEDULE_EVENTS_CANDIDATES.start[0],
  end: SCHEDULE_EVENTS_CANDIDATES.end[0],
  status: SCHEDULE_EVENTS_CANDIDATES.status[0],
  userId: SCHEDULE_EVENTS_CANDIDATES.userId[0],
  assignedStaffId: SCHEDULE_EVENTS_CANDIDATES.assignedStaffId[0],
  notes: SCHEDULE_EVENTS_CANDIDATES.notes[0],
  rowKey: SCHEDULE_EVENTS_CANDIDATES.rowKey[0],
  dayKey: SCHEDULE_EVENTS_CANDIDATES.dayKey[0],
  monthKey: SCHEDULE_EVENTS_CANDIDATES.monthKey[0],
  fiscalYear: SCHEDULE_EVENTS_CANDIDATES.fiscalYear[0],
} as const;

export const SCHEDULES_BASE_FIELDS = ['Id', 'Title', SCHEDULE_FIELD_START, SCHEDULE_FIELD_END];
export const SCHEDULES_MINIMAL_FIELDS = SCHEDULES_BASE_FIELDS;
export const SCHEDULES_COMMON_OPTIONAL_FIELDS = [SCHEDULE_FIELD_STATUS, SCHEDULE_FIELD_TARGET_USER_ID, SCHEDULE_FIELD_ASSIGNED_STAFF_ID];
export const SCHEDULES_DEVELOPMENT_OPTIONAL_FIELDS = [SCHEDULE_FIELD_ROW_KEY, SCHEDULE_FIELD_DAY_KEY];
export const SCHEDULES_SELECT_FIELDS = [...SCHEDULES_BASE_FIELDS, ...SCHEDULES_COMMON_OPTIONAL_FIELDS];
export const SCHEDULES_STAFF_TEXT_FIELDS = [SCHEDULE_FIELD_ASSIGNED_STAFF_ID];

export type { SpScheduleRow as ScheduleRow } from '@/features/schedules/data/spRowSchema';
