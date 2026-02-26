// TZ-aware date key helper for schedules
// Ensures "today" label respects the configured timezone, not UTC

export const getSchedulesTz = (): string =>
  (window.__ENV__?.VITE_SCHEDULES_TZ as string) ?? 'Asia/Tokyo';

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
