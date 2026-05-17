import { describe, expect, it } from 'vitest';
import { mapPlanningSheetRowToDomain } from '../mapper';
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
