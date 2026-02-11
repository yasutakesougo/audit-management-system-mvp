import { readEnv } from '@/lib/env';
import { SCHEDULE_FIELD_TARGET_USER_ID } from '@/sharepoint/fields';

// Centralized SharePoint schema constants for schedules.
// Resolve at runtime so window.__ENV__ overrides are respected.
export const getSchedulesListTitle = (): string => {
  const preferred = readEnv('VITE_SCHEDULES_LIST_TITLE', '').trim();
  if (preferred) return preferred;

  const legacy = readEnv('VITE_SP_LIST_SCHEDULES', '').trim();
  if (legacy) return legacy;

  return 'ScheduleEvents';
};

const normalizeGuid = (raw: string): string => raw.replace(/^guid:/i, '').replace(/[{}]/g, '').trim();

export const resolveSchedulesListIdentifier = (): { type: 'guid' | 'title'; value: string } => {
  const trimmed = getSchedulesListTitle().trim();
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
  serviceType: 'Category',  // ScheduleEvents uses Category field
  legacyServiceType: 'cr014_serviceType',
  start: 'EventDate',  // Event list uses EventDate
  end: 'EndDate',      // Event list uses EndDate
  status: 'Status',
  notes: 'Notes',
  entryHash: 'EntryHash',
  targetUserId: SCHEDULE_FIELD_TARGET_USER_ID,
  legacyUserCode: 'UserCode',
  locationName: 'Location',  // Event list uses Location
  assignedStaff: 'AssignedStaffId',
  vehicle: 'VehicleId',
  acceptedOn: 'AcceptedOn',
  acceptedBy: 'AcceptedById',
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
