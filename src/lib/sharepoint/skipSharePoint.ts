/**
 * Centralized Guard -1 logic for SharePoint skip scenarios.
 * 
 * Provides a single source of truth for determining whether to skip SharePoint operations,
 * with consistent logging across all stores.
 * 
 * Guard -1 prevents in-flight Promise creation, module-scope cache pollution, and redundant API calls
 * in non-SharePoint contexts (demo, test, skip-login, automation, missing credentials).
 */

import { IS_SKIP_SHAREPOINT } from '@/lib/env';

export type SkipSharePointReason =
  | 'demo'
  | 'skip-login'
  | 'no-base-url'
  | 'automation'
  | 'unknown';

/**
 * Determines if SharePoint operations should be skipped.
 * 
 * @returns true if SharePoint operations should be skipped, false otherwise
 */
export function shouldSkipSharePoint(): boolean {
  return IS_SKIP_SHAREPOINT === true;
}

/**
 * Get the reason why SharePoint is being skipped (for logging).
 * 
 * @returns Reason code for logging/debugging
 */
export function getSkipSharePointReason(): SkipSharePointReason {
  // Try to determine which specific condition caused the skip
  // Note: We can't import specific flags here without circular deps,
  // so we return the most likely reason or 'unknown'
  return 'unknown';
}

/**
 * Log message helper for Guard -1 skip events.
 * 
 * @param storeName - Name of the store (e.g., 'useUsersStore', 'useStaffStore')
 * @param reason - Optional reason for skipping
 */
export function logSkipSharePointGuard(storeName: string, reason?: SkipSharePointReason): void {
  const reasonStr = reason ? ` (${reason})` : '';
  console.info(`[skip-sharepoint] Guard -1: ${storeName} using fallback${reasonStr}`);
}
