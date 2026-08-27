import { describe, expect, it } from 'vitest';
import {
  DAILY_RECORD_PERSISTENCE_V1,
  assertCreatedParentIsSoleOwner,
  buildCurrentVersionChildFilter,
  createDailyRecordCommitId,
  nextDailyRecordVersion,
  normalizeDailyRecordCommitId,
  requireCommittedCurrentIdentity,
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

  it('enforces one parent per date and post-create sole ownership (AC-17)', () => {
    expect(DAILY_RECORD_PERSISTENCE_V1.parentUniqueness).toBe('ONE_PARENT_PER_DATE');
    expect(DAILY_RECORD_PERSISTENCE_V1.parentCreateRace).toBe('POST_CREATE_REVERIFY_FAIL_CLOSED');
    expect(resolveUniqueParentForDate('2026-08-27', [])).toBeNull();
    expect(resolveUniqueParentForDate('2026-08-27', [{ id: 10 }])?.id).toBe(10);
    expect(() => resolveUniqueParentForDate('2026-08-27', [{ id: 10 }, { id: 11 }]))
      .toThrow(/Parent uniqueness violated/);
    expect(() => assertCreatedParentIsSoleOwner('2026-08-27', 11, [{ id: 10 }, { id: 11 }]))
      .toThrow(/Parent create-race/);
    expect(() => assertCreatedParentIsSoleOwner('2026-08-27', 10, [{ id: 10 }])).not.toThrow();
  });
});
