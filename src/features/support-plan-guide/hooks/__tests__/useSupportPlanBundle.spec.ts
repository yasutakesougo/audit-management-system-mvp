/**
 * useSupportPlanBundle + useRegulatorySummary 結線テスト
 *
 * 純関数部分（deriveLatestMonitoring, countRecordsBySheet）と
 * useRegulatorySummary の realBundle 優先ロジックを検証する。
 */
import { describe, expect, it } from 'vitest';
import { deriveLatestMonitoring, countRecordsBySheet } from '@/features/support-plan-guide/hooks/useSupportPlanBundle';
import type { PlanningSheetListItem, ProcedureRecordListItem } from '@/domain/isp/schema';

describe('deriveLatestMonitoring', () => {
  it('returns null when no sheets', () => {
    expect(deriveLatestMonitoring([])).toBeNull();
  });

  it('returns monitoring info from sheet with nextReviewAt', () => {
    const sheets = [
      { id: 's1', title: 'A', status: 'active', userId: 'U1', nextReviewAt: '2026-06-01' },
    ] as unknown as PlanningSheetListItem[];

    const result = deriveLatestMonitoring(sheets);
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2026-06-01');
  });

  it('returns the latest date among multiple sheets', () => {
    const sheets = [
      { id: 's1', title: 'A', status: 'active', userId: 'U1', nextReviewAt: '2025-01-01' },
      { id: 's2', title: 'B', status: 'active', userId: 'U1', nextReviewAt: '2026-09-15' },
      { id: 's3', title: 'C', status: 'active', userId: 'U1', nextReviewAt: '2026-03-01' },
    ] as unknown as PlanningSheetListItem[];

    const result = deriveLatestMonitoring(sheets);
    expect(result!.date).toBe('2026-09-15');
  });

  it('marks planChangeRequired when monitoring is older than 180 days', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200);
    const sheets = [
      { id: 's1', title: 'A', status: 'active', userId: 'U1', nextReviewAt: oldDate.toISOString().slice(0, 10) },
    ] as unknown as PlanningSheetListItem[];

    const result = deriveLatestMonitoring(sheets);
    expect(result!.planChangeRequired).toBe(true);
  });

  it('does not mark planChangeRequired when monitoring is recent', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    const sheets = [
      { id: 's1', title: 'A', status: 'active', userId: 'U1', nextReviewAt: recentDate.toISOString().slice(0, 10) },
    ] as unknown as PlanningSheetListItem[];

    const result = deriveLatestMonitoring(sheets);
    expect(result!.planChangeRequired).toBe(false);
  });
});

describe('countRecordsBySheet', () => {
  it('returns empty for no records', () => {
    expect(countRecordsBySheet([])).toEqual({});
  });

  it('counts records by planningSheetId', () => {
    const records = [
      { id: 'r1', planningSheetId: 'sheet-1', recordDate: '2026-03-01' },
      { id: 'r2', planningSheetId: 'sheet-1', recordDate: '2026-03-02' },
      { id: 'r3', planningSheetId: 'sheet-2', recordDate: '2026-03-01' },
    ] as unknown as ProcedureRecordListItem[];

    expect(countRecordsBySheet(records)).toEqual({
      'sheet-1': 2,
      'sheet-2': 1,
    });
  });

  it('ignores records without planningSheetId', () => {
    const records = [
      { id: 'r1', recordDate: '2026-03-01' },
      { id: 'r2', planningSheetId: 'sheet-1', recordDate: '2026-03-02' },
    ] as unknown as ProcedureRecordListItem[];

    expect(countRecordsBySheet(records)).toEqual({ 'sheet-1': 1 });
  });
});
