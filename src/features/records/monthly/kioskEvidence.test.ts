import { describe, expect, it } from 'vitest';

import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';

import {
  aggregateMonthlySummaryFromKioskEvidence,
  buildMonthlyDailyRecordsFromKioskEvidence,
  toMonthlyDailyRecordFromKioskEvidence,
} from './kioskEvidence';
import { aggregateKioskRecords } from '@/features/monitoring/domain/monitoringKioskAnalytics';

function record(overrides: Partial<ExecutionRecord>): ExecutionRecord {
  return {
    id: '2026-05-01-I001-row-1',
    date: '2026-05-01',
    userId: 'I001',
    scheduleItemId: 'row-1',
    status: 'completed',
    triggeredBipIds: [],
    memo: '',
    recordedBy: 'staff-1',
    recordedAt: '2026-05-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('monthly kiosk evidence bridge', () => {
  it('converts kiosk execution status into the monthly DailyRecord contract', () => {
    expect(toMonthlyDailyRecordFromKioskEvidence(record({ status: 'completed' }))).toEqual(
      expect.objectContaining({ completed: true, isEmpty: false, hasIncidents: false })
    );

    expect(toMonthlyDailyRecordFromKioskEvidence(record({ status: 'triggered', triggeredBipIds: ['bip-1'] }))).toEqual(
      expect.objectContaining({ completed: false, isEmpty: false, hasIncidents: true })
    );

    expect(toMonthlyDailyRecordFromKioskEvidence(record({ status: 'unrecorded', memo: '' }))).toEqual(
      expect.objectContaining({ completed: false, isEmpty: true })
    );

    expect(toMonthlyDailyRecordFromKioskEvidence(record({ date: '2026-13-01' }))).toBeNull();
  });

  it('filters by target user and month before passing records to monthly aggregation', () => {
    const dailyRecords = buildMonthlyDailyRecordsFromKioskEvidence([
      record({ id: 'a', date: '2026-05-01', userId: 'I001' }),
      record({ id: 'b', date: '2026-05-02', userId: 'I002' }),
      record({ id: 'c', date: '2026-06-01', userId: 'I001' }),
    ], {
      userId: 'I001',
      yearMonth: '2026-05',
    });

    expect(dailyRecords.map(r => r.id)).toEqual(['a']);
  });

  it('builds a monthly summary and evidence counters from the same kiosk records', () => {
    const result = aggregateMonthlySummaryFromKioskEvidence([
      record({ id: 'completed-1', date: '2026-05-01', scheduleItemId: 'row-1', status: 'completed', memo: '順調' }),
      record({ id: 'triggered-1', date: '2026-05-01', scheduleItemId: 'row-2', status: 'triggered', triggeredBipIds: ['bip-1'] }),
      record({ id: 'skipped-1', date: '2026-05-02', scheduleItemId: 'row-3', status: 'skipped', memo: '外出のため' }),
      record({ id: 'empty-1', date: '2026-05-03', scheduleItemId: 'row-4', status: 'unrecorded', memo: '' }),
      record({ id: 'other-user', date: '2026-05-01', userId: 'I002', status: 'completed' }),
      record({ id: 'other-month', date: '2026-06-01', userId: 'I001', status: 'completed' }),
      record({ id: 'bad-date', date: 'bad-date', userId: 'I001', status: 'completed' }),
    ], {
      userId: 'I001',
      displayName: '利用者A',
      yearMonth: '2026-05',
      useWorkingDays: false,
      rowsPerDay: 1,
    });

    expect(result.source).toBe('kiosk-execution');
    expect(result.processedRecords).toBe(4);
    expect(result.skippedRecords).toBe(3);
    expect(result.errors).toEqual(['Invalid kiosk evidence date: record=bad-date, date=bad-date']);

    expect(result.summary.kpi).toEqual({
      totalDays: 31,
      plannedRows: 31,
      completedRows: 1,
      inProgressRows: 2,
      emptyRows: 28,
      specialNotes: 2,
      incidents: 1,
      skippedRows: 1,
      triggeredRows: 1,
      memoRows: 2,
      source: 'kiosk-execution',
    });

    expect(result.evidence).toEqual({
      source: 'kiosk-execution',
      userId: 'I001',
      yearMonth: '2026-05',
      sourceRows: 4,
      recordedRows: 3,
      completedRows: 1,
      triggeredRows: 1,
      skippedRows: 1,
      unrecordedRows: 1,
      memoRows: 2,
      incidentRows: 1,
      recordedDays: 2,
      firstEntryDate: '2026-05-01',
      lastEntryDate: '2026-05-02',
    });

    expect(result.summary.firstEntryDate).toBe(result.evidence.firstEntryDate);
    expect(result.summary.lastEntryDate).toBe(result.evidence.lastEntryDate);
    expect(result.summary.kpi.completedRows).toBe(result.evidence.completedRows);
    expect(result.summary.kpi.skippedRows).toBe(result.evidence.skippedRows);
    expect(result.summary.kpi.triggeredRows).toBe(result.evidence.triggeredRows);
    expect(result.summary.kpi.memoRows).toBe(result.evidence.memoRows);
    expect(result.summary.kpi.incidents).toBe(result.evidence.incidentRows);
  });

  it('guarantees SSOT reconciliation: monthly KPI/evidence counts align perfectly with monitoring digest summary', () => {
    const rawRecords = [
      record({ id: 'r1', date: '2026-05-01', scheduleItemId: 'row-1', status: 'completed', memo: '順調' }),
      record({ id: 'r2', date: '2026-05-01', scheduleItemId: 'row-2', status: 'triggered', triggeredBipIds: ['bip-1'] }),
      record({ id: 'r3', date: '2026-05-02', scheduleItemId: 'row-3', status: 'skipped', memo: '本人拒否' }),
      record({ id: 'r4', date: '2026-05-03', scheduleItemId: 'row-1', status: 'unrecorded', memo: 'スタッフ代行' }), // unrecorded but has memo
      record({ id: 'r5', date: '2026-05-04', scheduleItemId: 'row-2', status: 'unrecorded', memo: '' }), // empty
    ];

    // 1. Calculate Monthly summary & evidence
    const monthlyResult = aggregateMonthlySummaryFromKioskEvidence(rawRecords, {
      userId: 'I001',
      displayName: '利用者A',
      yearMonth: '2026-05',
      useWorkingDays: false,
      rowsPerDay: 1,
    });

    // 2. Calculate Monitoring summary
    const monitoringResult = aggregateKioskRecords(rawRecords, {
      userId: 'I001',
      from: '2026-05-01',
      to: '2026-05-31',
    });

    // 3. Sum up counts from monitoring procedures
    let totalCompleted = 0;
    let totalTriggered = 0;
    let totalSkipped = 0;
    let totalMemo = 0;

    for (const p of monitoringResult.procedures) {
      totalCompleted += p.completedCount;
      totalTriggered += p.triggeredCount;
      totalSkipped += p.skippedCount;
      totalMemo += p.memoCount;
    }

    // 4. Assert perfect alignment
    expect(monthlyResult.evidence.completedRows).toBe(totalCompleted);
    expect(monthlyResult.evidence.triggeredRows).toBe(totalTriggered);
    expect(monthlyResult.evidence.skippedRows).toBe(totalSkipped);
    expect(monthlyResult.evidence.memoRows).toBe(totalMemo);

    expect(monthlyResult.summary.kpi.completedRows).toBe(totalCompleted);
    expect(monthlyResult.summary.kpi.triggeredRows).toBe(totalTriggered);
    expect(monthlyResult.summary.kpi.skippedRows).toBe(totalSkipped);
    expect(monthlyResult.summary.kpi.memoRows).toBe(totalMemo);
  });
});
