import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { resolveSchedulesTz } from '@/utils/scheduleTz';
import type { SchedItem } from '@/features/schedules/data';

const OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const normalizeNaiveIso = (value: string): string => {
  if (!value.includes('T')) {
    return `${value}T00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
};

/**
 * Parse various date-like values to Date.
 * Safely handles: Date, string (ISO/naive), number (epoch ms), null/undefined, and unknown types.
 */
const parseDateLike = (value: unknown, tz: string): Date | null => {
  // null/undefined
  if (value == null) {
    return null;
  }

  // Date instance
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value : null;
  }

  // epoch milliseconds (number)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // ISO string or naive string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = OFFSET_PATTERN.test(trimmed)
      ? new Date(trimmed)
      : fromZonedTime(normalizeNaiveIso(trimmed), tz);

    return Number.isFinite(date.getTime()) ? date : null;
  }

  // Reject all other types
  return null;
};

const parseDateOnly = (isoDate: string, tz: string): Date | null => {
  if (!isoDate) return null;
  return parseDateLike(`${isoDate}T00:00:00`, tz);
};

const isMidnightInTz = (date: Date, tz: string): boolean => {
  return formatInTimeZone(date, tz, 'HH:mm:ss') === '00:00:00';
};

export const toScheduleDateKey = (
  value: unknown,
  tz: string = resolveSchedulesTz(),
): string => {
  if (!value) return '';
  const parsed = parseDateLike(value, tz);
  if (!parsed) return '';
  return formatInTimeZone(parsed, tz, 'yyyy-MM-dd');
};

export const expandItemToDateKeys = (
  item: Pick<SchedItem, 'start' | 'end'>,
  tz: string = resolveSchedulesTz(),
): string[] => {
  const startDate = parseDateLike(item.start, tz);
  if (!startDate) return [];
  const startKey = toScheduleDateKey(startDate, tz);

  const rawEnd = item.end ?? item.start;
  const endDateRaw = parseDateLike(rawEnd, tz);
  if (!endDateRaw) return [startKey];

  const endDate = endDateRaw;
  const endKeyRaw = toScheduleDateKey(endDate, tz);
  if (endKeyRaw && endKeyRaw !== startKey && isMidnightInTz(endDate, tz)) {
    endDate.setDate(endDate.getDate() - 1);
  }

  const endKey = toScheduleDateKey(endDate, tz);
  if (!endKey) return [startKey];

  const cursor = parseDateOnly(startKey, tz);
  const endCursor = parseDateOnly(endKey, tz);
  if (!cursor || !endCursor) return [startKey];
  if (endCursor < cursor) return [startKey];

  const keys: string[] = [];
  const current = new Date(cursor);
  while (current <= endCursor) {
    keys.push(formatInTimeZone(current, tz, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }

  return keys;
};
