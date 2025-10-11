import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  endOfDayUtc,
  endOfWeekUtc,
  startOfDayUtc,
  startOfWeekUtc,
} from '@/features/schedule/dateutils.local';
import { __resetAppConfigForTests } from '@/lib/env';

const ORIGINAL_TZ = process.env.VITE_SCHEDULES_TZ;
const ORIGINAL_WEEK_START = process.env.VITE_SCHEDULES_WEEK_START;

const restoreEnv = () => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.VITE_SCHEDULES_TZ;
  } else {
    process.env.VITE_SCHEDULES_TZ = ORIGINAL_TZ;
  }

  if (ORIGINAL_WEEK_START === undefined) {
    delete process.env.VITE_SCHEDULES_WEEK_START;
  } else {
    process.env.VITE_SCHEDULES_WEEK_START = ORIGINAL_WEEK_START;
  }
};

beforeEach(() => {
  process.env.VITE_SCHEDULES_TZ = 'Asia/Tokyo';
  process.env.VITE_SCHEDULES_WEEK_START = '1';
  __resetAppConfigForTests();
});

afterEach(() => {
  restoreEnv();
  __resetAppConfigForTests();
});

describe('dateutils.local (extended boundaries)', () => {
  it('handles month/year boundaries in Asia/Tokyo', () => {
    const tz = 'Asia/Tokyo';
    const inputs = [
      new Date('2024-12-31T12:00:00+09:00'),
      new Date('2025-01-01T10:00:00+09:00'),
      new Date('2025-02-29T08:00:00+09:00'),
    ];

    for (const date of inputs) {
      const start = startOfWeekUtc(date, tz).toISOString();
      const end = endOfWeekUtc(date, tz).toISOString();
      expect(start.endsWith('T15:00:00.000Z')).toBe(true);
      expect(end.endsWith('T14:59:59.999Z')).toBe(true);
    }
  });

  it('respects VITE_SCHEDULES_WEEK_START when omitted in calls', () => {
    process.env.VITE_SCHEDULES_WEEK_START = '2'; // Tuesday
    __resetAppConfigForTests();
    const tz = 'Asia/Tokyo';
    const date = new Date('2025-06-05T12:00:00+09:00');
    const start = startOfWeekUtc(date, tz).toISOString();
    const end = endOfWeekUtc(date, tz).toISOString();
    expect(start.endsWith('T15:00:00.000Z')).toBe(true);
    expect(end.endsWith('T14:59:59.999Z')).toBe(true);
  });

  it('handles DST forward transition in America/Los_Angeles', () => {
    const tz = 'America/Los_Angeles';
    const input = '2025-03-09T10:15:00-08:00';
    const start = startOfDayUtc(input, tz).toISOString();
    const end = endOfDayUtc(input, tz).toISOString();
    expect(start.endsWith('Z')).toBe(true);
    expect(end.endsWith('Z')).toBe(true);
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
  });
});
