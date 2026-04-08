import { fromZonedTime } from 'date-fns-tz';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import type { CreateScheduleEventInput } from './port';
import { SCHEDULES_FIELDS } from './spSchema';

export type SharePointPayloadResult = {
  body: Record<string, unknown>;
  startIso: string;
  endIso: string;
};

/** Normalize a userId string by stripping hyphens. */
export const normalizeUserId = (id: string): string => id.replace(/-/g, '');

/** Convert a schedule input to a SharePoint payload. */
export const toSharePointPayload = (input: CreateScheduleEventInput): SharePointPayloadResult => {
  const tz = resolveSchedulesTz();
  const startIso = fromZonedTime(input.startLocal, tz).toISOString();
  const endIso = fromZonedTime(input.endLocal, tz).toISOString();

  const body: Record<string, unknown> = {
    [SCHEDULES_FIELDS.start]: startIso,
    [SCHEDULES_FIELDS.end]: endIso,
    [SCHEDULES_FIELDS.title]: input.title,
    [SCHEDULES_FIELDS.serviceType]: input.serviceType,
  };

  if (input.category === 'Staff') {
    body[SCHEDULES_FIELDS.assignedStaff] = input.assignedStaffId;
  } else if (input.category === 'User') {
    body[SCHEDULES_FIELDS.targetUserId] = input.userLookupId;
    body[SCHEDULES_FIELDS.assignedStaff] = null;
  } else if (input.category === 'Org') {
    body[SCHEDULES_FIELDS.targetUserId] = null;
  }

  return {
    body,
    startIso,
    endIso,
  };
};
