/**
 * DAILY-RECORD-PERSISTENCE-V1
 *
 * Canonical write contract for SupportRecord_Daily + DailyRecordRows.
 * @see docs/adr/ADR-025-daily-record-persistence-v1.md
 */
import { safeRandomUUID } from '@/lib/uuid';

export const DAILY_RECORD_PERSISTENCE_V1 = {
  id: 'DAILY-RECORD-PERSISTENCE-V1',
  status: 'ACCEPTED',
  canonicalParent: 'SupportRecord_Daily',
  canonicalRecordStore: 'DailyRecordRows',
  writeRule: 'APPEND_NEW_VERSION',
  existingChildDelete: 'PROHIBITED',
  /**
   * Parent commit identity is LatestVersion + LatestCommitId together.
   * Version alone is a logical revision number, not a commit identity.
   */
  commitPoint: 'SupportRecord_Daily.LatestVersion+LatestCommitId',
  readRule: 'LATEST_VERSION_AND_COMMIT_ID',
  integrityFailure: 'HOLD_UNKNOWN',
  currentIdentity: 'ParentID + LatestVersion + LatestCommitId',
  childCommitIdentity: 'ParentID + Version + CommitId',
  /** Exactly one SupportRecord_Daily row per RecordDate/Title. */
  parentUniqueness: 'ONE_PARENT_PER_DATE',
  /**
   * Atomic save-time parent resolution:
   * list → pre-create gate re-list → optional POST → post-create re-verify.
   * Pre-create gate switches to update when a concurrent create wins; never rely on stale null.
   */
  parentCreateRace: 'ATOMIC_PRE_CREATE_GATE_POST_CREATE_REVERIFY_FAIL_CLOSED',
} as const;

export function nextDailyRecordVersion(currentVersion: number | undefined | null): number {
  const normalized = typeof currentVersion === 'number' && currentVersion > 0 ? currentVersion : 0;
  return normalized + 1;
}

/** One unique id per save attempt. Survives retries and concurrent same-version races. */
export function createDailyRecordCommitId(): string {
  return safeRandomUUID();
}

export function normalizeDailyRecordCommitId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function escapeODataStringLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export type CommittedCurrentIdentity = {
  latestVersion: number;
  latestCommitId: string;
};

/**
 * When LatestVersion > 0, current identity requires LatestCommitId.
 * Missing LatestCommitId must fail closed — never fall back to Version-only rows.
 */
export function requireCommittedCurrentIdentity(
  latestVersion: number,
  latestCommitId: unknown,
): CommittedCurrentIdentity {
  if (!(latestVersion > 0)) {
    throw new Error(
      '[DAILY-RECORD-PERSISTENCE-V1] requireCommittedCurrentIdentity requires LatestVersion > 0.',
    );
  }
  const commitId = normalizeDailyRecordCommitId(latestCommitId);
  if (!commitId) {
    throw new Error(
      `[DAILY-RECORD-PERSISTENCE-V1] LatestVersion ${latestVersion} is set but LatestCommitId is missing. Version-only current reads are prohibited.`,
    );
  }
  return { latestVersion, latestCommitId: commitId };
}

/**
 * OData filter for children that are current under DAILY-RECORD-PERSISTENCE-V1.
 *
 * LatestVersion > 0 → ParentID + Version + CommitId (LatestCommitId).
 * LatestVersion = 0 → legacy unversioned rows (0 or null), CommitId not required.
 */
export function buildCurrentVersionChildFilter(
  parentIdField: string,
  parentId: number,
  versionField: string,
  latestVersion: number,
  commitIdField?: string,
  latestCommitId?: unknown,
): string {
  if (latestVersion > 0) {
    const identity = requireCommittedCurrentIdentity(latestVersion, latestCommitId);
    if (!commitIdField) {
      throw new Error(
        '[DAILY-RECORD-PERSISTENCE-V1] CommitId field name is required when LatestVersion > 0.',
      );
    }
    return (
      `${parentIdField} eq ${parentId}` +
      ` and ${versionField} eq ${identity.latestVersion}` +
      ` and ${commitIdField} eq '${escapeODataStringLiteral(identity.latestCommitId)}'`
    );
  }
  return `${parentIdField} eq ${parentId} and (${versionField} eq 0 or ${versionField} eq null)`;
}

export function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

export type ParentDateIdentity = {
  id: number;
};

/**
 * Parent uniqueness: at most one SupportRecord_Daily row per date Title.
 * 0 → create gate; 1 → unique existing; >1 → create-race / integrity failure.
 */
export function resolveUniqueParentForDate<T extends ParentDateIdentity>(
  date: string,
  parents: readonly T[],
): T | null {
  if (parents.length === 0) return null;
  if (parents.length === 1) return parents[0];
  const ids = parents.map((parent) => parent.id).join(', ');
  throw new Error(
    `[DAILY-RECORD-PERSISTENCE-V1] Parent uniqueness violated for date ${date}: ` +
    `found ${parents.length} parents (Ids: ${ids}). Create-race or duplicate Title. Fail closed.`,
  );
}

/**
 * After creating a parent, re-verify that the created Id is the sole parent for the date.
 * If a concurrent create also succeeded, abort before writing any children.
 */
export function assertCreatedParentIsSoleOwner(
  date: string,
  createdParentId: number,
  parents: readonly ParentDateIdentity[],
): void {
  if (parents.length === 1 && parents[0].id === createdParentId) {
    return;
  }
  const ids = parents.map((parent) => parent.id).join(', ');
  throw new Error(
    `[DAILY-RECORD-PERSISTENCE-V1] Parent create-race for date ${date}: ` +
    `created Id ${createdParentId} is not the sole parent (found Ids: ${ids || 'none'}). ` +
    `Aborting before child writes; duplicate parents are not deleted.`,
  );
}

export type ResolveOrCreateParentPorts<T extends ParentDateIdentity> = {
  listParents: () => Promise<readonly T[]>;
  createParent: () => Promise<T>;
};

export type ResolveOrCreateParentResult<T extends ParentDateIdentity> = {
  parent: T;
  /** True only when this save POSTed a new parent row. */
  created: boolean;
};

/**
 * Atomic parent uniqueness contract for save.
 *
 * 1. List all parents for date (fail-closed via listParents).
 * 2. Exactly one → update path.
 * 3. Zero → pre-create gate: re-list immediately before POST.
 *    - One found → concurrent winner; update path (no POST).
 *    - Still zero → POST create.
 * 4. Post-create re-verify sole ownership before any child writes.
 */
export async function resolveOrCreateParentForSave<T extends ParentDateIdentity>(
  date: string,
  ports: ResolveOrCreateParentPorts<T>,
): Promise<ResolveOrCreateParentResult<T>> {
  let parents = await ports.listParents();
  let unique = resolveUniqueParentForDate(date, parents);
  if (unique) {
    return { parent: unique, created: false };
  }

  // Pre-create atomic gate: narrow TOCTOU between initial list and POST.
  parents = await ports.listParents();
  unique = resolveUniqueParentForDate(date, parents);
  if (unique) {
    return { parent: unique, created: false };
  }

  const created = await ports.createParent();
  parents = await ports.listParents();
  assertCreatedParentIsSoleOwner(date, created.id, parents);

  return { parent: created, created: true };
}
