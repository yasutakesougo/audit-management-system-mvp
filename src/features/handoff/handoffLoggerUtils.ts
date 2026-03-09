/**
 * Handoff module — shared logger utilities
 *
 * Common helpers to avoid repetitive error formatting across the module.
 */

/** Extract a safe, serializable message from any thrown value. */
export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
