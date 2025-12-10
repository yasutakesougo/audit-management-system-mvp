import dayjs from 'dayjs';

export type WeekISO = {
  fromISO: string;
  toISO: string;
};

export type EventRange = {
  eventDate: string;
  endDate: string;
  allDay?: boolean;
};

/**
 * Returns true when the given event overlaps the inclusive week window.
 * SharePoint provides local time strings, so we compare them without UTC conversion.
 */
export function overlapsWeek(event: EventRange, week: WeekISO): boolean {
  const eventStart = dayjs(event.eventDate);
  const eventEnd = dayjs(event.endDate);
  const weekStart = dayjs(week.fromISO);
  const weekEnd = dayjs(week.toISO);
  return eventStart.isBefore(weekEnd) && eventEnd.isAfter(weekStart);
}
