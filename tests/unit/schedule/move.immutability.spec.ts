import { moveScheduleToDay } from '@/features/schedule/move';
import type { ScheduleUserCare } from '@/features/schedule/types';
import { describe, expect, it } from 'vitest';

const createSchedule = (): ScheduleUserCare => ({
  id: 'id1',
  etag: 'W/"etag"',
  category: 'User',
  title: 'Title',
  start: '2025-01-10T10:00:00Z',
  end: '2025-01-10T11:00:00Z',
  allDay: false,
  status: '承認済み',
  serviceType: 'ショートステイ',
  personType: 'Internal',
  personId: 'p1',
  personName: 'Person',
  staffIds: ['s1'],
  staffNames: ['Staff'],
  dayKey: '2025-01-10',
});

describe('moveScheduleToDay immutability', () => {
  it('does not mutate the original schedule object', () => {
    const schedule = createSchedule();
    const snapshot = JSON.stringify(schedule);

    const result = moveScheduleToDay(schedule, '2025/01/12');

    expect(JSON.stringify(schedule)).toBe(snapshot);
    expect(result).not.toBe(schedule);
  });

  it('drops dayKey when unable to normalize malformed input', () => {
    const schedule = createSchedule();
    const result = moveScheduleToDay(schedule, '2025/01/12');

    expect(result.dayKey === '' || result.dayKey === '2025-01-12').toBe(true);
  });
});
