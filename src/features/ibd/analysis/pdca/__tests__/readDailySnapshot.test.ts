import { describe, expect, it } from 'vitest';

import { makeDailySnapshotId, parseDailySnapshotMetrics } from '../readDailySnapshot';

const expected = {
  templateId: 'daily-support.v1',
  targetDate: '2026-02-22',
  targetUserId: 'U001',
};

const fakeTimestamp = () => ({
  toMillis: () => Date.now(),
});

describe('readDailySnapshot helpers', () => {
  it('builds snapshot id from template/date/user', () => {
    expect(makeDailySnapshotId({
      templateId: expected.templateId,
      targetDate: expected.targetDate,
      targetUserId: expected.targetUserId,
    })).toBe('daily-support.v1__2026-02-22__U001');
  });

  it('parses valid snapshot payload', () => {
    const parsed = parseDailySnapshotMetrics({
      templateId: expected.templateId,
      completionRate: 0.9,
      leadTimeMinutes: 12,
      targetDate: expected.targetDate,
      targetUserId: expected.targetUserId,
      createdAt: fakeTimestamp(),
      updatedAt: fakeTimestamp(),
    }, expected);

    expect(parsed).toEqual({
      status: 'ok',
      metrics: {
        completionRate: 0.9,
        leadTimeMinutes: 12,
        targetDate: '2026-02-22',
        targetUserId: 'U001',
      },
    });
  });

  it('returns null for invalid payload', () => {
    expect(parseDailySnapshotMetrics(null, expected)).toEqual({
      status: 'invalid',
      reason: 'snapshot payload is not an object',
    });
    expect(parseDailySnapshotMetrics({ completionRate: '0.9', leadTimeMinutes: 12 }, expected)).toEqual({
      status: 'invalid',
      reason: 'snapshot metrics are missing or not numeric',
    });
    expect(parseDailySnapshotMetrics({ completionRate: 0.9 }, expected)).toEqual({
      status: 'invalid',
      reason: 'snapshot metrics are missing or not numeric',
    });
  });

  it('returns invalid for identity mismatch', () => {
    expect(parseDailySnapshotMetrics({
      templateId: 'daily-support.v2',
      completionRate: 0.9,
      leadTimeMinutes: 12,
      targetDate: expected.targetDate,
      targetUserId: expected.targetUserId,
      createdAt: fakeTimestamp(),
      updatedAt: fakeTimestamp(),
    }, expected)).toEqual({
      status: 'invalid',
      reason: 'templateId mismatch: expected=daily-support.v1 actual=daily-support.v2',
    });
  });

  it('returns invalid for out-of-range metrics', () => {
    expect(parseDailySnapshotMetrics({
      templateId: expected.templateId,
      completionRate: 1.2,
      leadTimeMinutes: 12,
      targetDate: expected.targetDate,
      targetUserId: expected.targetUserId,
      createdAt: fakeTimestamp(),
      updatedAt: fakeTimestamp(),
    }, expected)).toEqual({
      status: 'invalid',
      reason: 'completionRate out of range: 1.2',
    });
  });
});
