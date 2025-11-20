import { overlapsWeek, type EventRange, type WeekISO } from '@/features/schedule/range';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { describe, expect, it } from 'vitest';

dayjs.extend(utc);

const startOfWeek = (base = dayjs()) => base.startOf('week').add(1, 'day');
const endOfWeek = (start: dayjs.Dayjs) => start.endOf('week');

describe('schedule range (EventDate/EndDate)', () => {
  const anchor = startOfWeek(dayjs.utc('2025-11-10T00:00:00Z'));
  const week: WeekISO = {
    fromISO: anchor.toISOString(),
    toISO: endOfWeek(anchor).toISOString(),
  };

  it('includes events fully inside the week', () => {
    const event: EventRange = {
      eventDate: '2025-11-12T09:00:00Z',
      endDate: '2025-11-12T10:00:00Z',
    };
    expect(overlapsWeek(event, week)).toBe(true);
  });

  it('includes events that start before the week and end during the week', () => {
    const event: EventRange = {
      eventDate: '2025-11-09T23:00:00Z',
      endDate: '2025-11-10T01:00:00Z',
    };
    expect(overlapsWeek(event, week)).toBe(true);
  });

  it('includes events that start during the week and end after the week', () => {
    const event: EventRange = {
      eventDate: '2025-11-15T23:00:00Z',
      endDate: '2025-11-16T01:00:00Z',
    };
    expect(overlapsWeek(event, week)).toBe(true);
  });

  it('excludes events that are strictly before the week', () => {
    const event: EventRange = {
      eventDate: '2025-11-09T09:00:00Z',
      endDate: '2025-11-09T10:00:00Z',
    };
    expect(overlapsWeek(event, week)).toBe(false);
  });

  it('excludes events that are strictly after the week', () => {
    const event: EventRange = {
      eventDate: '2025-11-18T09:00:00Z',
      endDate: '2025-11-18T10:00:00Z',
    };
    expect(overlapsWeek(event, week)).toBe(false);
  });

  it('treats multi-day all-day events as overlapping if any portion touches the week', () => {
    const event: EventRange = {
      eventDate: '2025-11-08T00:00:00Z',
      endDate: '2025-11-12T00:00:00Z',
      allDay: true,
    };
    expect(overlapsWeek(event, week)).toBe(true);
  });

  it('excludes events that end exactly at the week start boundary', () => {
    const event: EventRange = {
      eventDate: '2025-11-09T08:00:00Z',
      endDate: week.fromISO,
    };
    expect(overlapsWeek(event, week)).toBe(false);
  });
});
