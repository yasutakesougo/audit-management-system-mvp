/**
 * Drift Probe Target Contract
 *
 * Defines the minimum required information for a SharePoint list to be probed for schema drift.
 * This contract is used by both operational scripts (Nightly Patrol) and UI (DataIntegrityPage).
 */

export interface DriftProbeTarget {
  /** Internal key used for tracking and telemetry (e.g., 'users_master') */
  key: string;
  /** Human-readable name for UI and logs (e.g., '利用者マスタ') */
  displayName: string;
  /** Actual SharePoint list title (e.g., 'Users_Master') */
  listTitle: string;
  /** Fields to include in the $select query to detect drift/skip */
  selectFields: string[];
  /** Essential fields that MUST exist for basic list operation */
  essentialFields?: string[];
}
