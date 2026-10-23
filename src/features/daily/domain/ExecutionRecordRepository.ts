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

export type ExecutionCandidateClassification =
  | { kind: 'absent' }
  | { kind: 'unique'; internalId: number; record: ExecutionRecord }
  | { kind: 'duplicate' }
  | { kind: 'mismatch' };

export class ExecutionTargetMismatchError extends Error {
  readonly code = 'EXECUTION_TARGET_MISMATCH';

  constructor() {
    super('EXECUTION_TARGET_MISMATCH');
    this.name = 'ExecutionTargetMismatchError';
  }
}

export type ExecutionRecordUpsertOptions = {
  /**
   * - merge: keep existing memo text and append a different incoming memo.
   * - overwrite: replace the memo with the incoming value.
   */
  memoMode?: 'merge' | 'overwrite';
};

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
   * Optional batched lookup for ordered user and procedure candidates.
   * Adapters that omit this method keep the per-candidate getRecord loop.
   * The first matching pair wins. Two or more distinct saved rows for that
   * pair reject the lookup instead of picking one.
   */
  getRecordForCandidates?(
    date: string,
    userIds: readonly string[],
    scheduleItemIds: readonly string[],
  ): Promise<ExecutionRecord | undefined>;

  /**
   * Classify every alias of the requested date, users, and procedures.
   * Fetch failures reject. Duplicate item ids and a unique row that does
   * not match the requested target are distinct from "no row".
   * Adapters that omit this method keep getRecordForCandidates / getRecord.
   */
  classifyExecutionCandidates?(
    date: string,
    userIds: readonly string[],
    scheduleItemIds: readonly string[],
  ): Promise<ExecutionCandidateClassification>;

  /**
   * Insert or update an execution record.
   *
   * If a record with the same (date, userId, scheduleItemId) exists, it is replaced.
   * Otherwise a new record is appended.
   */
  upsertRecord(record: ExecutionRecord, options?: ExecutionRecordUpsertOptions): Promise<void>;

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

  /**
   * Delete an execution record by date × user × scheduleItemId.
   */
  deleteRecord(date: string, userId: string, scheduleItemId: string): Promise<void>;
}
