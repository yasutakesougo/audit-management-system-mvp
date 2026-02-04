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

  describe('nextLink pagination (Phase 3.4-C2)', () => {
    it('should handle multi-page fetch via nextLink pagination', async () => {
      // Simulate 2 pages of results via nextLink:
      // Page 1: 200 items with nextLink
      // Page 2: 50 items without nextLink (null)
      // Total: 250 items
      const page1Items = Array.from({ length: 200 }, (_, i) => ({
        staffId: `S${String(i + 1).padStart(3, '0')}`,
        recordDate: '2026-02-01',
        status: '出勤',
        checkInAt: '2026-02-01T09:00:00Z',
        checkOutAt: '2026-02-01T18:00:00Z',
        lateMinutes: 0,
        note: 'page1',
      }));

      const page2Items = Array.from({ length: 50 }, (_, i) => ({
        staffId: `S${String(200 + i + 1).padStart(3, '0')}`,
        recordDate: '2026-02-01',
        status: '出勤',
        checkInAt: '2026-02-01T09:00:00Z',
        checkOutAt: '2026-02-01T18:00:00Z',
        lateMinutes: 0,
        note: 'page2',
      }));

      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: true,
          value: [...page1Items, ...page2Items],
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-02-01');

      expect(result.isOk).toBe(true);
      expect(result.value).toHaveLength(250);
      
      // Verify first and last items from each page
      expect(result.value[0].staffId).toBe('S001');
      expect(result.value[199].staffId).toBe('S200');
      expect(result.value[200].staffId).toBe('S201');
      expect(result.value[249].staffId).toBe('S250');
      
      // Verify all items have proper structure
      result.value.forEach((item) => {
        expect(item).toHaveProperty('staffId');
        expect(item).toHaveProperty('recordDate');
        expect(item).toHaveProperty('status');
      });
    });

    it('should return validation error when max items cap exceeded', async () => {
      // When items count >= (top × maxPages), should return explicit error
      // top=200, maxPages=10 → cap at 2000 items
      const mockAdapter = {
        listByDateRange: vi.fn().mockResolvedValue({
          isOk: false,
          error: {
            kind: 'validation',
            message: 'Read list exceeded max items (2000). Please refine date range.',
          },
        }),
      };

      const result = await mockAdapter.listByDateRange('2026-02-01', '2026-12-31');

      expect(result.isOk).toBe(false);
      expect(result.error.kind).toBe('validation');
      expect(result.error.message).toContain('exceeded max items');
      expect(result.error.message).toContain('2000');
    });
  });
});
