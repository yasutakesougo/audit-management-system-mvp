import { describe, expect, it } from 'vitest';
import { mapSchedule, mapScheduleToSp } from '@/lib/mappers';
import type { ScheduleRow } from '@/sharepoint/fields';
import {
  SCHEDULE_FIELD_ASSIGNED_STAFF,
  SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
  SCHEDULE_FIELD_BILLING_FLAGS,
  SCHEDULE_FIELD_CREATED_AT,
  SCHEDULE_FIELD_DAY_KEY,
  SCHEDULE_FIELD_END,
  SCHEDULE_FIELD_MONTH_KEY,
  SCHEDULE_FIELD_NOTE,
  SCHEDULE_FIELD_RELATED_RESOURCE,
  SCHEDULE_FIELD_RELATED_RESOURCE_ID,
  SCHEDULE_FIELD_ROW_KEY,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_START,
  SCHEDULE_FIELD_STATUS,
  SCHEDULE_FIELD_TARGET_USER,
  SCHEDULE_FIELD_TARGET_USER_ID,
  SCHEDULE_FIELD_UPDATED_AT,
} from '@/sharepoint/fields';

describe('mapSchedule lookup expansions', () => {
  const baseRow = (): Record<string, unknown> => ({
    Id: 9101,
    Title: '  Lookup Event  ',
    [SCHEDULE_FIELD_START]: '2025-07-01T09:00:00+09:00',
    [SCHEDULE_FIELD_END]: '2025-07-01T12:30:00+09:00',
    [SCHEDULE_FIELD_STATUS]: '確定',
  });

  it('expands nested lookup results and preserves derived metadata', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      [SCHEDULE_FIELD_ASSIGNED_STAFF_ID]: {
        results: [5, ' 6 ', 'x', 5],
      } as unknown as number[],
      [SCHEDULE_FIELD_ASSIGNED_STAFF]: {
        results: [
          { Title: ' 佐藤 ' },
          { Title: '佐藤' },
          { Title: ' 田中 ' },
          { Title: '' },
        ],
      } as unknown,
      [SCHEDULE_FIELD_TARGET_USER_ID]: {
        results: ['100', '101', null],
      } as unknown as number[],
      [SCHEDULE_FIELD_TARGET_USER]: {
        results: [{ Title: ' 利用者A ' }, { Title: null }],
      } as unknown,
      [SCHEDULE_FIELD_RELATED_RESOURCE_ID]: {
        results: [3001, '3002'],
      } as unknown as number[],
      [SCHEDULE_FIELD_RELATED_RESOURCE]: {
        results: [{ Title: ' 会議室A ' }, { Title: '  ' }],
      } as unknown,
      [SCHEDULE_FIELD_BILLING_FLAGS]: {
        results: ['夜間', '長時間', '夜間'],
      } as unknown,
      [SCHEDULE_FIELD_SERVICE_TYPE]: ' 通常 ',
      [SCHEDULE_FIELD_ROW_KEY]: ' row-key ',
      [SCHEDULE_FIELD_DAY_KEY]: ' 2025-07-01 ',
      [SCHEDULE_FIELD_MONTH_KEY]: ' 2025-07 ',
      [SCHEDULE_FIELD_CREATED_AT]: '2025-06-01T00:00:00Z',
      [SCHEDULE_FIELD_UPDATED_AT]: '2025-06-20T00:00:00Z',
      cr014_staffIds: 'レガシー;# 7',
      cr014_staffNames: '旧;#データ',
      cr014_personType: ' 外部 ',
      cr014_personId: ' P-20 ',
      cr014_personName: ' 相談員 ',
      cr014_category: ' 来客 ',
      DayPart: ' 午前 ',
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.staffIds).toEqual(['5', '6']);
    expect(schedule.assignedStaffIds).toEqual(['5', '6']);
  expect(schedule.staffNames).toEqual(['佐藤', '佐藤', '田中']);
  expect(schedule.assignedStaffNames).toEqual(['佐藤', '佐藤', '田中']);
    expect(schedule.targetUserIds).toEqual([100, 101]);
    expect(schedule.targetUserNames).toEqual(['利用者A']);
    expect(schedule.relatedResourceIds).toEqual([3001, 3002]);
    expect(schedule.relatedResourceNames).toEqual(['会議室A']);
    expect(schedule.billingFlags).toEqual(['夜間', '長時間']);
    expect(schedule.serviceType).toBe('通常');
    expect(schedule.rowKey).toBe('row-key');
    expect(schedule.dayKey).toBe('2025-07-01');
    expect(schedule.monthKey).toBe('2025-07');
    expect(schedule.createdAt).toBe('2025-06-01T00:00:00Z');
    expect(schedule.updatedAt).toBe('2025-06-20T00:00:00Z');
    expect(schedule.personType).toBe('外部');
    expect(schedule.personId).toBe('P-20');
    expect(schedule.personName).toBe('相談員');
    expect(schedule.dayPart).toBe('午前');
  });

  it('omits derived arrays when lookups and fallbacks are empty', () => {
    const row: ScheduleRow = {
      ...baseRow(),
      Title: undefined,
      [SCHEDULE_FIELD_NOTE]: undefined,
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.staffIds).toEqual([]);
    expect(schedule.assignedStaffIds).toBeUndefined();
    expect(schedule.staffNames).toBeUndefined();
    expect(schedule.assignedStaffNames).toBeUndefined();
    expect(schedule.targetUserIds).toEqual([]);
    expect(schedule.targetUserNames).toBeUndefined();
    expect(schedule.relatedResourceIds).toEqual([]);
    expect(schedule.relatedResourceNames).toBeUndefined();
    expect(schedule.rowKey).toBeNull();
    expect(schedule.dayKey).toBeNull();
    expect(schedule.monthKey).toBeNull();
    expect(schedule.serviceType).toBeNull();
  });
});

