import { mapSchedule, mapScheduleToSp } from '@/lib/mappers';
import {
    SCHEDULE_FIELD_BILLING_FLAGS,
    SCHEDULE_FIELD_END,
    SCHEDULE_FIELD_NOTE,
    SCHEDULE_FIELD_START,
    SCHEDULE_FIELD_TARGET_USER_ID,
} from '@/sharepoint/fields';
import { describe, expect, it } from 'vitest';

describe('mapSchedule status normalization', () => {
  const baseRow = (status: string | null | undefined) => ({
    Id: 1,
    Title: 'Event',
    [SCHEDULE_FIELD_START]: '2025-06-01T00:00:00Z',
    [SCHEDULE_FIELD_END]: '2025-06-01T01:00:00Z',
    Status: status,
  });

  it('coerces empty or unknown values to draft', () => {
    const empty = mapSchedule(baseRow(' '));
    const unknown = mapSchedule(baseRow('???'));
    expect(empty.status).toBe('draft');
    expect(unknown.status).toBe('draft');
  });

  it('handles case and punctuation variants', () => {
    const submitted = mapSchedule(baseRow(' In-Progress '));
    const approved = mapSchedule(baseRow(' COMPLETED '));
    expect(submitted.status).toBe('submitted');
    expect(approved.status).toBe('approved');
  });
});

describe('mapSchedule fallbacks', () => {
  it('uses legacy cr014_* fields when modern lookups are empty', () => {
    const row: Record<string, unknown> = {
      Id: 101,
      Title: '  ',
      [SCHEDULE_FIELD_START]: '2025-06-01T00:00:00Z',
      [SCHEDULE_FIELD_END]: '2025-06-01T01:00:00Z',
      cr014_staffIds: ' 21 ;# 21 ;# 22 ',
      cr014_staffNames: ' 佐藤 ;# 鈴木 ',
      cr014_category: '  Legacy ',
    };
    const schedule = mapSchedule(row as unknown as Parameters<typeof mapSchedule>[0]);
    expect(schedule.staffIds).toEqual(['21', '22']);
    expect(schedule.staffNames).toEqual(['佐藤', '鈴木']);
    expect(schedule.category).toBe('Legacy');
    expect(schedule.title).toBe('');
  });

  it('retains invalid ISO strings without throwing', () => {
    const row: Record<string, unknown> = {
      Id: 102,
      [SCHEDULE_FIELD_START]: 'not-a-date',
      [SCHEDULE_FIELD_END]: '',
    };
    const schedule = mapSchedule(row as unknown as Parameters<typeof mapSchedule>[0]);
    expect(schedule.startUtc).toBe('not-a-date');
    expect(schedule.endUtc).toBeNull();
  });
});

describe('mapScheduleToSp', () => {
  it('produces a SharePoint payload even when optional values are absent', () => {
    const payload = mapScheduleToSp({
      title: 'Draft',
      start: '2025-06-01T00:00:00Z',
      end: '2025-06-01T01:00:00Z',
      status: 'draft',
    });
    expect(payload.Title).toBe('Draft');
    expect(payload[SCHEDULE_FIELD_START]).toBe('2025-06-01T00:00:00.000Z');
    expect(payload[SCHEDULE_FIELD_END]).toBe('2025-06-01T01:00:00.000Z');
    expect(payload[SCHEDULE_FIELD_NOTE]).toBeNull();
    expect(payload[SCHEDULE_FIELD_TARGET_USER_ID]).toBeUndefined();
    expect(payload[SCHEDULE_FIELD_BILLING_FLAGS]).toBeUndefined();
  });
});
