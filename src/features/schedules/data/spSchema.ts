import { SCHEDULE_FIELD_TARGET_USER_ID } from '@/sharepoint/fields';
import { readEnv } from '@/lib/env';

// Centralized SharePoint schema constants for schedules.
// Update these values (or the corresponding env vars) once the SP list is rebuilt.
export const SCHEDULES_LIST_TITLE = (() => {
  const preferred = readEnv('VITE_SCHEDULES_LIST_TITLE', '').trim();
  if (preferred) return preferred;

  const legacy = readEnv('VITE_SP_LIST_SCHEDULES', 'Schedules').trim();
  return legacy || 'Schedules';
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
  legacyServiceType: 'cr014_serviceType',
  start: 'Start',
  end: 'End',
  status: 'Status',
  notes: 'Notes',
  entryHash: 'EntryHash',
  targetUserId: SCHEDULE_FIELD_TARGET_USER_ID,
  legacyUserCode: 'UserCode',
  locationName: 'LocationName',
  assignedStaff: 'AssignedStaff',
  vehicle: 'Vehicle',
  acceptedOn: 'AcceptedOn',
  acceptedBy: 'AcceptedBy',
  acceptedNote: 'AcceptedNote',
  // Phase 1: owner/visibility/status support
  ownerUserId: 'OwnerUserId',
  visibility: 'Visibility',
} as const;

export type SchedulesFieldKey = keyof typeof SCHEDULES_FIELDS;

// Phase 1 defaults for owner/visibility
export type ScheduleVisibility = 'org' | 'team' | 'private';

export const DEFAULT_SCHEDULE_VISIBILITY: ScheduleVisibility = 'org';

// Special value resolved at runtime to current user's staffCode
export const OWNER_USER_ID_ME = 'staff:me';
