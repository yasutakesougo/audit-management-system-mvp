import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadHolidaysFromSharePoint, __test__ } from '../holidayLoader';
import { getHolidayLabel, resetDynamicHolidays } from '../holidays';

import type { UseSP } from '@/lib/spClient';

const { normalizeDate } = __test__;

// ── Mock SP Client ──
const mockListItems = vi.fn();

function createMockSp(rows: unknown[] = []): UseSP {
  mockListItems.mockResolvedValue(rows);
  return { listItems: mockListItems } as unknown as UseSP;
}

describe('holidayLoader', () => {
  beforeEach(() => {
    resetDynamicHolidays();
    mockListItems.mockReset();
  });

  describe('normalizeDate', () => {
    it('extracts date from ISO datetime', () => {
      expect(normalizeDate('2026-01-01T00:00:00Z')).toBe('2026-01-01');
    });

    it('handles plain date string', () => {
      expect(normalizeDate('2026-07-20')).toBe('2026-07-20');
    });

    it('returns null for null/undefined/empty', () => {
      expect(normalizeDate(null)).toBeNull();
      expect(normalizeDate(undefined)).toBeNull();
      expect(normalizeDate('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(normalizeDate('not-a-date')).toBeNull();
    });
  });

  describe('loadHolidaysFromSharePoint', () => {
    it('loads holidays and updates dynamic cache', async () => {
      const mockSp = createMockSp([
        { Id: 1, Title: '元日', Date: '2026-01-01T00:00:00Z', Label: '元日', IsActive: true },
        { Id: 2, Title: '成人の日', Date: '2026-01-12T00:00:00Z', Label: '成人の日', IsActive: true },
      ]);

      const count = await loadHolidaysFromSharePoint(mockSp);

      expect(count).toBe(2);
      expect(getHolidayLabel('2026-01-01')).toBe('元日');
      expect(getHolidayLabel('2026-01-12')).toBe('成人の日');
    });

    it('passes correct OData parameters', async () => {
      const mockSp = createMockSp([]);

      await loadHolidaysFromSharePoint(mockSp, {
        fiscalYear: '2026',
        activeOnly: true,
      });

      expect(mockListItems).toHaveBeenCalledWith('Holiday_Master', {
        select: expect.arrayContaining(['Id']),
        filter: "IsActive eq 1 and FiscalYear eq '2026'",
        top: 500,
      });
    });

    it('returns 0 when no rows are returned', async () => {
      const mockSp = createMockSp([]);
      const count = await loadHolidaysFromSharePoint(mockSp);
      expect(count).toBe(0);
    });

    it('falls back gracefully on SP error', async () => {
      const mockSp = createMockSp();
      mockListItems.mockRejectedValue(new Error('404 Not Found'));

      const count = await loadHolidaysFromSharePoint(mockSp);
      expect(count).toBe(0);

      // Static fallback should still work
      expect(getHolidayLabel('2026-01-01')).toBe('元日');
    });

    it('uses Label over Title when both exist', async () => {
      const mockSp = createMockSp([
        { Id: 1, Title: 'タイトル', Date: '2026-12-29T00:00:00Z', Label: 'ラベル', IsActive: true },
      ]);

      await loadHolidaysFromSharePoint(mockSp);
      expect(getHolidayLabel('2026-12-29')).toBe('ラベル');
    });

    it('falls back to Title when Label is empty', async () => {
      const mockSp = createMockSp([
        { Id: 1, Title: 'タイトルのみ', Date: '2026-12-30T00:00:00Z', Label: '', IsActive: true },
      ]);

      await loadHolidaysFromSharePoint(mockSp);
      expect(getHolidayLabel('2026-12-30')).toBe('タイトルのみ');
    });

    it('skips rows with invalid dates', async () => {
      const mockSp = createMockSp([
        { Id: 1, Title: 'valid', Date: '2026-01-01T00:00:00Z', Label: '有効' },
        { Id: 2, Title: 'invalid', Date: null, Label: '無効' },
        { Id: 3, Title: 'also-invalid', Date: 'bad-date', Label: '不正' },
      ]);

      const count = await loadHolidaysFromSharePoint(mockSp);
      expect(count).toBe(1);
      expect(getHolidayLabel('2026-01-01')).toBe('有効');
    });

    it('disables activeOnly filter when set to false', async () => {
      const mockSp = createMockSp([]);

      await loadHolidaysFromSharePoint(mockSp, { activeOnly: false });

      expect(mockListItems).toHaveBeenCalledWith('Holiday_Master', {
        select: expect.any(Array),
        filter: undefined,
        top: 500,
      });
    });
  });
});
