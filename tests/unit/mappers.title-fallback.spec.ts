import { describe, expect, it } from 'vitest';
import { mapSchedule } from '../../src/lib/mappers';
import {
  SCHEDULE_FIELD_END,
  SCHEDULE_FIELD_NOTE,
  SCHEDULE_FIELD_START,
  type ScheduleRow,
} from '../../src/sharepoint/fields';

const baseRow = (): Partial<ScheduleRow> => ({
  Id: 101,
  Title: 'Base',
  [SCHEDULE_FIELD_START]: '2025-05-01T01:00:00Z',
  [SCHEDULE_FIELD_END]: '2025-05-01T02:00:00Z',
});

describe('mappers – note fallbacks and trimming', () => {
  it('prefers the primary note field and trims whitespace', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      [SCHEDULE_FIELD_NOTE]: '  Primary  ',
      Notes: 'Tertiary',
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.notes).toBe('Primary');
  });

  it('falls back to legacy Notes when primary fields are blank', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      Notes: '  Fallback notes  ',
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.notes).toBe('Fallback notes');
  });
});
