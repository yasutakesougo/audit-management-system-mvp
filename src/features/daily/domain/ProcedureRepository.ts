// contract:allow-interface — Repository interfaces define behavior contracts, not data shapes (SSOT = schema.ts)

/**
 * ProcedureStep — a single time-slot in a user's daily schedule.
 *
 * Mirrors `ScheduleItem` from `ProcedurePanel` but declared here
 * so the domain layer is self-contained without UI component imports.
 */
export type ProcedureStep = {
  id?: string;
  time: string;
  activity: string;
  instruction: string;
  isKey: boolean;
  /** BIP IDs linked to this time-slot. */
  linkedInterventionIds?: string[];
};

/**
 * Procedure Repository Interface
 *
 * Abstracts per-user schedule (timetable) access following the Repository Pattern.
 *
 * Implementations:
 * - LocalStorageProcedureRepository (via ProcedureStore / Zustand + localStorage)
 * - Future: SharePoint / REST API adapter
 *
 * Design note: methods are synchronous because the current localStorage-backed
 * store can serve data instantly. When an async adapter is introduced, the
 * interface will be extended with async variants while keeping the sync ones
 * for backward compatibility.
 */
export interface ProcedureRepository {
  /**
   * Get a user's procedure steps.
   *
   * Returns BASE_STEPS fallback when no custom schedule is registered.
   * Use `hasUserData()` to distinguish between explicit data and fallback.
   */
  getByUser(userId: string): ProcedureStep[];

  /**
   * Persist procedure steps for a user.
   *
   * @param userId - Target user
   * @param steps  - Complete list of steps (replaces existing)
   */
  save(userId: string, steps: ProcedureStep[]): void;

  /**
   * Check whether the user has explicitly registered schedule data.
   * If false, `getByUser()` returns the built-in BASE_STEPS fallback.
   */
  hasUserData?(userId: string): boolean;

  /**
   * List all user IDs that have explicitly registered schedules.
   */
  registeredUserIds?(): string[];
}
