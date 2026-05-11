import type { ExecutionRecordRepository } from '@/features/daily/domain/ExecutionRecordRepository';
import { getTotalDaysInMonth } from './aggregate';
import {
  aggregateMonthlySummaryFromKioskEvidence,
  type KioskMonthlyAggregationResult,
} from './kioskEvidence';
import type { YearMonth } from './types';

export interface KioskMonthlyAggregationParams {
  userId: string;
  displayName: string;
  yearMonth: YearMonth;
  useWorkingDays?: boolean;
  rowsPerDay?: number;
}

/**
 * Use case to aggregate kiosk execution evidence into a monthly record summary.
 *
 * This coordinates retrieving raw kiosk evidence from the repository for the target
 * month range and passing it to the pure alignment layer to generate the MonthlySummary.
 */
export async function executeKioskMonthlyAggregation(
  repository: ExecutionRecordRepository,
  params: KioskMonthlyAggregationParams
): Promise<KioskMonthlyAggregationResult> {
  const { userId, displayName, yearMonth, useWorkingDays, rowsPerDay } = params;

  // 1. Calculate from/to date range for the target YearMonth (inclusive)
  const totalDays = getTotalDaysInMonth(yearMonth);
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-${totalDays}`;

  try {
    // 2. Fetch all execution records within the date range
    const records = await repository.getRecordsInRange(userId, from, to);

    // 3. Delegate to the pure alignment layer to produce the reconciled monthly summary
    return aggregateMonthlySummaryFromKioskEvidence(records, {
      userId,
      yearMonth,
      displayName,
      useWorkingDays,
      rowsPerDay,
    });
  } catch (error) {
    // Return a graceful failure result in case of repository or system errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      source: 'kiosk-execution',
      summary: {
        userId,
        yearMonth,
        displayName,
        lastUpdatedUtc: new Date().toISOString(),
        kpi: {
          totalDays: 0,
          plannedRows: 0,
          completedRows: 0,
          inProgressRows: 0,
          emptyRows: 0,
          specialNotes: 0,
          incidents: 0,
        },
        completionRate: 0,
      },
      processedRecords: 0,
      skippedRecords: 0,
      errors: [errorMessage],
      dailyRecords: [],
      evidence: {
        source: 'kiosk-execution',
        userId,
        yearMonth,
        sourceRows: 0,
        recordedRows: 0,
        completedRows: 0,
        triggeredRows: 0,
        skippedRows: 0,
        unrecordedRows: 0,
        memoRows: 0,
        incidentRows: 0,
        recordedDays: 0,
      },
    };
  }
}
