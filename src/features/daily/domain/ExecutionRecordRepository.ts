// contract:allow-interface — Repository interfaces define behavior contracts, not data shapes (SSOT = executionRecordTypes.ts)

/**
 * Execution Record Repository Interface
 *
 * Abstracts per-user / per-date execution record access following the Repository Pattern.
 *
 * An ExecutionRecord captures the "Do" result for each ProcedureStep (schedule slot):
 *   - completed / triggered / skipped / unrecorded
 *
 * Implementations:
 * - LocalStorageExecutionAdapter (via ExecutionStore / Zustand + localStorage)
 * - Future: SharePoint / REST API adapter
 *
 * Design note: methods are synchronous because the current localStorage-backed
 * store can serve data instantly. When an async adapter is introduced, the
 * interface will be extended with async variants.
 *
 * @see executionRecordTypes.ts — Domain types and Zod schemas
 */
import type { ExecutionRecord } from './executionRecordTypes';

export interface ExecutionRecordRepository {
  /**
   * Get all execution records for a given date × user.
   */
  getRecords(date: string, userId: string): Promise<ExecutionRecord[]>;

  /**
   * Get a single execution record by date × user × scheduleItemId.
   * Returns undefined if not found.
   */
  getRecord(date: string, userId: string, scheduleItemId: string): Promise<ExecutionRecord | undefined>;

  /**
   * Insert or update an execution record.
   *
   * If a record with the same (date, userId, scheduleItemId) exists, it is replaced.
   * Otherwise a new record is appended.
   */
  upsertRecord(record: ExecutionRecord): Promise<void>;

  /**
   * Calculate completion rate for a date × user.
   *
   * @param totalSlots - Total number of schedule slots (from ProcedureStore)
   * @returns Object with completed count, triggered count, and rate (0–1)
   */
  getCompletionRate(
    date: string,
    userId: string,
    totalSlots: number,
  ): Promise<{ completed: number; triggered: number; rate: number }>;

  /**
   * Get historical records for a user and procedure across multiple dates.
   * Useful for trend analysis and historical previews.
   */
  getHistoricalRecords(userId: string, scheduleItemId: string, limit?: number): Promise<ExecutionRecord[]>;

  /**
   * Get all execution records for a user within a specific date range.
   * Useful for 90-day monitoring aggregation.
   */
  getRecordsInRange(userId: string, from: string, to: string): Promise<ExecutionRecord[]>;
}
