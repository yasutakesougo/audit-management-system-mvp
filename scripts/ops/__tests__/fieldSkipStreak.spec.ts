// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  buildStreakResults,
  PERSISTENT_DRIFT_THRESHOLD,
  toJstDateString,
  updateStreakStore,
  type StreakStore,
} from '../fieldSkipStreak';

// ────────────────────────────────────────────────────────────────────────────
// toJstDateString
// ────────────────────────────────────────────────────────────────────────────

describe('toJstDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = toJstDateString(new Date('2026-04-07T00:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('adds 9 hours to UTC — UTC 21:00 on Apr 06 becomes JST Apr 07', () => {
    // Nightly runs at UTC 21:00 = JST 06:00 next day
    const utc2100 = new Date('2026-04-06T21:00:00Z');
    expect(toJstDateString(utc2100)).toBe('2026-04-07');
  });

  it('UTC midnight stays same JST calendar date', () => {
    const utcMidnight = new Date('2026-04-07T00:00:00Z');
    expect(toJstDateString(utcMidnight)).toBe('2026-04-07');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// updateStreakStore
// ────────────────────────────────────────────────────────────────────────────

describe('updateStreakStore', () => {
  const TODAY = '2026-04-07';
  const YESTERDAY = '2026-04-06';

  it('new key seen today starts at streak 1', () => {
    const updated = updateStreakStore({}, new Set(['users:UserID']), TODAY);
    expect(updated['users:UserID']).toEqual({ streak: 1, lastSeen: TODAY });
  });

  it('existing key seen on a different day increments streak', () => {
    const store: StreakStore = { 'users:UserID': { streak: 2, lastSeen: YESTERDAY } };
    const updated = updateStreakStore(store, new Set(['users:UserID']), TODAY);
    expect(updated['users:UserID']).toEqual({ streak: 3, lastSeen: TODAY });
  });

  it('same-day duplicate does NOT increment streak (1-day cap)', () => {
    const store: StreakStore = { 'users:UserID': { streak: 2, lastSeen: TODAY } };
    const updated = updateStreakStore(store, new Set(['users:UserID']), TODAY);
    expect(updated['users:UserID']).toEqual({ streak: 2, lastSeen: TODAY });
  });

  it('key not seen today resets streak to 0', () => {
    const store: StreakStore = { 'users:UserID': { streak: 2, lastSeen: YESTERDAY } };
    const updated = updateStreakStore(store, new Set(), TODAY);
    expect(updated['users:UserID'].streak).toBe(0);
    expect(updated['users:UserID'].lastSeen).toBe(YESTERDAY); // lastSeen preserved
  });

  it('2 days seen → 1 day unseen → streak resets to 0', () => {
    // Day 1
    let store = updateStreakStore({}, new Set(['daily:RecordDate']), '2026-04-05');
    // Day 2
    store = updateStreakStore(store, new Set(['daily:RecordDate']), '2026-04-06');
    expect(store['daily:RecordDate'].streak).toBe(2);
    // Day 3 — not seen
    store = updateStreakStore(store, new Set(), '2026-04-07');
    expect(store['daily:RecordDate'].streak).toBe(0);
  });

  it('3 consecutive days → streak reaches 3', () => {
    let store: StreakStore = {};
    store = updateStreakStore(store, new Set(['users:UserID']), '2026-04-05');
    store = updateStreakStore(store, new Set(['users:UserID']), '2026-04-06');
    store = updateStreakStore(store, new Set(['users:UserID']), '2026-04-07');
    expect(store['users:UserID'].streak).toBe(3);
  });

  it('handles multiple keys independently', () => {
    const store: StreakStore = {
      'users:UserID': { streak: 1, lastSeen: YESTERDAY },
      'daily:RecordDate': { streak: 3, lastSeen: YESTERDAY },
    };
    const updated = updateStreakStore(store, new Set(['users:UserID']), TODAY);
    expect(updated['users:UserID'].streak).toBe(2);
    expect(updated['daily:RecordDate'].streak).toBe(0); // not seen today
  });

  it('works from empty store on first run', () => {
    const updated = updateStreakStore({}, new Set(['schedules:Status']), TODAY);
    expect(updated['schedules:Status']).toEqual({ streak: 1, lastSeen: TODAY });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildStreakResults
// ────────────────────────────────────────────────────────────────────────────

describe('buildStreakResults', () => {
  it('excludes entries with streak = 0', () => {
    const store: StreakStore = {
      'users:UserID': { streak: 0, lastSeen: '2026-04-06' },
      'daily:RecordDate': { streak: 2, lastSeen: '2026-04-07' },
    };
    const results = buildStreakResults(store);
    expect(results).toHaveLength(1);
    expect(results[0].reasonKey).toBe('daily:RecordDate');
  });

  it(`marks streak < ${PERSISTENT_DRIFT_THRESHOLD} as 'watching'`, () => {
    const store: StreakStore = { 'users:UserID': { streak: 2, lastSeen: '2026-04-07' } };
    const [result] = buildStreakResults(store);
    expect(result.status).toBe('watching');
  });

  it(`marks streak >= ${PERSISTENT_DRIFT_THRESHOLD} as 'persistent_drift'`, () => {
    const store: StreakStore = { 'users:UserID': { streak: 3, lastSeen: '2026-04-07' } };
    const [result] = buildStreakResults(store);
    expect(result.status).toBe('persistent_drift');
    expect(result.streak).toBe(3);
    expect(result.reasonKey).toBe('users:UserID');
  });

  it('returns empty array when all streaks are 0', () => {
    const store: StreakStore = { 'users:UserID': { streak: 0, lastSeen: '2026-04-06' } };
    expect(buildStreakResults(store)).toHaveLength(0);
  });

  it('returns empty array for empty store', () => {
    expect(buildStreakResults({})).toHaveLength(0);
  });
});
