/**
 * deriveLastRecordDate.spec.ts
 *
 * useSupportPlanBundle の deriveLastRecordDate ヘルパーのテスト。
 */
import { describe, it, expect } from 'vitest';
import { deriveLastRecordDate } from '@/features/support-plan-guide/hooks/useSupportPlanBundle';
import type { ProcedureRecordListItem } from '@/domain/isp/schema';

describe('deriveLastRecordDate', () => {
  it('returns null for empty records', () => {
    expect(deriveLastRecordDate([])).toBeNull();
  });

  it('returns the single record date', () => {
    const records = [
      { id: 'r1', userId: 'U1', planningSheetId: 'sheet-1', recordDate: '2026-03-01', executionStatus: 'done', performedBy: 'S1' },
    ] as ProcedureRecordListItem[];
    expect(deriveLastRecordDate(records)).toBe('2026-03-01');
  });

  it('returns the latest date among multiple records', () => {
    const records = [
      { id: 'r1', userId: 'U1', planningSheetId: 'sheet-1', recordDate: '2026-03-01', executionStatus: 'done', performedBy: 'S1' },
      { id: 'r2', userId: 'U1', planningSheetId: 'sheet-1', recordDate: '2026-03-10', executionStatus: 'done', performedBy: 'S1' },
      { id: 'r3', userId: 'U1', planningSheetId: 'sheet-2', recordDate: '2026-03-05', executionStatus: 'done', performedBy: 'S1' },
    ] as ProcedureRecordListItem[];
    expect(deriveLastRecordDate(records)).toBe('2026-03-10');
  });

  it('handles records across multiple sheets', () => {
    const records = [
      { id: 'r1', userId: 'U1', planningSheetId: 'sheet-1', recordDate: '2026-02-28', executionStatus: 'done', performedBy: 'S1' },
      { id: 'r2', userId: 'U1', planningSheetId: 'sheet-2', recordDate: '2026-03-15', executionStatus: 'planned', performedBy: 'S2' },
    ] as ProcedureRecordListItem[];
    expect(deriveLastRecordDate(records)).toBe('2026-03-15');
  });
});
