import { describe, expect, it } from 'vitest';
import { mapSchedule } from '../../src/lib/mappers';
import {
  SCHEDULE_FIELD_ASSIGNED_STAFF,
  SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
  SCHEDULE_FIELD_END,
  SCHEDULE_FIELD_START,
  SCHEDULE_FIELD_STATUS,
  type ScheduleRow,
} from '../../src/sharepoint/fields';

type PartialScheduleRow = Partial<ScheduleRow> & { Id: number };

const baseRow = (): PartialScheduleRow => ({
  Id: 100,
  Title: 'Lookup demo',
  [SCHEDULE_FIELD_START]: '2025-01-01T09:00:00Z',
  [SCHEDULE_FIELD_END]: '2025-01-01T10:00:00Z',
  [SCHEDULE_FIELD_STATUS]: 'draft',
});

describe('mapSchedule lookup fallbacks', () => {
  it('normalizes numeric and string lookup identifiers with deduped staff names', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      [SCHEDULE_FIELD_ASSIGNED_STAFF_ID]: { results: ['123', 123, 'abc'] } as unknown as number[],
      [SCHEDULE_FIELD_ASSIGNED_STAFF]: [{ Title: '  Alice ' }, { FullName: 'Alice' }],
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.staffId).toBe(123);
    expect(schedule.staffIds).toEqual(['123']);
    expect(schedule.assignedStaffIds).toEqual(['123']);
    expect(schedule.staffNames).toEqual(['Alice']);
    expect(schedule.assignedStaffNames).toEqual(['Alice']);
  });

  it('falls back to legacy staff ids and names when assigned lookups are absent', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      cr014_staffIds: '4;#5;#5',
      cr014_staffNames: ' Bob ;# ;#Eve ',
      StaffIdId: undefined,
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.staffId).toBeNull();
    expect(schedule.staffIds).toEqual(['4', '5']);
    expect(schedule.assignedStaffIds).toEqual(['4', '5']);
    expect(schedule.staffNames).toEqual(['Bob', 'Eve']);
    expect(schedule.assignedStaffNames).toEqual(['Bob', 'Eve']);
  });

  it('uses lookup titles when identifiers are invalid across sources', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      [SCHEDULE_FIELD_ASSIGNED_STAFF_ID]: { results: ['NaN', '', '   '] } as unknown as number[],
      [SCHEDULE_FIELD_ASSIGNED_STAFF]: [{ Title: ' Carol Fallback ' }],
      StaffLookupId: { results: ['bad-id', null] } as unknown as number[],
      StaffLookup: [{ Title: '', FullName: 'Carol Fallback ' }],
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.staffIds).toEqual([]);
    expect(schedule.staffNames).toEqual(['Carol Fallback']);
    expect(schedule.assignedStaffNames).toEqual(['Carol Fallback']);
  });
});
