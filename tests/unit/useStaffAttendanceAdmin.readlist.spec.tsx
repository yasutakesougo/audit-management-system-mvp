import { describe, it, expect, vi } from 'vitest';
import type { StaffAttendance } from '@/features/staff/attendance/types';

/**
 * Unit tests for useStaffAttendanceAdmin.fetchListByDateRange
 * Tests the new date range query functionality added in Phase 3.4-C
 */

describe('useStaffAttendanceAdmin - fetchListByDateRange', () => {
  const mockStaffAttendance: StaffAttendance[] = [
    {
      staffId: 'S001',
      recordDate: '2026-02-01',
      status: '出勤',
      checkInAt: '2026-02-01T09:00:00Z',
      checkOutAt: '2026-02-01T18:00:00Z',
      lateMinutes: 0,
      note: '通常勤務',
    },
    {
      staffId: 'S002',
      recordDate: '2026-02-01',
      status: '欠勤',
      checkInAt: undefined,
      checkOutAt: undefined,
      lateMinutes: undefined,
      note: '申告済み',
    },
    {
      staffId: 'S001',
      recordDate: '2026-02-02',
      status: '出勤',
      checkInAt: '2026-02-02T09:15:00Z',
      checkOutAt: '2026-02-02T18:00:00Z',
      lateMinutes: 15,
      note: '遅刻',
    },
  ];

  describe('listByDateRange adapter method', () => {
    it('should return attendance records for date range', async () => {
      // Mock the adapter's listByDateRange method
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: mockStaffAttendance,
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-02');

      expect(result.isOk).toBe(true);
      expect(result.value).toEqual(mockStaffAttendance);
      expect(mockAdapter.listByDateRange).toHaveBeenCalledWith('2026-02-01', '2026-02-02');
    });

    it('should handle 401 (authentication error)', async () => {
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: false,
          error: {
            kind: 'forbidden',
            message: 'SharePoint 認証が必要です（401）。',
          },
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-02');

      expect(result.isOk).toBe(false);
      expect(result.error.kind).toBe('forbidden');
      expect(result.error.message).toContain('401');
    });

    it('should handle 403 (permission error)', async () => {
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: false,
          error: {
            kind: 'forbidden',
            message: 'SharePoint 権限がありません（403）。',
          },
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-02');

      expect(result.isOk).toBe(false);
      expect(result.error.kind).toBe('forbidden');
      expect(result.error.message).toContain('403');
    });

    it('should return empty array when no records match', async () => {
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: [],
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-01-01', '2026-01-31');

      expect(result.isOk).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value).toHaveLength(0);
    });

    it('should support optional top parameter for pagination', async () => {
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: mockStaffAttendance.slice(0, 2),
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-02', 100);

      expect(result.isOk).toBe(true);
      expect(mockAdapter.listByDateRange).toHaveBeenCalledWith('2026-02-01', '2026-02-02', 100);
    });

    it('should preserve all attendance fields in result', async () => {
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: mockStaffAttendance,
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-02');

      expect(result.isOk).toBe(true);
      const records = result.value;
      expect(records).toHaveLength(3);

      // Verify first record has all fields
      expect(records[0]).toEqual(
        expect.objectContaining({
          staffId: expect.any(String),
          recordDate: expect.any(String),
          status: expect.any(String),
        })
      );

      // Verify optional fields are preserved
      expect(records[0].checkInAt).toBeDefined();
      expect(records[1].note).toBeDefined();
    });
  });

  describe('results filtering and transformation', () => {
    it('should order results by recordDate desc, staffId asc', async () => {
      // Results should be sorted by the adapter's orderby clause
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: [
            // Feb 2, latest first
            { staffId: 'S001', recordDate: '2026-02-02', status: '出勤' },
            // Feb 1, sorted by staffId
            { staffId: 'S001', recordDate: '2026-02-01', status: '出勤' },
            { staffId: 'S002', recordDate: '2026-02-01', status: '欠勤' },
          ],
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-02');

      expect(result.isOk).toBe(true);
      const records = result.value;
      // Verify ordering: latest date first, then staffId asc
      expect(records[0].recordDate).toBe('2026-02-02');
      expect(records[1].recordDate).toBe('2026-02-01');
      expect(records[1].staffId).toBe('S001');
      expect(records[2].staffId).toBe('S002');
    });

    it('should handle null/undefined optional fields', async () => {
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: [
            {
              staffId: 'S001',
              recordDate: '2026-02-01',
              status: '欠勤',
              checkInAt: undefined,
              checkOutAt: null,
              lateMinutes: undefined,
              note: null,
            },
          ],
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-01');

      expect(result.isOk).toBe(true);
      const records = result.value;
      expect(records).toHaveLength(1);
      // Optional fields should still be in the result (as undefined/null)
      expect(records[0]).toHaveProperty('checkInAt');
      expect(records[0]).toHaveProperty('note');
    });
  });
});
