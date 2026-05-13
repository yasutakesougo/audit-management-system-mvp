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
  it('correctly calculates monthly bounds and calls getRecordsInRange with calculated bounds', async () => {
    const records: ExecutionRecord[] = [
      createMockRecord({ id: 'rec-1', date: '2026-05-01', status: 'completed' }),
      createMockRecord({ id: 'rec-2', date: '2026-05-15', status: 'completed' }),
      createMockRecord({ id: 'rec-3', date: '2026-05-31', status: 'triggered', memo: 'some incident' }),
    ];

    const mockRepository = {
      getRecords: vi.fn(),
      getRecord: vi.fn(),
      upsertRecord: vi.fn(),
      getCompletionRate: vi.fn(),
      getHistoricalRecords: vi.fn(),
      getRecordsInRange: vi.fn().mockResolvedValue(records),
    } satisfies ExecutionRecordRepository;

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
    const mockRepository = {
      getRecords: vi.fn(),
      getRecord: vi.fn(),
      upsertRecord: vi.fn(),
      getCompletionRate: vi.fn(),
      getHistoricalRecords: vi.fn(),
      getRecordsInRange: vi.fn().mockResolvedValue([]),
    } satisfies ExecutionRecordRepository;

    await executeKioskMonthlyAggregation(mockRepository, {
      userId: 'I001',
      displayName: 'Test User',
      yearMonth: '2025-11', // November has 30 days
    });

    expect(mockRepository.getRecordsInRange).toHaveBeenCalledWith('I001', '2025-11-01', '2025-11-30');
  });

  it('computes correct bounds for February in leap years and non-leap years', async () => {
    const mockRepository = {
      getRecords: vi.fn(),
      getRecord: vi.fn(),
      upsertRecord: vi.fn(),
      getCompletionRate: vi.fn(),
      getHistoricalRecords: vi.fn(),
      getRecordsInRange: vi.fn().mockResolvedValue([]),
    } satisfies ExecutionRecordRepository;

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
    const mockRepository = {
      getRecords: vi.fn(),
      getRecord: vi.fn(),
      upsertRecord: vi.fn(),
      getCompletionRate: vi.fn(),
      getHistoricalRecords: vi.fn(),
      getRecordsInRange: vi.fn().mockRejectedValue(new Error('Connection timeout to SharePoint')),
    } satisfies ExecutionRecordRepository;

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
});
