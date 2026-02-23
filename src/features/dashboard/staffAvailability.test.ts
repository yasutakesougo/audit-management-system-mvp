/**
 * Unit Test: Staff Availability Calculator
 * 
 * 職員フリー判定ロジックの検証
 */

import { describe, it, expect } from 'vitest';
import { calculateStaffAvailability } from './staffAvailability';
import type { Staff } from '@/types';
import type { StaffAssignment } from './staffAvailability';

describe('calculateStaffAvailability', () => {
  const mockStaff: Staff[] = [
    { id: 1, staffId: 's1', name: '田中' } as Staff,
    { id: 2, staffId: 's2', name: '佐藤' } as Staff,
    { id: 3, staffId: 's3', name: '高橋' } as Staff,
  ];

  describe('free 状態の判定', () => {
    it('予定が一切ない職員は free', () => {
      const assignments: StaffAssignment[] = [];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('free');
      expect(result[0].freeSlots).toHaveLength(1);
      expect(result[0].freeSlots[0]).toEqual({ start: '08:00', end: '18:00' });
    });

    it('次の予定まで1時間以上ある場合は free', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '11:30',
          endTime: '12:30',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('free');
      expect(result[0].nextFreeTime).toBe('10:00');
    });
  });

  describe('partial 状態の判定', () => {
    it('次の予定まで30-60分の場合は partial', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '10:40',
          endTime: '12:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('partial');
    });
  });

  describe('busy 状態の判定', () => {
    it('サポート役として1件の予定がある場合は busy', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'support',
          startTime: '09:00',
          endTime: '12:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('busy');
      expect(result[0].currentAssignment?.role).toBe('support');
    });

    it('次の予定まで30分未満の場合は busy', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '10:20',
          endTime: '12:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('busy');
    });
  });

  describe('occupied 状態の判定', () => {
    it('メイン担当として予定がある場合は occupied', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '09:00',
          endTime: '12:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('occupied');
      expect(result[0].currentAssignment?.userName).toBe('山田');
    });
  });

  describe('freeSlots の計算', () => {
    it('午前と午後に予定がある場合、昼休みがフリースロット', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '08:00',
          endTime: '12:00',
        },
        {
          userId: 's1',
          userName: '佐藤',
          role: 'main',
          startTime: '13:00',
          endTime: '17:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].freeSlots).toHaveLength(2);
      expect(result[0].freeSlots[0]).toEqual({ start: '12:00', end: '13:00' });
      expect(result[0].freeSlots[1]).toEqual({ start: '17:00', end: '18:00' });
    });

    it('連続した予定の場合、空き時間なし', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '08:00',
          endTime: '12:00',
        },
        {
          userId: 's1',
          userName: '佐藤',
          role: 'main',
          startTime: '12:00',
          endTime: '18:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].freeSlots).toHaveLength(0);
    });
  });

  describe('nextFreeTime の計算', () => {
    it('現在予定中の場合、予定終了時刻が nextFreeTime', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '09:00',
          endTime: '12:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].nextFreeTime).toBe('12:00');
    });

    it('すべての予定が終了している場合、現在時刻が nextFreeTime', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's1',
          userName: '山田',
          role: 'main',
          startTime: '08:00',
          endTime: '10:00',
        },
      ];
      const currentTime = '11:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].nextFreeTime).toBe('11:00');
    });
  });

  describe('複数職員の処理', () => {
    it('3人の職員のうち、1人だけ予定がある場合', () => {
      const assignments: StaffAssignment[] = [
        {
          userId: 's2',
          userName: '山田',
          role: 'main',
          startTime: '09:00',
          endTime: '12:00',
        },
      ];
      const currentTime = '10:00';

      const result = calculateStaffAvailability(mockStaff, assignments, currentTime);

      expect(result[0].status).toBe('free');   // s1: 田中（フリー）
      expect(result[1].status).toBe('occupied'); // s2: 佐藤（予定あり）
      expect(result[2].status).toBe('free');   // s3: 高橋（フリー）
    });
  });
});
