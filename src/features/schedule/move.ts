import type { Schedule } from './types';
import { getLocalDateKey } from './dateutils.local';

const combineDateTime = (dayKey: string, iso?: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const timePart = iso.includes('T') ? iso.slice(iso.indexOf('T')) : 'T00:00:00';
  if (!/^\d{4}-?\d{2}-?\d{2}$/.test(dayKey)) {
    return `${dayKey}${timePart}`;
  }
  const normalizedDay = dayKey.includes('-') ? dayKey : `${dayKey.slice(0, 4)}-${dayKey.slice(4, 6)}-${dayKey.slice(6, 8)}`;
  return `${normalizedDay}${timePart}`;
};

export function moveScheduleToDay(schedule: Schedule, dayKey: string): Schedule {
  if (!dayKey) {
    return schedule;
  }

  const nextStart = combineDateTime(dayKey, schedule.start) ?? schedule.start;
  const nextEnd = combineDateTime(dayKey, schedule.end) ?? schedule.end;

  return {
    ...schedule,
    start: nextStart,
    end: nextEnd,
    dayKey: getLocalDateKey(nextStart ?? dayKey) ?? dayKey,
  };
}
