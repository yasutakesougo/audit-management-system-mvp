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
 * Input for creating a new schedule
 */
export type CreateScheduleInput = {
  title: string;
  category: 'User' | 'Staff' | 'Org';
  startLocal: string;
  endLocal: string;
  serviceType?: string | null;
  userId?: string;
  userLookupId?: string;
  userName?: string;
  assignedStaffId?: string;
  locationName?: string;
  notes?: string;
  vehicleId?: string;
  status?: 'Planned' | 'Postponed' | 'Cancelled';
  statusReason?: string | null;
  acceptedOn?: string | null;
  acceptedBy?: string | null;
  acceptedNote?: string | null;
  ownerUserId?: string;
  visibility?: 'org' | 'team' | 'private';
  currentOwnerUserId?: string;
};

/**
 * Input for updating an existing schedule
 */
export type UpdateScheduleInput = CreateScheduleInput & {
  id: string;
  etag?: string; // For optimistic concurrency control
};

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
