import type { SpFieldDef } from '@/lib/sp/types';

/**
 * 1. Schedules Field Candidates
 */
export const SCHEDULE_CANDIDATES = {
  title: ['Title'],
  start: ['EventDate', 'Start', 'StartDate', 'StartTime', 'Begin', 'Date', 'date'],
  end: ['EndDate', 'End', 'EndDate', 'EndDateTime', 'EndTime', 'Finish', 'Date', 'date'],
  status: ['Status', 'cr014_status'],
  statusReason: ['StatusReason', 'cr014_statusReason'],
  serviceType: ['ServiceType', 'Category', 'cr014_serviceType'],
  category: ['cr014_category', 'Category', 'PersonType', 'cr014_personType'],
  userId: ['TargetUserId', 'UserCode', 'cr013_usercode', 'cr013_personId', 'UserId', 'UserID'],
  userName: ['cr014_personName', 'UserName', 'PersonName'],
  userLookupId: ['TargetUser', 'UserLookup'],
  assignedStaffId: ['AssignedStaffId', 'cr014_staffIds'],
  assignedStaff: ['AssignedStaff'],
  locationName: ['LocationName', 'Location', 'cr014_locationName'],
  notes: ['Note', 'Notes', 'cr014_note'],
  vehicleId: ['VehicleId', 'cr014_vehicleId'],
  vehicle: ['Vehicle'],
  acceptedOn: ['AcceptedOn', 'cr014_acceptedOn'],
  acceptedBy: ['AcceptedBy', 'AcceptedById', 'cr014_acceptedBy'],
  acceptedNote: ['AcceptedNote', 'cr014_acceptedNote'],
  entryHash: ['EntryHash', 'cr014_entryHash'],
  ownerUserId: ['OwnerUserId', 'cr014_ownerUserId'],
  visibility: ['Visibility', 'cr014_visibility'],
  rowKey: ['RowKey', 'cr014_rowKey'],
  dayKey: ['cr014_dayKey', 'DayKey'],
  monthKey: ['MonthKey', 'cr014_monthKey'],
  fiscalYear: ['cr014_fiscalYear', 'FiscalYear'],
  orgAudience: ['cr014_orgAudience', 'OrgAudience'],
  subType: ['SubType', 'cr014_subType'],
} as const;

export const SCHEDULE_ESSENTIALS: (keyof typeof SCHEDULE_CANDIDATES)[] = [
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

/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_START = SCHEDULE_CANDIDATES.start[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_END = SCHEDULE_CANDIDATES.end[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_STATUS = SCHEDULE_CANDIDATES.status[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_SERVICE_TYPE = SCHEDULE_CANDIDATES.serviceType[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_TARGET_USER_ID = SCHEDULE_CANDIDATES.userId[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_ASSIGNED_STAFF_ID = SCHEDULE_CANDIDATES.assignedStaffId[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_NOTE = SCHEDULE_CANDIDATES.notes[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_ROW_KEY = SCHEDULE_CANDIDATES.rowKey[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_DAY_KEY = SCHEDULE_CANDIDATES.dayKey[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_MONTH_KEY = SCHEDULE_CANDIDATES.monthKey[0];
/** @deprecated Use SCHEDULE_CANDIDATES or dynamic resolution */
export const SCHEDULE_FIELD_FISCAL_YEAR = SCHEDULE_CANDIDATES.fiscalYear[0];

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
export const SCHEDULE_FIELD_SUB_TYPE = 'SubType';
export const SCHEDULE_FIELD_TARGET_USER = 'TargetUser';
export const SCHEDULE_FIELD_UPDATED_AT = 'Modified';

/** @deprecated Use dynamic resolution results instead */
export const SCHEDULES_FIELD_MAP = {
  id: 'Id',
  title: 'Title',
  start: SCHEDULE_FIELD_START,
  end: SCHEDULE_FIELD_END,
  status: SCHEDULE_FIELD_STATUS,
  userId: SCHEDULE_FIELD_TARGET_USER_ID,
  assignedStaffId: SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
  notes: SCHEDULE_FIELD_NOTE,
  rowKey: SCHEDULE_FIELD_ROW_KEY,
  dayKey: SCHEDULE_FIELD_DAY_KEY,
  monthKey: SCHEDULE_FIELD_MONTH_KEY,
  fiscalYear: SCHEDULE_FIELD_FISCAL_YEAR,
} as const;

export const SCHEDULES_BASE_FIELDS = ['Id', 'Title', SCHEDULE_FIELD_START, SCHEDULE_FIELD_END];
export const SCHEDULES_MINIMAL_FIELDS = SCHEDULES_BASE_FIELDS;
export const SCHEDULES_COMMON_OPTIONAL_FIELDS = [SCHEDULE_FIELD_STATUS, SCHEDULE_FIELD_TARGET_USER_ID, SCHEDULE_FIELD_ASSIGNED_STAFF_ID];
export const SCHEDULES_DEVELOPMENT_OPTIONAL_FIELDS = [SCHEDULE_FIELD_ROW_KEY, SCHEDULE_FIELD_DAY_KEY];
export const SCHEDULES_SELECT_FIELDS = [...SCHEDULES_BASE_FIELDS, ...SCHEDULES_COMMON_OPTIONAL_FIELDS];
export const SCHEDULES_STAFF_TEXT_FIELDS = [SCHEDULE_FIELD_ASSIGNED_STAFF_ID];

export type { SpScheduleRow as ScheduleRow } from '@/features/schedules/data/spRowSchema';
