import { describe, expect, it } from 'vitest';

import { makeDailySnapshotId, parseDailySnapshotMetrics } from '../readDailySnapshot';

describe('readDailySnapshot helpers', () => {
  it('builds snapshot id from template/date/user', () => {
    expect(makeDailySnapshotId({
      templateId: 'daily-support.v1',
      targetDate: '2026-02-22',
      targetUserId: 'U001',
    })).toBe('daily-support.v1__2026-02-22__U001');
  });

  it('parses valid snapshot payload', () => {
    const parsed = parseDailySnapshotMetrics({
      completionRate: 0.9,
      leadTimeMinutes: 12,
      targetDate: '2026-02-22',
      targetUserId: 'U001',
    });

    expect(parsed).toEqual({
      completionRate: 0.9,
      leadTimeMinutes: 12,
      targetDate: '2026-02-22',
      targetUserId: 'U001',
    });
  });

  it('returns null for invalid payload', () => {
    expect(parseDailySnapshotMetrics(null)).toBeNull();
    expect(parseDailySnapshotMetrics({ completionRate: '0.9', leadTimeMinutes: 12 })).toBeNull();
    expect(parseDailySnapshotMetrics({ completionRate: 0.9 })).toBeNull();
  });
});
