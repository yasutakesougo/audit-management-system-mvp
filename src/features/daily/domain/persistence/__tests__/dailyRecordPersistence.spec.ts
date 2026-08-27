import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_RECORD_PERSISTENCE_V1,
  assertCreatedParentIsSoleOwner,
  bindParentCommitSnapshot,
  buildCurrentVersionChildFilter,
  createDailyRecordCommitId,
  isParentCommitEtagConflictFromHttp,
  isParentStorageUniquenessConflictFromHttp,
  nextDailyRecordVersion,
  normalizeDailyRecordCommitId,
  normalizeParentEtag,
  ParentStorageUniquenessConflictError,
  readParentEtagFromItem,
  requireCommittedCurrentIdentity,
  resolveOrCreateParentForSave,
  resolveSnapshotBoundParentCommitIfMatch,
  resolveUniqueParentForDate,
} from '../dailyRecordPersistence';

describe('DAILY-RECORD-PERSISTENCE-V1', () => {
  it('locks append-version write rules and Version+CommitId commit identity', () => {
    expect(DAILY_RECORD_PERSISTENCE_V1.writeRule).toBe('APPEND_NEW_VERSION');
    expect(DAILY_RECORD_PERSISTENCE_V1.existingChildDelete).toBe('PROHIBITED');
    expect(DAILY_RECORD_PERSISTENCE_V1.commitPoint).toBe(
      'SupportRecord_Daily.LatestVersion+LatestCommitId',
    );
    expect(DAILY_RECORD_PERSISTENCE_V1.readRule).toBe('LATEST_VERSION_AND_COMMIT_ID');
    expect(DAILY_RECORD_PERSISTENCE_V1.integrityFailure).toBe('HOLD_UNKNOWN');
    expect(DAILY_RECORD_PERSISTENCE_V1.currentIdentity).toBe(
      'ParentID + LatestVersion + LatestCommitId',
    );
    expect(DAILY_RECORD_PERSISTENCE_V1.childCommitIdentity).toBe(
      'ParentID + Version + CommitId',
    );
  });

  it('advances from unset/legacy 0 to version 1', () => {
    expect(nextDailyRecordVersion(undefined)).toBe(1);
    expect(nextDailyRecordVersion(null)).toBe(1);
    expect(nextDailyRecordVersion(0)).toBe(1);
  });

  it('advances from a committed version', () => {
    expect(nextDailyRecordVersion(4)).toBe(5);
  });

  it('generates unique CommitIds per save attempt', () => {
    const a = createDailyRecordCommitId();
    const b = createDailyRecordCommitId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('reads only LatestVersion + LatestCommitId children when committed', () => {
    expect(
      buildCurrentVersionChildFilter('ParentID', 11, 'Version', 4, 'CommitId', 'commit-v4'),
    ).toBe("ParentID eq 11 and Version eq 4 and CommitId eq 'commit-v4'");
  });

  it('reads only unversioned legacy children when LatestVersion is 0 (no CommitId required)', () => {
    expect(buildCurrentVersionChildFilter('ParentID', 11, 'Version', 0)).toBe(
      'ParentID eq 11 and (Version eq 0 or Version eq null)',
    );
  });

  it('fails closed when LatestVersion > 0 but LatestCommitId is missing', () => {
    expect(() => requireCommittedCurrentIdentity(5, null)).toThrow(/LatestCommitId is missing/);
    expect(() => buildCurrentVersionChildFilter('ParentID', 11, 'Version', 5, 'CommitId', null))
      .toThrow(/LatestCommitId is missing/);
    expect(normalizeDailyRecordCommitId('  ')).toBeNull();
    expect(normalizeDailyRecordCommitId('retry-B')).toBe('retry-B');
  });

  it('enforces one parent per date and atomic resolve-or-create (AC-17, AC-18, AC-19)', () => {
    expect(DAILY_RECORD_PERSISTENCE_V1.parentUniqueness).toBe('ONE_PARENT_PER_DATE');
    expect(DAILY_RECORD_PERSISTENCE_V1.parentStorageUniqueness).toBe('TITLE_ENFORCE_UNIQUE_VALUES');
    expect(DAILY_RECORD_PERSISTENCE_V1.parentCreateRace).toBe(
      'ATOMIC_PRE_CREATE_GATE_STORAGE_CONFLICT_ADOPT_POST_CREATE_REVERIFY_FAIL_CLOSED',
    );
    expect(resolveUniqueParentForDate('2026-08-27', [])).toBeNull();
    expect(resolveUniqueParentForDate('2026-08-27', [{ id: 10 }])?.id).toBe(10);
    expect(() => resolveUniqueParentForDate('2026-08-27', [{ id: 10 }, { id: 11 }]))
      .toThrow(/Parent uniqueness violated/);
    expect(() => assertCreatedParentIsSoleOwner('2026-08-27', 11, [{ id: 10 }, { id: 11 }]))
      .toThrow(/Parent create-race/);
    expect(() => assertCreatedParentIsSoleOwner('2026-08-27', 10, [{ id: 10 }])).not.toThrow();
  });

  it('resolveOrCreateParentForSave uses pre-create gate before POST (AC-18)', async () => {
    let listCalls = 0;
    let createCalls = 0;

    const result = await resolveOrCreateParentForSave('2026-08-27', {
      listParents: async () => {
        listCalls += 1;
        if (listCalls === 1) return [];
        return [{ id: 10 }];
      },
      createParent: async () => {
        createCalls += 1;
        return { id: 99 };
      },
    });

    expect(result).toEqual({ parent: { id: 10 }, created: false });
    expect(listCalls).toBe(2);
    expect(createCalls).toBe(0);
  });

  it('resolveOrCreateParentForSave POSTs only when pre-create gate still empty', async () => {
    let listCalls = 0;

    const result = await resolveOrCreateParentForSave('2026-08-27', {
      listParents: async () => {
        listCalls += 1;
        if (listCalls <= 2) return [];
        return [{ id: 55 }];
      },
      createParent: async () => ({ id: 55 }),
    });

    expect(result).toEqual({ parent: { id: 55 }, created: true });
    expect(listCalls).toBe(3);
  });

  it('detects storage uniqueness conflicts from HTTP responses (AC-19)', () => {
    expect(isParentStorageUniquenessConflictFromHttp(409)).toBe(true);
    expect(isParentStorageUniquenessConflictFromHttp(400, 'duplicate value found for Title')).toBe(true);
    expect(isParentStorageUniquenessConflictFromHttp(400, 'Field not found')).toBe(false);
    expect(isParentStorageUniquenessConflictFromHttp(500, 'duplicate value')).toBe(false);
  });

  it('resolveOrCreateParentForSave adopts existing parent on storage conflict (AC-19)', async () => {
    let listCalls = 0;
    let createCalls = 0;

    const result = await resolveOrCreateParentForSave('2026-08-27', {
      listParents: async () => {
        listCalls += 1;
        if (listCalls <= 2) return [];
        return [{ id: 10 }];
      },
      createParent: async () => {
        createCalls += 1;
        throw new ParentStorageUniquenessConflictError('duplicate Title');
      },
    });

    expect(result).toEqual({ parent: { id: 10 }, created: false });
    expect(createCalls).toBe(1);
    expect(listCalls).toBe(3);
  });

  it('snapshot-bound parent commit contract (AC-20)', () => {
    expect(DAILY_RECORD_PERSISTENCE_V1.parentCommit).toBe('SNAPSHOT_BOUND_ETAG_CAS');
    expect(normalizeParentEtag(' "etag-1" ')).toBe('"etag-1"');
    expect(readParentEtagFromItem({ __metadata: { etag: '"etag-2"' } })).toBe('"etag-2"');
    const snapshot = bindParentCommitSnapshot({
      parentId: 42,
      created: false,
      latestVersion: 4,
      etag: '"etag-4"',
    });
    expect(resolveSnapshotBoundParentCommitIfMatch(snapshot)).toBe('"etag-4"');
    expect(() => bindParentCommitSnapshot({
      parentId: 90,
      created: true,
      latestVersion: 0,
      etag: null,
    })).toThrow(/Snapshot-bound CAS prohibits IF-MATCH '\*'/);
    expect(isParentCommitEtagConflictFromHttp(412)).toBe(true);
    expect(isParentCommitEtagConflictFromHttp(428)).toBe(true);
    expect(isParentCommitEtagConflictFromHttp(409)).toBe(true);
    expect(isParentCommitEtagConflictFromHttp(400, 'Precondition Failed')).toBe(true);
  });
});
