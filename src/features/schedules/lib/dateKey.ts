// TZ-aware date key helper for schedules
// Ensures "today" label respects the configured timezone, not UTC
import { get } from '@/env';

export const getSchedulesTz = (): string =>
  get('VITE_SCHEDULES_TZ', 'Asia/Tokyo');

/** Date -> "YYYY-MM-DD" in schedules timezone */
export const toDateKey = (date: Date): string => {
  const tz = getSchedulesTz();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};
