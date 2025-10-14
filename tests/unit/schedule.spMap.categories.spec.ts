import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schedule } from '../../src/features/schedule/types';
import {
  SCHEDULE_FIELD_EXTERNAL_CONTACT,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_EXTERNAL_ORG,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
} from '../../src/sharepoint/fields';

const staffTextToggle = vi.fn();

vi.mock('../../src/features/schedule/scheduleFeatures', async () => {
  const actual = await vi.importActual<typeof import('../../src/features/schedule/scheduleFeatures')>(
    '../../src/features/schedule/scheduleFeatures'
  );
  return {
    ...actual,
    isScheduleStaffTextColumnsEnabled: () => staffTextToggle(),
  };
});

describe('toSpScheduleFields staff text toggles', () => {
  let toSpScheduleFields: (schedule: Schedule) => Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();
    staffTextToggle.mockReset();
    ({ toSpScheduleFields } = await import('../../src/features/schedule/spMap'));
  });

  const baseSchedule = (): Record<string, unknown> => ({
    id: 'sched-1',
    etag: 'etag-1',
    category: 'User',
    title: 'Category coverage',
    start: '2025-01-01T09:00:00.000Z',
    end: '2025-01-01T10:00:00.000Z',
    allDay: false,
    status: '下書き',
    serviceType: '一時ケア',
    personType: 'Internal',
    personId: 'user-1',
    personName: 'User Example',
    staffIds: ['42'],
    staffNames: ['Primary'],
  });

  it('omits staff text fields when toggle disabled and preserves lookup assignment', async () => {
    staffTextToggle.mockReturnValue(false);
    const schedule = {
      ...baseSchedule(),
      staffIds: ['12', '', '012'],
      staffNames: ['Lead'],
      personType: 'External',
      personId: null,
      personName: null,
      externalPersonName: 'Outside Org',
      externalPersonOrg: 'Org Co',
      externalPersonContact: '0123-456',
    };

  const fields = toSpScheduleFields(schedule as unknown as Schedule);

    expect(fields.StaffIdId).toBe(12);
    expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBeUndefined();
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBeUndefined();
  expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('External');
    expect(fields[SCHEDULE_FIELD_PERSON_ID]).toBeNull();
    expect(fields[SCHEDULE_FIELD_PERSON_NAME]).toBeNull();
    expect(fields[SCHEDULE_FIELD_EXTERNAL_NAME]).toBe('Outside Org');
    expect(fields[SCHEDULE_FIELD_EXTERNAL_ORG]).toBe('Org Co');
    expect(fields[SCHEDULE_FIELD_EXTERNAL_CONTACT]).toBe('0123-456');
  });

  it('includes staff text columns when toggle enabled with deduped values', async () => {
    staffTextToggle.mockReturnValue(true);
    const schedule = {
      ...baseSchedule(),
      staffIds: ['12', '12', '15', ''],
      staffNames: [' Alice ', 'Bob', ''],
      personType: 'Internal',
    };

  const fields = toSpScheduleFields(schedule as unknown as Schedule);

    expect(fields.StaffIdId).toBe(12);
    expect(fields[SCHEDULE_FIELD_STAFF_IDS]).toBe(JSON.stringify(['12', '15']));
    expect(fields[SCHEDULE_FIELD_STAFF_NAMES]).toBe(JSON.stringify(['Alice', 'Bob']));
  expect(fields[SCHEDULE_FIELD_PERSON_TYPE]).toBe('Internal');
    expect(fields[SCHEDULE_FIELD_PERSON_ID]).toBe('user-1');
    expect(fields[SCHEDULE_FIELD_PERSON_NAME]).toBe('User Example');
    expect(fields[SCHEDULE_FIELD_EXTERNAL_NAME]).toBeNull();
    expect(fields[SCHEDULE_FIELD_EXTERNAL_ORG]).toBeNull();
    expect(fields[SCHEDULE_FIELD_EXTERNAL_CONTACT]).toBeNull();
  });
});
