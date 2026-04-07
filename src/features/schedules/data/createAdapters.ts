import { fromZonedTime } from 'date-fns-tz';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import { SCHEDULES_FIELDS } from './spSchema';
import type { CreateScheduleEventInput } from './port';

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
  
  // Safely parse local times to ISO (UTC)
  let startIso = '';
  let endIso = '';
  try {
    const start = fromZonedTime(input.startLocal, tz);
    const end = fromZonedTime(input.endLocal, tz);
    if (Number.isFinite(start.getTime())) startIso = start.toISOString();
    if (Number.isFinite(end.getTime())) endIso = end.toISOString();
  } catch (e) {
    console.error('[createAdapters] Date parsing failed', { start: input.startLocal, end: input.endLocal, tz, error: String(e) });
  }

  const body: Record<string, unknown> = {
    [SCHEDULES_FIELDS.title]: input.title,
    [SCHEDULES_FIELDS.serviceType]: input.serviceType,
    [SCHEDULES_FIELDS.start]: startIso,
    [SCHEDULES_FIELDS.end]: endIso,
  };

  // Category-specific field handling
  if (input.category === 'User') {
    body[SCHEDULES_FIELDS.targetUserId] = input.userLookupId || null;
    body[SCHEDULES_FIELDS.assignedStaff] = null;
  } else if (input.category === 'Staff') {
    body[SCHEDULES_FIELDS.assignedStaff] = input.assignedStaffId || null;
  } else if (input.category === 'Org') {
    body[SCHEDULES_FIELDS.targetUserId] = null;
    // Note: assignedStaff is omitted (undefined) for Org category as per test expectations
  }

  return { body, startIso, endIso };
};
