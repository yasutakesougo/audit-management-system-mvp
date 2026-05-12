import type { ExecutionRecord, RecordStatus } from '@/features/daily/domain/executionRecordTypes';

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

function hasMemo(record: ExecutionRecord): boolean {
  return typeof record.memo === 'string' && record.memo.trim().length > 0;
}

function hasIncidentEvidence(record: ExecutionRecord, status: RecordStatus): boolean {
  return status === 'triggered' || (record.triggeredBipIds ?? []).length > 0;
}

function isEmptyKioskEvidence(record: ExecutionRecord, status: RecordStatus): boolean {
  return status === 'unrecorded' && !hasMemo(record) && !hasIncidentEvidence(record, status);
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

  const status = normalizeStatus(record.status);
  const isEmpty = isEmptyKioskEvidence(record, status);

  return {
    id: record.id,
    userId: record.userId,
    userName: '',
    recordDate,
    completed: status === 'completed',
    hasSpecialNotes: hasMemo(record),
    hasIncidents: hasIncidentEvidence(record, status),
    isEmpty,
    isSkipped: status === 'skipped',
    isTriggered: status === 'triggered',
    hasMemo: hasMemo(record),
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

  return {
    source: 'kiosk-execution',
    userId: target.userId,
    yearMonth: target.yearMonth,
    sourceRows: included.length,
    recordedRows: nonEmptyRecords.length,
    completedRows: included.filter(({ status }) => status === 'completed').length,
    triggeredRows: included.filter(({ status }) => status === 'triggered').length,
    skippedRows: included.filter(({ status }) => status === 'skipped').length,
    unrecordedRows: included.filter(({ dailyRecord }) => dailyRecord.isEmpty).length,
    memoRows: included.filter(({ dailyRecord }) => dailyRecord.hasSpecialNotes).length,
    incidentRows: included.filter(({ dailyRecord }) => dailyRecord.hasIncidents).length,
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
  }
): KioskMonthlyAggregationResult {
  const { userId, yearMonth, displayName, useWorkingDays, rowsPerDay } = options;
  const target = { userId, yearMonth };
  const { included, skippedRecords, errors } = collectKioskEvidenceRecords(records, target);
  const dailyRecords = included.map(({ dailyRecord }) => dailyRecord);
  const summary = aggregateMonthlySummary(userId, displayName, dailyRecords, yearMonth, {
    useWorkingDays,
    rowsPerDay,
    source: 'kiosk-execution',
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
