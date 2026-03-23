import { describe, expect, it } from 'vitest';
import {
  computeStatusDelta,
  formatDeltaText,
  type DaySnapshot,
  type StatusDelta,
} from '../computeStatusDelta';

// ─── Helpers ─────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<DaySnapshot> = {}): DaySnapshot {
  return {
    pendingCount: 5,
    absenceCount: 1,
    feverCount: 0,
    urgentCount: 0,
    ...overrides,
  };
}

// ─── computeStatusDelta ──────────────────────────────────────

describe('computeStatusDelta', () => {
  it('returns null when yesterday is null', () => {
    const today = makeSnapshot();
    expect(computeStatusDelta(today, null)).toBeNull();
  });

  it('returns null when yesterday is undefined', () => {
    const today = makeSnapshot();
    expect(computeStatusDelta(today, undefined)).toBeNull();
  });

  it('returns zero deltas when today equals yesterday', () => {
    const snapshot = makeSnapshot();
    const result = computeStatusDelta(snapshot, snapshot);
    expect(result).toEqual({
      pendingDelta: 0,
      absenceDelta: 0,
      feverDelta: 0,
      urgentDelta: 0,
    });
  });

  it('returns positive deltas when situation worsened', () => {
    const today = makeSnapshot({ pendingCount: 10, absenceCount: 3 });
    const yesterday = makeSnapshot({ pendingCount: 5, absenceCount: 1 });
    const result = computeStatusDelta(today, yesterday);
    expect(result).toEqual({
      pendingDelta: 5,
      absenceDelta: 2,
      feverDelta: 0,
      urgentDelta: 0,
    });
  });

  it('returns negative deltas when situation improved', () => {
    const today = makeSnapshot({ pendingCount: 2, absenceCount: 0 });
    const yesterday = makeSnapshot({ pendingCount: 8, absenceCount: 3 });
    const result = computeStatusDelta(today, yesterday);
    expect(result).toEqual({
      pendingDelta: -6,
      absenceDelta: -3,
      feverDelta: 0,
      urgentDelta: 0,
    });
  });

  it('computes fever and urgent deltas correctly', () => {
    const today = makeSnapshot({ feverCount: 2, urgentCount: 3 });
    const yesterday = makeSnapshot({ feverCount: 0, urgentCount: 1 });
    const result = computeStatusDelta(today, yesterday);
    expect(result!.feverDelta).toBe(2);
    expect(result!.urgentDelta).toBe(2);
  });
});

// ─── formatDeltaText ─────────────────────────────────────────

describe('formatDeltaText', () => {
  it('returns null when delta is null', () => {
    expect(formatDeltaText(null)).toBeNull();
  });

  it('returns null when delta is undefined', () => {
    expect(formatDeltaText(undefined)).toBeNull();
  });

  it('returns null when all deltas are zero', () => {
    const delta: StatusDelta = {
      pendingDelta: 0,
      absenceDelta: 0,
      feverDelta: 0,
      urgentDelta: 0,
    };
    expect(formatDeltaText(delta)).toBeNull();
  });

  it('shows positive delta with + sign for worsening', () => {
    const delta: StatusDelta = {
      pendingDelta: 4,
      absenceDelta: 0,
      feverDelta: 0,
      urgentDelta: 0,
    };
    expect(formatDeltaText(delta)).toBe('前日比 記録+4');
  });

  it('shows negative delta without + sign for improvement', () => {
    const delta: StatusDelta = {
      pendingDelta: -3,
      absenceDelta: 0,
      feverDelta: 0,
      urgentDelta: 0,
    };
    expect(formatDeltaText(delta)).toBe('前日比 記録-3');
  });

  it('picks the delta with largest absolute value', () => {
    const delta: StatusDelta = {
      pendingDelta: 2,
      absenceDelta: -5,
      feverDelta: 1,
      urgentDelta: 0,
    };
    // |absenceDelta| = 5 is the largest
    expect(formatDeltaText(delta)).toBe('前日比 欠席-5');
  });

  it('shows fever delta correctly', () => {
    const delta: StatusDelta = {
      pendingDelta: 0,
      absenceDelta: 0,
      feverDelta: 2,
      urgentDelta: 0,
    };
    expect(formatDeltaText(delta)).toBe('前日比 発熱+2');
  });

  it('shows urgent delta correctly', () => {
    const delta: StatusDelta = {
      pendingDelta: 0,
      absenceDelta: 0,
      feverDelta: 0,
      urgentDelta: 3,
    };
    expect(formatDeltaText(delta)).toBe('前日比 未対応+3');
  });

  it('when multiple deltas have same abs value, picks first by priority order', () => {
    const delta: StatusDelta = {
      pendingDelta: 3,
      absenceDelta: -3,
      feverDelta: 0,
      urgentDelta: 0,
    };
    // 同じ絶対値の場合、先に見つかった方（記録）ではなく、
    // 後のもの（欠席）に上書きされない（>= ではなく > なので最初が勝つ）
    expect(formatDeltaText(delta)).toBe('前日比 記録+3');
  });
});
