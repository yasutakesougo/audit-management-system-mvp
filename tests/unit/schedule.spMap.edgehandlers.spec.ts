import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toSpScheduleFields } from '@/features/schedule/spMap';
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';
import {
  SCHEDULE_FIELD_DAY_PART,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_ORG_AUDIENCE,
  SCHEDULE_FIELD_SUB_TYPE,
} from '@/sharepoint/fields';

vi.mock('@/features/schedule/scheduleFeatures', () => ({
  isScheduleStaffTextColumnsEnabled: vi.fn(() => true),
}));

const scheduleFeatures = await import('@/features/schedule/scheduleFeatures');
const isScheduleStaffTextColumnsEnabled = vi.mocked(scheduleFeatures.isScheduleStaffTextColumnsEnabled);

describe('toSpScheduleFields edge handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isScheduleStaffTextColumnsEnabled.mockReturnValue(true);
  });

  it('maps external user-care schedules with staff text columns', () => {
    const schedule: ScheduleUserCare = {
      id: '1',
      etag: 'W/"1"',
      category: 'User',
      title: '外部支援',
      start: '2025-06-01T00:00:00Z',
      end: '2025-06-01T01:00:00Z',
      allDay: false,
      status: '承認済み',
      serviceType: 'ショートステイ',
      personType: 'External',
      externalPersonName: 'ゲスト',
      staffIds: ['42', '42', '043'],
      staffNames: ['山田', ' 佐藤 '],
      location: '',
      notes: undefined,
    };

    const payload = toSpScheduleFields(schedule);
    expect(payload[SCHEDULE_FIELD_PERSON_ID]).toBeNull();
    expect(payload[SCHEDULE_FIELD_PERSON_NAME]).toBeNull();
    expect(payload[SCHEDULE_FIELD_EXTERNAL_NAME]).toBe('ゲスト');
    expect(payload[SCHEDULE_FIELD_STAFF_IDS]).toBe('["42","043"]');
    expect(payload[SCHEDULE_FIELD_STAFF_NAMES]).toBe('["山田","佐藤"]');
    expect(payload[SCHEDULE_FIELD_SUB_TYPE]).toBeNull();
  });

  it('omits staff text columns when feature flag is disabled', () => {
    isScheduleStaffTextColumnsEnabled.mockReturnValue(false);
    const schedule: ScheduleStaff = {
      id: '2',
      etag: 'W/"2"',
      category: 'Staff',
      title: '年休',
      start: '2025-06-01T00:00:00Z',
      end: '2025-06-01T03:00:00Z',
      allDay: false,
      status: '下書き',
      subType: '年休',
      staffIds: ['55'],
      staffNames: ['田中'],
      dayPart: 'PM',
    };

    const payload = toSpScheduleFields(schedule);
    expect(payload).not.toHaveProperty(SCHEDULE_FIELD_STAFF_IDS);
    expect(payload).not.toHaveProperty(SCHEDULE_FIELD_STAFF_NAMES);
    expect(payload.StaffIdId).toBe(55);
    expect(payload[SCHEDULE_FIELD_DAY_PART]).toBe('PM');
  });

  it('serializes org schedule audiences and recurrence', () => {
    isScheduleStaffTextColumnsEnabled.mockReturnValue(true);
    const schedule: ScheduleOrg = {
      id: '3',
      etag: 'W/"3"',
      category: 'Org',
      title: '月例会議',
      start: '2025-06-10T01:00:00Z',
      end: '2025-06-10T02:00:00Z',
      allDay: false,
      status: '申請中',
      subType: '会議',
      audience: ['全職員', '生活介護'],
      recurrenceRule: 'FREQ=DAILY;',
    };

    const payload = toSpScheduleFields(schedule);
    expect(payload[SCHEDULE_FIELD_ORG_AUDIENCE]).toBe('["全職員","生活介護"]');
    expect(payload[SCHEDULE_FIELD_STAFF_IDS]).toBeNull();
    expect(payload.RecurrenceJson).toBe('FREQ=DAILY;');
  });
});
