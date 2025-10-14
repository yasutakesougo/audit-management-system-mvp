import { afterEach, describe, expect, it, vi } from 'vitest';
import * as scheduleFeatures from '@/features/schedule/scheduleFeatures';
import { toSpScheduleFields } from '@/features/schedule/spMap';
import {
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
} from '@/sharepoint/fields';
import type { ScheduleUserCare } from '@/features/schedule/types';

const staffTextSpy = vi.spyOn(scheduleFeatures, 'isScheduleStaffTextColumnsEnabled');

const baseUserSchedule = (): ScheduleUserCare => ({
  id: '1',
  etag: 'etag',
  category: 'User',
  title: '巡回',
  start: '2025-01-01T00:00:00Z',
  end: '2025-01-01T01:00:00Z',
  allDay: false,
  status: '下書き',
  serviceType: '一時ケア',
  personType: 'Internal',
  personId: 'P-001',
  personName: '山田 太郎',
  staffIds: ['123'],
  staffNames: ['山田 太郎'],
  dayKey: '20250101',
  fiscalYear: '2024',
});

afterEach(() => {
  staffTextSpy.mockReset();
});

describe('toSpScheduleFields edge cases for staff assignment', () => {
  it('falls back to plain Title and clears lookup when staff id is unusable', () => {
    staffTextSpy.mockReturnValue(false);

    const schedule = baseUserSchedule();
    schedule.staffIds = ['   '];
    schedule.staffNames = [''];

    const fields = toSpScheduleFields(schedule);

    expect(fields.Title).toBe('巡回');
    expect(fields.StaffIdId).toBeNull();
    expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBeUndefined();
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBeUndefined();
  });

  it('emits staff text columns when feature flag is enabled', () => {
    staffTextSpy.mockReturnValue(true);

    const schedule = baseUserSchedule();
  schedule.staffIds = ['EMP-7'];
  schedule.staffNames = ['佐藤 花子'];

    const fields = toSpScheduleFields(schedule);

  expect(fields.StaffIdId).toBeNull();
  expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBe(JSON.stringify(['EMP-7']));
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBe(JSON.stringify(['佐藤 花子']));
  });

  it('retains category and ISO fields when display name is missing under text mode', () => {
    staffTextSpy.mockReturnValue(true);

    const schedule = baseUserSchedule();
    schedule.staffNames = ['   '];

    const fields = toSpScheduleFields(schedule);

    expect(fields[SCHEDULE_FIELD_CATEGORY]).toBe('User');
    expect(fields.EventDate).toBe('2025-01-01T00:00:00Z');
    expect(fields.EndDate).toBe('2025-01-01T01:00:00Z');
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBeNull();
  });
});
