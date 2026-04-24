// contract:allow-interface — Repository interface defines behavior contract, not data shapes (SSOT = schema.ts)
import type { CreateScheduleInputZ, UpdateScheduleInputZ } from './schema';
import type { ScheduleItemCore } from './types';

/**
 * DateRange for schedule queries
 *
 * CRITICAL: Dates must be in site timezone (Asia/Tokyo)
 * - from/to: ISO 8601 strings representing date boundaries in JST
 * - Example: { from: '2026-02-24T00:00:00+09:00', to: '2026-03-03T00:00:00+09:00' }
 * - Always use site timezone to prevent UTC offset bugs in date filtering
 */
export type DateRange = {
  from: string;
  to: string;
};

/**
 * Schedule item type alias for consistency with repository pattern
 * Maps to existing ScheduleItemCore from domain types
 */
export type ScheduleItem = ScheduleItemCore;

/**
 * Backwards-compatible alias for consumers migrating from data/port.ts
 * SchedItem = ScheduleItemCore (domain canonical type)
 */
export type SchedItem = ScheduleItemCore;

/**
 * Input for creating a new schedule — SSOT derived from schema.ts
 */
export type CreateScheduleInput = CreateScheduleInputZ;

/**
 * Input for updating an existing schedule — SSOT derived from schema.ts
 */
export type UpdateScheduleInput = UpdateScheduleInputZ;

/**
 * Backwards-compatible aliases for consumers migrating from data/port.ts
 */
export type CreateScheduleEventInput = CreateScheduleInput;
export type UpdateScheduleEventInput = UpdateScheduleInput;

/**
 * Thrown when an update fails because the stored item's ETag no longer matches
 * (HTTP 412 Precondition Failed). Carries `status = 412` so `getHttpStatus`
 * utilities can recognize it after the underlying provider error is rewrapped.
 */
export class ScheduleConflictError extends Error {
  readonly status = 412;
  readonly code = 'SCHEDULE_CONFLICT';
  constructor(message = '予定が別のユーザーによって更新されました (conflict)。最新の情報に更新してから再度お試しください。') {
    super(message);
    this.name = 'ScheduleConflictError';
  }
}

/**
 * Parameters for listing schedules
 */
export type ScheduleRepositoryListParams = {
  range: DateRange;
  signal?: AbortSignal;
};

/**
 * Parameters for create/update/remove operations
 */
export type ScheduleRepositoryMutationParams = {
  signal?: AbortSignal;
};

/**
 * Schedule Repository Interface
 *
 * Abstracts schedule data access following the Repository Pattern.
 * Implementations: SharePointScheduleRepository, InMemoryScheduleRepository
 *
 * Timezone Handling:
 * - All date boundaries (DateRange) assume Asia/Tokyo timezone
 * - Consumers must format dates in site timezone before calling repository
 * - Repository implementations handle timezone-aware filtering
 */
export interface ScheduleRepository {
  /**
   * List schedules within a date range
   * @param params - Range and optional abort signal
   * @returns Promise of schedule items
   */
  list(params: ScheduleRepositoryListParams): Promise<ScheduleItem[]>;

  /**
   * Create a new schedule
   * @param input - Schedule creation data
   * @param params - Optional mutation parameters (signal)
   * @returns Promise of created schedule item
   */
  create(input: CreateScheduleInput, params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem>;

  /**
   * Update an existing schedule
   * @param input - Schedule update data with id
   * @param params - Optional mutation parameters (signal)
   * @returns Promise of updated schedule item
   */
  update(input: UpdateScheduleInput, params?: ScheduleRepositoryMutationParams): Promise<ScheduleItem>;

  /**
   * Remove a schedule by id
   * @param id - Schedule item id
   * @param params - Optional mutation parameters (signal)
   * @returns Promise that resolves when deletion is complete
   */
  remove(id: string, params?: ScheduleRepositoryMutationParams): Promise<void>;
}
