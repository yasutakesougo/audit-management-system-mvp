import { addDays, addWeeks, isValid, setMinutes } from 'date-fns';
import { fromZonedTime, toZonedTime } from '@/lib/tz';
import { formatRangeLocal } from '@/utils/datetime';
import type { Schedule } from '@/lib/mappers';
import { STATUS_DEFAULT } from './statusDictionary';
import type { Status } from './types';

export type CloneStrategy = 'today' | 'nextWeekday';

const TIMEZONE = 'Asia/Tokyo';
const ROUND_STEP_MINUTES = 5;
const MIN_DURATION_MINUTES = 15;

const toDateSafe = (iso?: string | null): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return isValid(date) ? date : null;
};

const pickSourceUtc = (schedule: Schedule): { start: Date | null; end: Date | null } => ({
  start: toDateSafe(schedule.startUtc ?? schedule.startLocal ?? schedule.startDate ?? ''),
  end: toDateSafe(schedule.endUtc ?? schedule.endLocal ?? schedule.endDate ?? schedule.startUtc ?? ''),
});

const roundDown = (date: Date): Date => {
  const minutes = date.getMinutes();
  const offset = minutes % ROUND_STEP_MINUTES;
  if (offset === 0) {
    date.setSeconds(0, 0);
    return date;
  }
  const adjusted = setMinutes(date, minutes - offset);
  adjusted.setSeconds(0, 0);
  return adjusted;
};

const roundUp = (date: Date): Date => {
  const minutes = date.getMinutes();
  const offset = minutes % ROUND_STEP_MINUTES;
  if (offset === 0) {
    date.setSeconds(0, 0);
    return date;
  }
  const adjusted = setMinutes(date, minutes + (ROUND_STEP_MINUTES - offset));
  adjusted.setSeconds(0, 0);
  return adjusted;
};

const ensureMinDuration = (start: Date, end: Date): Date => {
  if (end.getTime() > start.getTime()) return end;
  const adjusted = new Date(start);
  adjusted.setMinutes(start.getMinutes() + MIN_DURATION_MINUTES);
  adjusted.setSeconds(0, 0);
  return adjusted;
};

const shiftToNextWeek = (date: Date): Date => addWeeks(date, 1);

const buildAllDayRange = (strategy: CloneStrategy, originalStart: Date | null): { start: Date; end: Date } => {
  const base = strategy === 'nextWeekday' && originalStart ? shiftToNextWeek(originalStart) : toZonedTime(new Date(), TIMEZONE);
  base.setHours(0, 0, 0, 0);
  const end = addDays(base, 1);
  return { start: base, end };
};

const buildTimedRange = (
  strategy: CloneStrategy,
  originalStart: Date | null,
  originalEnd: Date | null,
): { start: Date; end: Date } => {
  const nowLocal = toZonedTime(new Date(), TIMEZONE);

  if (!originalStart || !originalEnd) {
    const start = roundDown(new Date(nowLocal));
    const end = ensureMinDuration(start, roundUp(addMinutesSafe(start, MIN_DURATION_MINUTES)));
    return { start, end };
  }

  if (strategy === 'nextWeekday') {
    const start = roundDown(new Date(shiftToNextWeek(originalStart)));
    const end = roundUp(new Date(shiftToNextWeek(originalEnd)));
    return { start, end: ensureMinDuration(start, end) };
  }

  const start = roundDown(setTimeFromTemplate(nowLocal, originalStart));
  const end = roundUp(setTimeFromTemplate(nowLocal, originalEnd));
  return { start, end: ensureMinDuration(start, end) };
};

const setTimeFromTemplate = (base: Date, template: Date): Date => {
  const result = new Date(base);
  result.setHours(template.getHours(), template.getMinutes(), 0, 0);
  return result;
};

const addMinutesSafe = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes, 0, 0);
  return result;
};

const toUtcIso = (date: Date): string => fromZonedTime(date, TIMEZONE).toISOString();

export type ScheduleCloneDraft = {
  title: string;
  location: string;
  notes: string;
  status: Status;
  _initial: {
    allDay: boolean;
    startLocalISO: string;
    endLocalISO: string;
    preview: string;
  };
};

export function buildClonedDraft(source: Schedule, strategy: CloneStrategy = 'nextWeekday'): ScheduleCloneDraft | null {
  const { start, end } = pickSourceUtc(source);
  if (!start || !end) return null;

  const startLocal = toZonedTime(start, TIMEZONE);
  const endLocal = toZonedTime(end, TIMEZONE);

  const { start: nextStart, end: nextEnd } = source.allDay
    ? buildAllDayRange(strategy, startLocal)
    : buildTimedRange(strategy, startLocal, endLocal);

  const startIso = toUtcIso(nextStart);
  const endIso = toUtcIso(nextEnd);

  return {
    title: source.title ?? '',
    location: source.location ?? '',
    notes: source.notes ?? '',
      status: STATUS_DEFAULT,
    _initial: {
      allDay: Boolean(source.allDay),
      startLocalISO: nextStart.toISOString(),
      endLocalISO: nextEnd.toISOString(),
      preview: formatRangeLocal(startIso, endIso, { roundTo: ROUND_STEP_MINUTES, tz: TIMEZONE }),
    },
  };
}
