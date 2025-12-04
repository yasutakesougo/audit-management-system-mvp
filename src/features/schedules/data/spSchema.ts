import {
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_TARGET_USER_ID,
} from '@/sharepoint/fields';

// Centralized SharePoint schema constants for schedules.
// Update these values (or the corresponding env vars) once the SP list is rebuilt.
export const SCHEDULES_LIST_TITLE =
  (import.meta.env.VITE_SP_LIST_SCHEDULES ?? 'Schedules').trim() || 'Schedules';

export const SCHEDULES_FIELDS = {
  title: 'Title',
  serviceType: 'ServiceType',
  start: 'Start',
  end: 'End',
  status: 'Status',
  notes: 'Notes',
  entryHash: 'EntryHash',
  personId: SCHEDULE_FIELD_PERSON_ID,
  personName: SCHEDULE_FIELD_PERSON_NAME,
  targetUserId: SCHEDULE_FIELD_TARGET_USER_ID,
  legacyUserCode: 'UserCode',
  legacyCrUserCode: 'cr014_usercode',
  locationName: 'LocationName',
  assignedStaff: 'AssignedStaff',
  vehicle: 'Vehicle',
} as const;

export type SchedulesFieldKey = keyof typeof SCHEDULES_FIELDS;
