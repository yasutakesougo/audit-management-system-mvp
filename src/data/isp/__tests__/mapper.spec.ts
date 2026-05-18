import { describe, expect, it } from 'vitest';
import { mapPlanningSheetRowToDomain, mapPlanningSheetRowToListItem, extractSpId } from '../mapper';
import type { SpPlanningSheetRow } from '@/lib/sp/types';

describe('isp mapper parseDateOnly', () => {
  it('correctly maps various appliedFrom date formats to YYYY-MM-DD JST strings', () => {
    // 1. Raw ISO datetime string representing Midnight JST (15:00 UTC previous day)
    const row1: Partial<SpPlanningSheetRow> = {
      id: 1,
      title: 'Test',
      userCode: 'U-001',
      appliedFrom: '2026-05-16T15:00:00Z',
    };
    const domain1 = mapPlanningSheetRowToDomain(row1 as SpPlanningSheetRow);
    expect(domain1.appliedFrom).toBe('2026-05-17');

    // 2. Already formatted YYYY-MM-DD string
    const row2: Partial<SpPlanningSheetRow> = {
      id: 2,
      title: 'Test',
      userCode: 'U-001',
      appliedFrom: '2026-05-17',
    };
    const domain2 = mapPlanningSheetRowToDomain(row2 as SpPlanningSheetRow);
    expect(domain2.appliedFrom).toBe('2026-05-17');

    // 3. Null or undefined
    const row3: Partial<SpPlanningSheetRow> = {
      id: 3,
      title: 'Test',
      userCode: 'U-001',
      appliedFrom: null,
    };
    const domain3 = mapPlanningSheetRowToDomain(row3 as SpPlanningSheetRow);
    expect(domain3.appliedFrom).toBeNull();
  });
});

describe('isp mapper ID normalization', () => {
  it('mapPlanningSheetRowToListItem handles id, Id, ID keys correctly', () => {
    const baseRow: Partial<SpPlanningSheetRow> = {
      title: 'Test',
      userCode: 'U-001',
      ispId: 'isp-123',
    };

    const rowId = { ...baseRow, id: 101 } as unknown as SpPlanningSheetRow;
    const rowIdUpper = { ...baseRow, Id: 102 } as unknown as SpPlanningSheetRow;
    const rowIdAllCaps = { ...baseRow, ID: 103 } as unknown as SpPlanningSheetRow;

    expect(mapPlanningSheetRowToListItem(rowId).id).toBe('sp-101');
    expect(mapPlanningSheetRowToListItem(rowIdUpper).id).toBe('sp-102');
    expect(mapPlanningSheetRowToListItem(rowIdAllCaps).id).toBe('sp-103');
  });

  it('extractSpId correctly trims and parses various formats', () => {
    expect(extractSpId(' sp-123 ')).toBe(123);
    expect(extractSpId('sp-456')).toBe(456);
    expect(extractSpId(' 789 ')).toBe(789);
    expect(extractSpId('invalid')).toBeNull();
  });
});

