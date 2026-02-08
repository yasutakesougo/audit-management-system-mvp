import { startOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

import { resolveSchedulesTz } from '@/utils/scheduleTz';

const DATE_DASH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_COMPACT_PATTERN = /^\d{8}$/;
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

const parseDateInput = (input: string): Date | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (OFFSET_PATTERN.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = normalizeNaiveIso(trimmed);
  const parsed = fromZonedTime(normalized, resolveSchedulesTz());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toYyyyMmDd = (value: Date): string => {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeToDayStart = (input: string | null | undefined): Date => {
  if (!input) {
    return startOfDay(new Date());
  }

  const value = input.trim();
  if (!value) {
    return startOfDay(new Date());
  }

  if (DATE_DASH_PATTERN.test(value)) {
    const parsed = parseDateInput(`${value}T00:00:00`);
    if (parsed) {
      return startOfDay(parsed);
    }
  }

  if (DATE_COMPACT_PATTERN.test(value)) {
    const yyyy = value.slice(0, 4);
    const mm = value.slice(4, 6);
    const dd = value.slice(6, 8);
    const parsed = parseDateInput(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (parsed) {
      return startOfDay(parsed);
    }
  }

  const parsed = parseDateInput(value);
  if (parsed) {
    return startOfDay(parsed);
  }

  return startOfDay(new Date());
};

export const pickDateParam = (searchParams: URLSearchParams): string | null => {
  const fromDate = searchParams.get('date');
  if (fromDate) {
    return fromDate;
  }

  const fromDay = searchParams.get('day');
  if (fromDay) {
    return fromDay;
  }

  const fromWeek = searchParams.get('week');
  if (fromWeek) {
    return fromWeek;
  }

  return null;
};

export const ensureDateParam = (
  searchParams: URLSearchParams,
  date: Date,
): URLSearchParams => {
  const next = new URLSearchParams(searchParams);
  next.set('date', toYyyyMmDd(date));
  next.delete('day');
  next.delete('week');
  return next;
};
