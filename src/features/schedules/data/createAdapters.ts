/**
 * createAdapters.ts — compat stub
 *
 * This module was removed in the data-os refactor.
 * Stub retained for backward-compat with test files.
 */

import type { CreateScheduleEventInput } from './port';

export type SharePointPayloadResult = {
  body: Record<string, unknown>;
  startIso: string;
  endIso: string;
};

import { fromZonedTime } from 'date-fns-tz';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import { SCHEDULES_FIELDS } from './spSchema';

/** Normalize a userId string by stripping hyphens. */
export const normalizeUserId = (id: string): string => id.replace(/-/g, '');

/** Convert a schedule input to a SharePoint payload (stub for test compatibility). */
export const toSharePointPayload = (input: CreateScheduleEventInput): SharePointPayloadResult => {
  const body: Record<string, unknown> = {};

  if (input.category === 'Staff') {
    body[SCHEDULES_FIELDS.assignedStaff] = input.assignedStaffId;
  } else if (input.category === 'User') {
    body[SCHEDULES_FIELDS.targetUserId] = input.userLookupId;
    body[SCHEDULES_FIELDS.assignedStaff] = null;
  } else {
    body[SCHEDULES_FIELDS.targetUserId] = null;
  }

  const tz = resolveSchedulesTz();
  const start = input.startLocal ? fromZonedTime(input.startLocal, tz) : null;
  const end = input.endLocal ? fromZonedTime(input.endLocal, tz) : null;

  return {
    body,
    startIso: start ? start.toISOString() : '',
    endIso: end ? end.toISOString() : '',
  };
};
