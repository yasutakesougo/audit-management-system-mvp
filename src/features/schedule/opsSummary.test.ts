// src/features/schedule/opsSummary.test.ts
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import type { ScheduleConflict } from './conflictChecker';
import {
    buildDailyConflictSummary,
    buildStaffLoadSummary,
    buildVehicleUsageSummary,
} from './opsSummary';
import type { Schedule } from './types';

describe('Operations Summary Functions', () => {
  const today = dayjs().startOf('day');
  const todayStr = today.format('YYYY-MM-DD');

  describe('buildDailyConflictSummary', () => {
    it('filters conflicts by date and counts by kind', () => {
      const schedules: Schedule[] = [
        {
          id: 's1',
          etag: '1',
          category: 'User',
          start: today.add(9, 'hour').toISOString(),
          end: today.add(10, 'hour').toISOString(),
        } as Schedule,
        {
          id: 's2',
          etag: '1',
          category: 'Staff',
          start: today.add(9, 'hour').toISOString(),
          end: today.add(10, 'hour').toISOString(),
        } as Schedule,
      ];

      const conflicts: ScheduleConflict[] = [
        {
          idA: 's1',
          idB: 's2',
          kind: 'staff-life-support-vs-staff',
          message: 'Test conflict',
        },
      ];

      const result = buildDailyConflictSummary(todayStr, conflicts, schedules);

      expect(result.date).toBe(todayStr);
      expect(result.totalConflicts).toBe(1);
      expect(result.byKind['staff-life-support-vs-staff']).toBe(1);
    });

    it('returns empty summary when no conflicts', () => {
      const schedules: Schedule[] = [];
      const conflicts: ScheduleConflict[] = [];

      const result = buildDailyConflictSummary(todayStr, conflicts, schedules);

      expect(result.totalConflicts).toBe(0);
      expect(Object.keys(result.byKind)).toHaveLength(0);
    });
  });

  describe('buildStaffLoadSummary', () => {
    it('counts schedules per staff member', () => {
      const schedules: Schedule[] = [
        {
          id: 's1',
          category: 'User',
          start: today.add(9, 'hour').toISOString(),
          staffIds: ['staff-001', 'staff-002'],
        } as Schedule,
        {
          id: 's2',
          category: 'Staff',
          start: today.add(14, 'hour').toISOString(),
          staffIds: ['staff-001'],
        } as Schedule,
      ];

      const result = buildStaffLoadSummary(todayStr, schedules);

      expect(result).toHaveLength(2);
      expect(result.find(s => s.staffId === 'staff-001')?.scheduleCount).toBe(2);
      expect(result.find(s => s.staffId === 'staff-002')?.scheduleCount).toBe(1);
    });
  });

  describe('buildVehicleUsageSummary', () => {
    it('counts trips per vehicle', () => {
      const schedules = [
        {
          id: 's1',
          category: 'User',
          start: today.add(9, 'hour').toISOString(),
        },
        {
          id: 's2',
          category: 'User',
          start: today.add(14, 'hour').toISOString(),
        },
        {
          id: 's3',
          category: 'User',
          start: today.add(16, 'hour').toISOString(),
        },
      ] as Schedule[];

      // vehicleId を拡張プロパティとして追加
      const extendedSchedules = schedules as (Schedule & { vehicleId?: string })[];
      extendedSchedules[0].vehicleId = 'car-01';
      extendedSchedules[1].vehicleId = 'car-01';
      extendedSchedules[2].vehicleId = 'car-02';

      const result = buildVehicleUsageSummary(todayStr, extendedSchedules);

      expect(result).toHaveLength(2);
      expect(result.find(v => v.vehicleId === 'car-01')?.tripCount).toBe(2);
      expect(result.find(v => v.vehicleId === 'car-02')?.tripCount).toBe(1);
    });
  });
});