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

/** Normalize a userId string by stripping hyphens. */
export const normalizeUserId = (id: string): string => id.replace(/-/g, '');

/** Convert a schedule input to a SharePoint payload (stub). */
export const toSharePointPayload = (_input: CreateScheduleEventInput): SharePointPayloadResult => ({
  body: {},
  startIso: '',
  endIso: '',
});
