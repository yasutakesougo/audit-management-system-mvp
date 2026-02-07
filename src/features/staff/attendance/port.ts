import { Result } from '@/shared/result';
import { StaffAttendance } from './types';

/**
 * Count summary for a specific date
 */
export type AttendanceCounts = {
  onDuty: number;
  out: number;
  absent: number;
  total: number;
};

/**
 * StaffAttendancePort: Interface for CRUD operations
 * Implementations: localStorage (Phase 3.1-A), SharePoint (Phase 3.1-B)
 *
 * Key strategy: "{YYYY-MM-DD}#{STAFF_ID}" (e.g., "2026-01-31#S001")
 */
export interface StaffAttendancePort {
  /**
   * Upsert: Create or update attendance record
   * @param a Staff attendance record
   * @returns ok(void) on success, err on failure
   */
  upsert(a: StaffAttendance): Promise<Result<void>>;

  /**
   * Remove: Delete attendance record by key
   * @param key Record key in format "{date}#{staffId}"
   * @returns ok(void) on success, err on failure
   */
  remove(key: string): Promise<Result<void>>;

  /**
   * Get by key: Retrieve single record
   * @param key Record key in format "{date}#{staffId}"
   * @returns ok(StaffAttendance | null) on success, err on failure
   */
  getByKey(key: string): Promise<Result<StaffAttendance | null>>;

  /**
   * List by date: Retrieve all records for a date
   * @param date Date in format "YYYY-MM-DD"
   * @returns ok(StaffAttendance[]) on success, err on failure
   */
  listByDate(date: string): Promise<Result<StaffAttendance[]>>;

  /**
   * List by date range: Retrieve records within a date range
   * @param from Start date in format "YYYY-MM-DD"
   * @param to End date in format "YYYY-MM-DD"
   * @param top Max results (default 200)
   * @returns ok(StaffAttendance[]) on success, err on failure
   */
  listByDateRange(from: string, to: string, top?: number): Promise<Result<StaffAttendance[]>>;

  /**
   * Count by date: Get aggregated statistics
   * @param date Date in format "YYYY-MM-DD"
   * @returns ok(AttendanceCounts) on success, err on failure
   */
  countByDate(date: string): Promise<Result<AttendanceCounts>>;
}
