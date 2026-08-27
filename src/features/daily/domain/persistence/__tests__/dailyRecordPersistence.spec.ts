import { describe, expect, it } from 'vitest';
import {
  DAILY_RECORD_PERSISTENCE_V1,
  buildCurrentVersionChildFilter,
  nextDailyRecordVersion,
} from '../dailyRecordPersistence';

describe('DAILY-RECORD-PERSISTENCE-V1', () => {
  it('locks append-version write rules', () => {
    expect(DAILY_RECORD_PERSISTENCE_V1.writeRule).toBe('APPEND_NEW_VERSION');
    expect(DAILY_RECORD_PERSISTENCE_V1.existingChildDelete).toBe('PROHIBITED');
    expect(DAILY_RECORD_PERSISTENCE_V1.commitPoint).toBe('SupportRecord_Daily.LatestVersion');
    expect(DAILY_RECORD_PERSISTENCE_V1.integrityFailure).toBe('HOLD_UNKNOWN');
  });

  it('advances from unset/legacy 0 to version 1', () => {
    expect(nextDailyRecordVersion(undefined)).toBe(1);
    expect(nextDailyRecordVersion(null)).toBe(1);
    expect(nextDailyRecordVersion(0)).toBe(1);
  });

  it('advances from a committed version', () => {
    expect(nextDailyRecordVersion(4)).toBe(5);
  });

  it('reads only LatestVersion children when committed', () => {
    expect(buildCurrentVersionChildFilter('ParentID', 11, 'Version', 4)).toBe(
      'ParentID eq 11 and Version eq 4',
    );
  });

  it('reads only unversioned legacy children when LatestVersion is 0', () => {
    expect(buildCurrentVersionChildFilter('ParentID', 11, 'Version', 0)).toBe(
      'ParentID eq 11 and (Version eq 0 or Version eq null)',
    );
  });
});
