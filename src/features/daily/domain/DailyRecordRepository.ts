// contract:allow-interface — Repository interfaces define behavior contracts, not data shapes (SSOT = schema.ts)
import type { 
  ApproveRecordInput, 
  DailyRecordDateRange, 
  DailyRecordDomain, 
  DailyRecordItem 
} from './schema';

export type { 
  ApproveRecordInput, 
  DailyRecordDateRange, 
  DailyRecordDomain, 
  DailyRecordItem 
};

/**
 * Payload for saving a daily record — SSOT derived from schema.ts
 */
export type SaveDailyRecordInput = DailyRecordDomain;

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
 */
export interface DailyRecordRepository {
  /**
   * Save a daily record with multiple user rows
   */
  save(input: SaveDailyRecordInput, params?: DailyRecordRepositoryMutationParams): Promise<void>;

  /**
   * Load a daily record for a specific date
   */
  load(date: string): Promise<DailyRecordItem | null>;

  /**
   * List daily records within a date range
   */
  list(params: DailyRecordRepositoryListParams): Promise<DailyRecordItem[]>;

  /**
   * Approve a daily record for a specific date
   */
  approve(input: ApproveRecordInput, params?: DailyRecordRepositoryMutationParams): Promise<DailyRecordItem>;

  /**
   * Scan daily records for integrity issues
   */
  scanIntegrity(dates: string[], signal?: AbortSignal): Promise<import('./integrity/dailyIntegrityChecker').DailyIntegrityException[]>;
}
