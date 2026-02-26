/**
 * Pure functions for synchronization guardrails (cooldown, backoff, skip rules).
 * These are used by hooks to ensure safe and predictable SharePoint/API syncing.
 */

/**
 * Calculates exponential backoff duration in milliseconds.
 * Formula: Math.min(base * 2^failureCount, cap)
 * Note: failureCount should start from 0 for the first attempt (0ms delay),
 * and increment on each subsequent failure.
 */
export function calculateBackoff(failureCount: number, baseMs: number = 1000, capMs: number = 60000): number {
  if (failureCount <= 0) return 0;
  // failureCount=1 -> baseMs * 2^0 = baseMs
  // failureCount=2 -> baseMs * 2^1 = 2*baseMs
  return Math.min(baseMs * Math.pow(2, failureCount - 1), capMs);
}

/**
 * Returns a timestamp (ms) for the next allowed sync attempt based on a fixed throttle.
 */
export function getNextCooldownTimestamp(throttleMs: number = 5000): number {
  return Date.now() + throttleMs;
}

/**
 * Predicate to determine if a sync attempt should be skipped.
 */
export function shouldSkipSync(
  isFeatureEnabled: boolean,
  isSharePointDisabled: boolean,
  cooldownUntil: number,
  now: number = Date.now()
): boolean {
  if (!isFeatureEnabled) return true;
  if (isSharePointDisabled) return true;
  if (now < cooldownUntil) return true;
  return false;
}

/**
 * Calculates the 'retryAfter' timestamp based on failure count and backoff rules.
 */
export function calculateRetryAfterTimestamp(failureCount: number, now: number = Date.now()): number {
  if (failureCount <= 0) return 0;
  return now + calculateBackoff(failureCount);
}
