import { classifyErrorWithHint, type ErrorClassification, type ErrorKind, type SafeError } from '@/lib/errors';

/**
 * @deprecated Use `classifyErrorWithHint` from `@/lib/errors` directly.
 * This re-export exists for backward compatibility.
 */
export type SpSyncErrorKind = ErrorKind;

/**
 * @deprecated Use `ErrorClassification` from `@/lib/errors` directly.
 */
export type SpSyncErrorClassification = {
  errorKind: ErrorKind;
  hint: string;
};

/**
 * Classify SharePoint synchronization errors.
 *
 * @deprecated Use `classifyErrorWithHint` from `@/lib/errors` directly.
 * Kept for backward compatibility — delegates to the unified classifier.
 */
export function classifySpSyncError(err: SafeError | null | undefined): SpSyncErrorClassification {
  const { kind, hint } = classifyErrorWithHint(err);
  return { errorKind: kind, hint };
}
