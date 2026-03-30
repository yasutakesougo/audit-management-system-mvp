// contract:allow-interface — Repository interfaces define behavior contracts, not data shapes (SSOT = schema.ts)
import type { DailyRecordDomain } from '../schema';
import type { DailyIntegrityException } from '../integrity/dailyIntegrityChecker';

/**
 * DateRange for daily record queries
 *
 * CRITICAL: Dates must be in site timezone (Asia/Tokyo)
 * - startDate/endDate: ISO 8601 date strings (YYYY-MM-DD) representing dates in JST
 * - Example: { startDate: '2026-02-24', endDate: '2026-03-03' }
 * - Always use site timezone to prevent UTC offset bugs in date filtering
 */
export type DailyRecordDateRange = {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
};

/**
 * Input for approving a daily record
 */
export type ApproveRecordInput = {
  date: string;           // YYYY-MM-DD: target record date
  approverName: string;   // Name of the approver
  approverRole: string;   // Role of the approver
};

/**
 * Payload for saving a daily record — SSOT derived from schema.ts
 * @see DailyRecordDomainSchema in schema.ts
 */
export type SaveDailyRecordInput = DailyRecordDomain;

/**
 * Saved daily record item — SSOT derived from schema.ts + server metadata
 */
export type DailyRecordItem = DailyRecordDomain & {
  id?: string;                 // SharePoint item ID (if persisted)
  createdAt?: string;          // ISO 8601 timestamp
  modifiedAt?: string;         // ISO 8601 timestamp
  approvalStatus?: 'pending' | 'approved';  // Approval state
  approvedBy?: string;         // Approver name
  approvedAt?: string;         // ISO 8601 timestamp of approval
};

/**
 * Parameters for listing daily records
 */
export type DailyRecordRepositoryListParams = {
  range: DailyRecordDateRange;
  signal?: AbortSignal;
};

/**
 * Parameters for mutation operations (save)
 */
export type DailyRecordRepositoryMutationParams = {
  signal?: AbortSignal;
};

/**
 * Daily Record Repository Interface
 *
 * Abstracts daily record data access following the Repository Pattern.
 * Implementations: SharePointDailyRecordRepository, InMemoryDailyRecordRepository
 *
 * Timezone Handling:
 * - All date strings assume Asia/Tokyo timezone
 * - Date format: YYYY-MM-DD (e.g., '2026-02-24')
 * - Repository implementations handle timezone-aware filtering
 *
 * Data Model:
 * - A single daily record contains multiple user rows (bulk entry)
 * - Each row represents one user's activities for a specific date
 * - Reporter information is shared across all rows in a single submission
 */
export interface DailyRecordRepository {
  /**
   * Save a daily record with multiple user rows
   *
   * @param input - Daily record data including date, reporter, and user rows
   * @param params - Optional mutation parameters (abort signal)
   * @returns Promise that resolves when save is complete
   *
   * @remarks
   * - If a record for the same date+users exists, behavior depends on implementation
   * - SharePoint implementation may create new items or update existing ones
   * - InMemory implementation typically replaces existing records
   */
  save(input: SaveDailyRecordInput, params?: DailyRecordRepositoryMutationParams): Promise<void>;

  /**
   * Load a daily record for a specific date
   *
   * @param date - Target date in YYYY-MM-DD format (Asia/Tokyo)
   * @returns Promise of daily record data, or null if not found
   *
   * @remarks
   * - Returns the most recent submission if multiple records exist for the date
   * - May aggregate multiple SharePoint items into a single TableDailyRecordData
   */
  load(date: string): Promise<DailyRecordItem | null>;

  /**
   * List daily records within a date range
   *
   * @param params - Date range and optional abort signal
   * @returns Promise of daily record items
   *
   * @remarks
   * - Returns records sorted by date (newest first)
   * - Empty array if no records found in range
   * - May return partial results if signal is aborted
   */
  list(params: DailyRecordRepositoryListParams): Promise<DailyRecordItem[]>;

  /**
   * Approve a daily record for a specific date
   *
   * @param input - Approval input containing date and approver info
   * @param params - Optional mutation parameters (abort signal)
   * @returns Promise of the approved record item
   *
   * @remarks
   * - Sets the record status to 'approved' (承認済)
   * - Records the approver name, role, and timestamp
   * - Throws if the record for the given date does not exist
   */
  approve(input: ApproveRecordInput, params?: DailyRecordRepositoryMutationParams): Promise<DailyRecordItem>;

  /**
   * Scan integrity for a range of dates
   *
   * @param dates - Array of dates in YYYY-MM-DD format (Asia/Tokyo)
   * @param signal - Optional abort signal
   * @returns Promise of integrity exceptions detected
   */
  scanIntegrity(dates: string[], signal?: AbortSignal): Promise<DailyIntegrityException[]>;
}
