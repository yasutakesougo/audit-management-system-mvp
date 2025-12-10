import {
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_TARGET_USER_ID,
} from '@/sharepoint/fields';
import { readEnv } from '@/lib/env';

// Centralized SharePoint schema constants for schedules.
// Update these values (or the corresponding env vars) once the SP list is rebuilt.
export const SCHEDULES_LIST_TITLE = (() => {
  const configured = readEnv('VITE_SP_LIST_SCHEDULES', 'Schedules').trim();
  return configured || 'Schedules';
})();

const normalizeGuid = (raw: string): string => raw.replace(/^guid:/i, '').replace(/[{}]/g, '').trim();

export const resolveSchedulesListIdentifier = (): { type: 'guid' | 'title'; value: string } => {
  const trimmed = SCHEDULES_LIST_TITLE.trim();
  const guid = normalizeGuid(trimmed);
  if (/^[0-9a-fA-F-]{36}$/.test(guid)) {
    return { type: 'guid', value: guid };
  }
  return { type: 'title', value: trimmed || 'Schedules' };
};

export const buildSchedulesListPath = (baseUrl: string): string => {
  const identifier = resolveSchedulesListIdentifier();
  if (identifier.type === 'guid') {
    return `${baseUrl}/lists(guid'${identifier.value}')/items`;
  }
  const escaped = identifier.value.replace(/'/g, "''");
  return `${baseUrl}/lists/getbytitle('${escaped}')/items`;
};

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
  acceptedOn: 'AcceptedOn',
  acceptedBy: 'AcceptedBy',
  acceptedNote: 'AcceptedNote',
} as const;

export type SchedulesFieldKey = keyof typeof SCHEDULES_FIELDS;