describe('mapScheduleToSp status mapping', () => {
  it('covers SharePoint status conversions and optional payload branches', () => {
    const payload = mapScheduleToSp({
      title: ' 休日対応 ',
      start: '2025-07-01T09:00:00+09:00',
      end: '2025-07-01T11:00:00+09:00',
      status: 'holiday',
      note: 'メモ',
      targetUserId: '42',
      billingFlags: ['夜間', '夜間', ' '],
    });

    expect(payload.Title).toBe('休日対応');
    expect(payload[SCHEDULE_FIELD_START]).toBe('2025-07-01T00:00:00.000Z');
    expect(payload[SCHEDULE_FIELD_END]).toBe('2025-07-01T02:00:00.000Z');
    expect(payload[SCHEDULE_FIELD_STATUS]).toBe('完了');
    expect(payload[SCHEDULE_FIELD_NOTE]).toBe('メモ');
    expect(payload[SCHEDULE_FIELD_TARGET_USER_ID]).toEqual({ results: [42] });
    expect(payload[SCHEDULE_FIELD_BILLING_FLAGS]).toEqual({ results: ['夜間'] });

    const statuses: Array<[Parameters<typeof mapScheduleToSp>[0]['status'], string]> = [
      ['submitted', '実施中'],
      ['approved', '確定'],
      ['confirmed', '確定'],
      ['absent', 'キャンセル'],
      ['planned', '未確定'],
      ['draft', '未確定'],
    ];

    for (const [status, expected] of statuses) {
      const result = mapScheduleToSp({
        title: 'Case',
        start: '2025-08-01T00:00:00Z',
        end: '2025-08-01T01:00:00Z',
        status,
        targetUserId: null,
        billingFlags: null,
      });
      expect(result[SCHEDULE_FIELD_STATUS]).toBe(expected);
      expect(result[SCHEDULE_FIELD_TARGET_USER_ID]).toEqual({ results: [] });
      expect(result[SCHEDULE_FIELD_BILLING_FLAGS]).toEqual({ results: [] });
    }
  });
});
