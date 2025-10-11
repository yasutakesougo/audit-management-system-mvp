import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  endOfDayUtc,
  endOfWeekUtc,
  startOfDayUtc,
  startOfWeekUtc,
} from '@/features/schedule/dateutils.local';
import { __resetAppConfigForTests } from '@/lib/env';

const tz = 'Asia/Tokyo';
const ORIGINAL_TZ = process.env.VITE_SCHEDULES_TZ;

beforeEach(() => {
  process.env.VITE_SCHEDULES_TZ = tz;
  __resetAppConfigForTests();
});

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.VITE_SCHEDULES_TZ;
  } else {
    process.env.VITE_SCHEDULES_TZ = ORIGINAL_TZ;
  }
  __resetAppConfigForTests();
});

describe('dateutils.local (TZ boundaries)', () => {
  it('startOfDayUtc uses local midnight even when UTC is previous day', () => {
    const input = new Date('2025-03-04T16:23:00.000Z');
    const start = startOfDayUtc(input, tz).toISOString();
    expect(start).toBe('2025-03-04T15:00:00.000Z');
  });

  it('endOfDayUtc hits local 23:59:59.999', () => {
    const input = new Date('2025-03-04T16:23:00.000Z');
    const end = endOfDayUtc(input, tz).toISOString();
    expect(end).toBe('2025-03-05T14:59:59.999Z');
  });

  it('start/endOfWeekUtc align with Monday-start weeks', () => {
    const input = new Date('2025-03-06T12:00:00.000Z');
    const start = startOfWeekUtc(input, tz, 1).toISOString();
    const end = endOfWeekUtc(input, tz, 1).toISOString();
    expect(start.endsWith('T15:00:00.000Z')).toBe(true);
    expect(end.endsWith('T14:59:59.999Z')).toBe(true);
  });
});
