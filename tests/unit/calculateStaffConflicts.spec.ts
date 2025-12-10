import type { Schedule } from '@/lib/mappers';
import { calculateStaffConflicts } from '@/pages/DashboardPage';
import { describe, expect, it } from 'vitest';

// テスト用のミニマムなScheduleオブジェクトを作成するヘルパー
function createMockSchedule(idString: string, staffIds?: string[]): Schedule {
  const numericId = parseInt(idString.replace('s', ''), 10) || 0;
  return {
    id: numericId,
    startDate: '2025-11-15',
    endDate: '2025-11-15',
    staffIds,
    etag: null,
    title: `Mock Schedule ${idString}`,
    startUtc: new Date().toISOString(),
    endUtc: new Date().toISOString(),
    startLocal: '09:00',
    endLocal: '17:00',
    allDay: false,
    location: null,
    staffId: staffIds?.[0] ? parseInt(staffIds[0].replace('staff-', ''), 10) || null : null,
    userId: null,
    status: 'approved',
    notes: null,
    recurrenceRaw: null,
  } as Schedule;
}

describe('calculateStaffConflicts', () => {
  it('同じスタッフが複数スケジュールに入っているとコンフリクトを検出する', () => {
    const schedules = [
      createMockSchedule('s1', ['staff-1']),
      createMockSchedule('s2', ['staff-1']),
    ];

    const conflicts = calculateStaffConflicts(schedules);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('staff-overlap');
    expect(conflicts[0].scheduleIds).toEqual(['1', '2']);
    expect(conflicts[0].message).toBe('スタッフ staff-1 の時間重複');
  });

  it('スタッフIDが重複していなければコンフリクトは発生しない', () => {
    const schedules = [
      createMockSchedule('s1', ['staff-1']),
      createMockSchedule('s2', ['staff-2']),
    ];

    const conflicts = calculateStaffConflicts(schedules);

    expect(conflicts).toHaveLength(0);
  });

  it('スタッフIDが未定義または空の場合はスキップする', () => {
    const schedules = [
      createMockSchedule('s1', undefined),
      createMockSchedule('s2', []),
      createMockSchedule('s3', ['staff-1']),
    ];

    const conflicts = calculateStaffConflicts(schedules);

    expect(conflicts).toHaveLength(0);
  });

  it('複数のスタッフがそれぞれ重複する場合を適切に検出する', () => {
    const schedules = [
      createMockSchedule('s1', ['staff-1', 'staff-2']),
      createMockSchedule('s2', ['staff-1']),
      createMockSchedule('s3', ['staff-2', 'staff-3']),
    ];

    const conflicts = calculateStaffConflicts(schedules);

    expect(conflicts).toHaveLength(2);

    // staff-1 の重複
    const staff1Conflict = conflicts.find(c => c.message.includes('staff-1'));
    expect(staff1Conflict).toBeDefined();
    expect(staff1Conflict?.scheduleIds).toEqual(['1', '2']);

    // staff-2 の重複
    const staff2Conflict = conflicts.find(c => c.message.includes('staff-2'));
    expect(staff2Conflict).toBeDefined();
    expect(staff2Conflict?.scheduleIds).toEqual(['1', '3']);
  });
});
