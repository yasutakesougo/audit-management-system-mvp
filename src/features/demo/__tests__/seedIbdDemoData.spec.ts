// ---------------------------------------------------------------------------
// seedIbdDemoData — IBDデモデータのシードテスト
// ---------------------------------------------------------------------------
import {
    getABCRecordsForUser,
    getLatestSPS,
    getSupervisionCounter,
    resetIBDStore,
} from '@/features/ibd/core/ibdStore';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedIbdDemoData } from '../loadMagicDemo';

describe('seedIbdDemoData', () => {
  beforeEach(() => {
    resetIBDStore();
  });

  it('populates SPS, supervision counter, and ABC records correctly', () => {
    const testUserId = 'U-001';
    const numericId = 1;

    const result = seedIbdDemoData(testUserId);

    // Return values
    expect(result.sps).toBe(1);
    expect(result.supervisionLogs).toBe(1);
    expect(result.abcRecords).toBe(2);

    // 1. SPS — confirmed with 5 positive conditions
    const latestSPS = getLatestSPS(numericId);
    expect(latestSPS).toBeDefined();
    expect(latestSPS?.status).toBe('confirmed');
    expect(latestSPS?.positiveConditions).toHaveLength(5);
    expect(latestSPS?.icebergModel.observableBehaviors.length).toBeGreaterThan(0);

    // 2. Supervision Counter — warning level (supportCount >= 1)
    const counter = getSupervisionCounter(numericId);
    expect(counter.supportCount).toBeGreaterThanOrEqual(1);

    // 3. ABC Records — 2 records with today's date
    const abcRecords = getABCRecordsForUser(testUserId);
    expect(abcRecords).toHaveLength(2);
    const today = new Date().toISOString().slice(0, 10);
    expect(abcRecords[0].recordedAt.slice(0, 10)).toBe(today);
    expect(abcRecords[1].recordedAt.slice(0, 10)).toBe(today);
  });

  it('is idempotent — calling twice still yields same counts', () => {
    seedIbdDemoData('U-001');
    seedIbdDemoData('U-001'); // second call

    const sps = getLatestSPS(1);
    expect(sps).toBeDefined();
    expect(sps?.status).toBe('confirmed');

    const abcRecords = getABCRecordsForUser('U-001');
    expect(abcRecords).toHaveLength(2); // not 4
  });

  it('returns zeroes for invalid userId', () => {
    const result = seedIbdDemoData('');
    expect(result).toEqual({ sps: 0, supervisionLogs: 0, abcRecords: 0 });
  });
});
