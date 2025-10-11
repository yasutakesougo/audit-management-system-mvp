import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getAppConfig } from '@/lib/env';
import { resolveSchedulesTz, assertValidTz } from '@/utils/scheduleTz';

const DEFAULT_WEEK_START = 1; // Monday

const toDate = (input: Date | string): Date =>
  input instanceof Date ? new Date(input.getTime()) : new Date(input);

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

const resolveTz = (override?: string): string => {
  const base = resolveSchedulesTz();
  return override ? assertValidTz(override, base) : base;
};

const normalizeWeekIndex = (value: number): number => ((value % 7) + 7) % 7;

const clampWeekStartValue = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_WEEK_START;
  const normalized = Math.trunc(value);
  if (normalized < 0 || normalized > 6) return DEFAULT_WEEK_START;
  return normalized;
};

const resolveWeekStart = (override?: number): number => {
  if (override !== undefined) {
    return clampWeekStartValue(override);
  }
  const config = getAppConfig();
  return clampWeekStartValue(config.schedulesWeekStart);
};

function ymdInTz(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

function localWallClockToUtc(ymd: string, time: string, tz: string): Date {
  return fromZonedTime(`${ymd}T${time}`, tz);
}

function shiftYmd(ymd: string, deltaDays: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const shifted = addDays(base, deltaDays);
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getLocalDateKey(input: Date | string, timeZone?: string): string {
  const date = toDate(input);
  if (!isValidDate(date)) {
    return '';
  }
  const tz = resolveTz(timeZone);
  return ymdInTz(date, tz);
}

export function startOfDayUtc(input: Date | string, timeZone?: string): Date {
  const date = toDate(input);
  if (!isValidDate(date)) {
    return new Date(0);
  }
  const tz = resolveTz(timeZone);
  const ymd = ymdInTz(date, tz);
  const utc = localWallClockToUtc(ymd, '00:00:00.000', tz);
  return isValidDate(utc) ? utc : new Date(0);
}

export function endOfDayUtc(input: Date | string, timeZone?: string): Date {
  const date = toDate(input);
  if (!isValidDate(date)) {
    return new Date(0);
  }
  const tz = resolveTz(timeZone);
  const ymd = ymdInTz(date, tz);
  const utc = localWallClockToUtc(ymd, '23:59:59.999', tz);
  return isValidDate(utc) ? utc : new Date(0);
}

export function startOfWeekUtc(input: Date | string, timeZone?: string, weekStartsOn = DEFAULT_WEEK_START): Date {
  const date = toDate(input);
  if (!isValidDate(date)) {
    return new Date(0);
  }
  const tz = resolveTz(timeZone);
  const resolvedWeekStart = resolveWeekStart(weekStartsOn);
  const isoDay = Number(formatInTimeZone(date, tz, 'i')); // 1 (Mon) .. 7 (Sun)
  const dayIndex = normalizeWeekIndex(isoDay);
  const startIndex = normalizeWeekIndex(resolvedWeekStart);
  const deltaBack = -normalizeWeekIndex(dayIndex - startIndex);
  const todayYmd = ymdInTz(date, tz);
  const startYmd = shiftYmd(todayYmd, deltaBack);
  const utc = localWallClockToUtc(startYmd, '00:00:00.000', tz);
  return isValidDate(utc) ? utc : new Date(0);
}

export function endOfWeekUtc(input: Date | string, timeZone?: string, weekStartsOn = DEFAULT_WEEK_START): Date {
  const tz = resolveTz(timeZone);
  const resolvedWeekStart = resolveWeekStart(weekStartsOn);
  const start = startOfWeekUtc(input, tz, resolvedWeekStart);
  if (!isValidDate(start)) {
    return new Date(0);
  }
  const startYmd = ymdInTz(start, tz);
  const endYmd = shiftYmd(startYmd, 6);
  const utc = localWallClockToUtc(endYmd, '23:59:59.999', tz);
  return isValidDate(utc) ? utc : new Date(0);
}

export function startOfDay(input: Date | string, timeZone?: string): Date {
  return startOfDayUtc(input, timeZone);
}

export function endOfDay(input: Date | string, timeZone?: string): Date {
  return endOfDayUtc(input, timeZone);
}

export function assignLocalDateKey<T extends {
  start?: string | null;
  end?: string | null;
  startLocal?: string | null;
  endLocal?: string | null;
}>(item: T, timeZone?: string): T & {
  localDateKey: string;
} {
  const candidate = item.startLocal ?? item.start ?? item.endLocal ?? item.end ?? '';
  const key = candidate ? getLocalDateKey(candidate, timeZone) : '';
  return {
    ...item,
    localDateKey: key,
  };
}
