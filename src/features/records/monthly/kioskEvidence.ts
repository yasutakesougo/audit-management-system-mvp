import type { ExecutionRecord, RecordStatus } from '@/features/daily/domain/executionRecordTypes';
import {
  reconcileRecordStatus,
  hasRecordMemo,
} from '@/features/daily/domain/executionRecordReconciliation';

import { aggregateMonthlySummary } from './aggregate';
import type {
  DailyRecord,
  IsoDate,
  MonthlyAggregationResult,
  MonthlySummary,
  YearMonth,
} from './types';

const VALID_RECORD_STATUSES: readonly RecordStatus[] = [
  'completed',
  'triggered',
  'skipped',
  'unrecorded',
] as const;

export interface KioskMonthlyEvidenceStats {
  source: 'kiosk-execution';
  userId: string;
  yearMonth: YearMonth;
  /** Target-month kiosk rows resolved from execution evidence, including unrecorded rows. */
  sourceRows: number;
  /** Rows with actual evidence: completed / triggered / skipped / memo / BIP evidence. */
  recordedRows: number;
  completedRows: number;
  triggeredRows: number;
  skippedRows: number;
  unrecordedRows: number;
  memoRows: number;
  incidentRows: number;
  recordedDays: number;
  firstEntryDate?: IsoDate;
  lastEntryDate?: IsoDate;
}

export interface KioskMonthlyAggregationResult extends MonthlyAggregationResult {
  source: 'kiosk-execution';
  summary: MonthlySummary;
  /** DailyRecord[] actually passed into monthly aggregation. */
  dailyRecords: DailyRecord[];
  /** Reconciliation counters derived from the same kiosk evidence as summary.kpi. */
  evidence: KioskMonthlyEvidenceStats;
}

interface IncludedKioskRecord {
  sourceRecord: ExecutionRecord;
  dailyRecord: DailyRecord;
  status: RecordStatus;
}

interface KioskEvidenceTarget {
  userId: string;
  yearMonth: YearMonth;
}

function normalizeStatus(status: unknown): RecordStatus {
  return VALID_RECORD_STATUSES.includes(status as RecordStatus)
    ? (status as RecordStatus)
    : 'unrecorded';
}

function parseEvidenceIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== 'string') return null;
  if (!/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return null;
  }
  return value as IsoDate;
}

function getEvidenceYearMonth(date: IsoDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

/**
 * Convert one kiosk ExecutionRecord into the Monthly DailyRecord contract.
 *
 * Monthly aggregation treats kiosk statuses as follows:
 * - completed  -> completedRows
 * - triggered/skipped or memo-only rows -> inProgressRows (recorded, but not completed)
 * - unrecorded with no memo/BIP evidence -> empty evidence row
 */
export function toMonthlyDailyRecordFromKioskEvidence(record: ExecutionRecord): DailyRecord | null {
  const recordDate = parseEvidenceIsoDate(record.date);
  if (!recordDate) return null;

  const reconciled = reconcileRecordStatus(record);

  return {
    id: record.id,
    userId: record.userId,
    userName: '',
    recordDate,
    completed: reconciled === 'completed',
    hasSpecialNotes: hasRecordMemo(record),
    hasIncidents: reconciled === 'triggered',
    isEmpty: reconciled === 'empty',
    isSkipped: reconciled === 'skipped',
    isTriggered: reconciled === 'triggered',
    hasMemo: hasRecordMemo(record),
  };
}

function collectKioskEvidenceRecords(
  records: ExecutionRecord[],
  target: KioskEvidenceTarget
): { included: IncludedKioskRecord[]; skippedRecords: number; errors: string[] } {
  const included: IncludedKioskRecord[] = [];
  const errors: string[] = [];
  let skippedRecords = 0;

  for (const record of records) {
    if (record.userId !== target.userId) {
      skippedRecords++;
      continue;
    }

    const dailyRecord = toMonthlyDailyRecordFromKioskEvidence(record);
    if (!dailyRecord) {
      skippedRecords++;
      errors.push(`Invalid kiosk evidence date: record=${record.id}, date=${record.date}`);
      continue;
    }

    if (getEvidenceYearMonth(dailyRecord.recordDate) !== target.yearMonth) {
      skippedRecords++;
      continue;
    }

    included.push({
      sourceRecord: record,
      dailyRecord,
      status: normalizeStatus(record.status),
    });
  }

  return { included, skippedRecords, errors };
}

/**
 * Build the exact DailyRecord[] input used by monthly aggregation from kiosk execution evidence.
 */
export function buildMonthlyDailyRecordsFromKioskEvidence(
  records: ExecutionRecord[],
  target: KioskEvidenceTarget
): DailyRecord[] {
  return collectKioskEvidenceRecords(records, target).included.map(({ dailyRecord }) => dailyRecord);
}

function summarizeKioskMonthlyEvidence(
  included: IncludedKioskRecord[],
  target: KioskEvidenceTarget
): KioskMonthlyEvidenceStats {
  const nonEmptyRecords = included.filter(({ dailyRecord }) => !dailyRecord.isEmpty);
  const nonEmptyDates = [...new Set(nonEmptyRecords.map(({ dailyRecord }) => dailyRecord.recordDate))].sort();

  const reconciledStats = included.map(({ sourceRecord }) => reconcileRecordStatus(sourceRecord));

  return {
    source: 'kiosk-execution',
    userId: target.userId,
    yearMonth: target.yearMonth,
    sourceRows: included.length,
    recordedRows: nonEmptyRecords.length,
    completedRows: reconciledStats.filter(s => s === 'completed').length,
    triggeredRows: reconciledStats.filter(s => s === 'triggered').length,
    skippedRows: reconciledStats.filter(s => s === 'skipped').length,
    unrecordedRows: reconciledStats.filter(s => s === 'empty').length,
    memoRows: included.filter(({ sourceRecord }) => hasRecordMemo(sourceRecord)).length,
    incidentRows: reconciledStats.filter(s => s === 'triggered').length,
    recordedDays: nonEmptyDates.length,
    firstEntryDate: nonEmptyDates[0],
    lastEntryDate: nonEmptyDates[nonEmptyDates.length - 1],
  };
}

/**
 * Reconcile kiosk execution evidence with MonthlyRecord_Summary aggregation.
 *
 * This is the SSOT bridge for monthly aggregation from kiosk records: the summary KPI and
 * evidence counters are derived from the same filtered ExecutionRecord[] input.
 */
export function aggregateMonthlySummaryFromKioskEvidence(
  records: ExecutionRecord[],
  options: KioskEvidenceTarget & {
    displayName: string;
    useWorkingDays?: boolean;
    rowsPerDay?: number;
    contractWeekdays?: number[];
    holidays?: string[];
    absences?: string[];
  }
): KioskMonthlyAggregationResult {
  const {
    userId,
    yearMonth,
    displayName,
    useWorkingDays,
    rowsPerDay,
    contractWeekdays,
    holidays,
    absences,
  } = options;
  const target = { userId, yearMonth };
  const { included, skippedRecords, errors } = collectKioskEvidenceRecords(records, target);
  const dailyRecords = included.map(({ dailyRecord }) => dailyRecord);
  const summary = aggregateMonthlySummary(userId, displayName, dailyRecords, yearMonth, {
    useWorkingDays,
    rowsPerDay,
    source: 'kiosk-execution',
    contractWeekdays,
    holidays,
    absences,
  });

  return {
    source: 'kiosk-execution',
    summary,
    processedRecords: dailyRecords.length,
    skippedRecords,
    errors,
    dailyRecords,
    evidence: summarizeKioskMonthlyEvidence(included, target),
  };
}
