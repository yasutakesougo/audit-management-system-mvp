/**
 * DAILY-RECORD-PERSISTENCE-V1
 *
 * Canonical write contract for SupportRecord_Daily + DailyRecordRows.
 * @see docs/adr/ADR-025-daily-record-persistence-v1.md
 */
export const DAILY_RECORD_PERSISTENCE_V1 = {
  id: 'DAILY-RECORD-PERSISTENCE-V1',
  status: 'ACCEPTED',
  canonicalParent: 'SupportRecord_Daily',
  canonicalRecordStore: 'DailyRecordRows',
  writeRule: 'APPEND_NEW_VERSION',
  existingChildDelete: 'PROHIBITED',
  commitPoint: 'SupportRecord_Daily.LatestVersion',
  readRule: 'LATEST_VERSION_ONLY',
  integrityFailure: 'HOLD_UNKNOWN',
} as const;

export function nextDailyRecordVersion(currentVersion: number | undefined | null): number {
  const normalized = typeof currentVersion === 'number' && currentVersion > 0 ? currentVersion : 0;
  return normalized + 1;
}

/**
 * OData filter for children that are current under DAILY-RECORD-PERSISTENCE-V1.
 *
 * LatestVersion > 0 → only that version.
 * LatestVersion = 0 → legacy unversioned rows (0 or null), never pending higher versions.
 */
export function buildCurrentVersionChildFilter(
  parentIdField: string,
  parentId: number,
  versionField: string,
  latestVersion: number,
): string {
  if (latestVersion > 0) {
    return `${parentIdField} eq ${parentId} and ${versionField} eq ${latestVersion}`;
  }
  return `${parentIdField} eq ${parentId} and (${versionField} eq 0 or ${versionField} eq null)`;
}

export function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'TimeoutError';
}
