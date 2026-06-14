import { describe, expect, it, vi } from 'vitest';

import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type { ExecutionRecordRepository } from '@/features/daily/domain/ExecutionRecordRepository';
import { executeKioskMonthlyAggregation } from './kioskMonthlyAggregationUseCase';

function createMockRecord(overrides: Partial<ExecutionRecord>): ExecutionRecord {
  return {
    id: 'test-id',
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

describe('executeKioskMonthlyAggregation use case', () => {
  const createMockRepository = (
    recordsResult: Promise<ExecutionRecord[]> = Promise.resolve([]),
  ): ExecutionRecordRepository => ({
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    upsertRecord: vi.fn(),
    getCompletionRate: vi.fn(),
    getHistoricalRecords: vi.fn(),
    getRecordsInRange: vi.fn().mockReturnValue(recordsResult),
    deleteRecord: vi.fn(),
  });

  it('correctly calculates monthly bounds and calls getRecordsInRange with calculated bounds', async () => {
    const records: ExecutionRecord[] = [
      createMockRecord({ id: 'rec-1', date: '2026-05-01', status: 'completed' }),
      createMockRecord({ id: 'rec-2', date: '2026-05-15', status: 'completed' }),
      createMockRecord({ id: 'rec-3', date: '2026-05-31', status: 'triggered', memo: 'some incident' }),
    ];

    const mockRepository = createMockRepository(Promise.resolve(records));

    const result = await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2026-05',
      useWorkingDays: false,
      rowsPerDay: 1,
    });

    // 1. Verify bounds computed from YearMonth (2026-05 has 31 days)
    expect(mockRepository.getRecordsInRange).toHaveBeenCalledWith('I001', '2026-05-01', '2026-05-31');

    // 2. Verify aggregation results are mapped correctly
    expect(result.source).toBe('kiosk-execution');
    expect(result.processedRecords).toBe(3);
    expect(result.summary.userId).toBe('I001');
    expect(result.summary.displayName).toBe('Test User');
    expect(result.summary.yearMonth).toBe('2026-05');
    
    // 3. Verify KPI and Evidence alignment
    expect(result.summary.kpi).toEqual({
      totalDays: 31,
      plannedRows: 31,
      completedRows: 2,
      inProgressRows: 1,
      emptyRows: 28,
      specialNotes: 1,
      incidents: 1,
      skippedRows: 0,
      triggeredRows: 1,
      memoRows: 1,
      source: 'kiosk-execution',
    });

    expect(result.evidence).toEqual({
      source: 'kiosk-execution',
      userId: 'I001',
      yearMonth: '2026-05',
      sourceRows: 3,
      recordedRows: 3,
      completedRows: 2,
      triggeredRows: 1,
      skippedRows: 0,
      unrecordedRows: 0,
      memoRows: 1,
      incidentRows: 1,
      recordedDays: 3,
      firstEntryDate: '2026-05-01',
      lastEntryDate: '2026-05-31',
    });
  });

  it('computes correct bounds for 30-day months (e.g. November)', async () => {
    const mockRepository = createMockRepository();

    await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2025-11', // November has 30 days
    });

    expect(mockRepository.getRecordsInRange).toHaveBeenCalledWith('I001', '2025-11-01', '2025-11-30');
  });

  it('computes correct bounds for February in leap years and non-leap years', async () => {
    const mockRepository = createMockRepository();

    // 2024 is a leap year (29 days)
    await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2024-02',
    });
    expect(mockRepository.getRecordsInRange).toHaveBeenCalledWith('I001', '2024-02-01', '2024-02-29');

    // 2025 is not a leap year (28 days)
    await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2025-02',
    });
    expect(mockRepository.getRecordsInRange).toHaveBeenCalledWith('I001', '2025-02-01', '2025-02-28');
  });

  it('handles database/repository exceptions gracefully', async () => {
    const mockRepository = createMockRepository(
      Promise.reject(new Error('Connection timeout to SharePoint')),
    );

    const result = await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2026-05',
    });

    expect(result.source).toBe('kiosk-execution');
    expect(result.processedRecords).toBe(0);
    expect(result.errors).toEqual(['Connection timeout to SharePoint']);
    expect(result.summary.userId).toBe('I001');
    expect(result.summary.displayName).toBe('Test User');
    expect(result.summary.kpi.plannedRows).toBe(0);
    expect(result.evidence.sourceRows).toBe(0);
  });

  it('applies contractWeekdays, holidays, and absences to limit plannedRows calculation', async () => {
    const mockRepository = createMockRepository(); // No records found

    // In May 2026:
    // contractWeekdays: [1, 3, 5] (Mon, Wed, Fri) -> Usually 13 days (1, 4, 6, 8, 11, 13, 15, 18, 20, 22, 25, 27, 29)
    // holidays: ['2026-05-04', '2026-05-05', '2026-05-06'] -> Mon (4), Tue (5), Wed (6). Overlapping on contract weekdays: 4 (Mon) and 6 (Wed)
    // absences: ['2026-05-15'] -> 15 (Fri). Overlapping on contract weekdays: 15 (Fri)
    // Net contract days = 13 total - 2 holidays - 1 absence = 10 days
    const result = await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2026-05',
      useWorkingDays: true,
      rowsPerDay: 10,
      contractWeekdays: [1, 3, 5],
      holidays: ['2026-05-04', '2026-05-05', '2026-05-06'],
      absences: ['2026-05-15'],
    });

    // 10 contract days * 10 rows per day = 100 planned rows
    expect(result.summary.kpi.plannedRows).toBe(100);
  });
});
