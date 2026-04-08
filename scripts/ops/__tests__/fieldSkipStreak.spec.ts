// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  buildStreakResults,
  filterActiveWindow,
  getTopStreaks,
  parseReasonKey,
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

// ────────────────────────────────────────────────────────────────────────────
// parseReasonKey
// ────────────────────────────────────────────────────────────────────────────

describe('parseReasonKey', () => {
  it('splits "listKey:fieldName" correctly', () => {
    expect(parseReasonKey('users:UserID')).toEqual({ listKey: 'users', fieldName: 'UserID' });
  });

  it('splits "schedule_events:EventDate" correctly', () => {
    expect(parseReasonKey('schedule_events:EventDate')).toEqual({
      listKey: 'schedule_events',
      fieldName: 'EventDate',
    });
  });

  it('returns empty fieldName when no colon', () => {
    expect(parseReasonKey('nocolon')).toEqual({ listKey: 'nocolon', fieldName: '' });
  });

  it('handles fieldName with colon (splits at first colon only)', () => {
    expect(parseReasonKey('users:cr014:foo')).toEqual({ listKey: 'users', fieldName: 'cr014:foo' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// filterActiveWindow
// ────────────────────────────────────────────────────────────────────────────

describe('filterActiveWindow', () => {
  const TODAY = '2026-04-08';

  it('includes entries with streak > 0 and lastSeen within window', () => {
    const store: StreakStore = {
      'users:UserID': { streak: 3, lastSeen: '2026-04-06' }, // 2 days ago — within 7
      'daily:RecordDate': { streak: 1, lastSeen: TODAY },
    };
    const result = filterActiveWindow(store, TODAY, 7);
    expect(Object.keys(result)).toContain('users:UserID');
    expect(Object.keys(result)).toContain('daily:RecordDate');
  });

  it('excludes entries with streak = 0', () => {
    const store: StreakStore = {
      'users:UserID': { streak: 0, lastSeen: TODAY },
    };
    expect(filterActiveWindow(store, TODAY, 7)).toEqual({});
  });

  it('excludes entries with lastSeen older than window', () => {
    const store: StreakStore = {
      'users:UserID': { streak: 2, lastSeen: '2026-03-01' }, // far outside 7-day window
    };
    expect(filterActiveWindow(store, TODAY, 7)).toEqual({});
  });

  it('includes entry exactly at window boundary (today - 6 days)', () => {
    // windowDays=7, today=2026-04-08 → cutoff = 2026-04-02
    const store: StreakStore = {
      'users:UserID': { streak: 1, lastSeen: '2026-04-02' },
    };
    expect(filterActiveWindow(store, TODAY, 7)).toHaveProperty('users:UserID');
  });

  it('excludes entry one day outside window boundary', () => {
    // cutoff = 2026-04-02 → 2026-04-01 is outside
    const store: StreakStore = {
      'users:UserID': { streak: 1, lastSeen: '2026-04-01' },
    };
    expect(filterActiveWindow(store, TODAY, 7)).toEqual({});
  });

  it('returns empty object for empty store', () => {
    expect(filterActiveWindow({}, TODAY, 7)).toEqual({});
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getTopStreaks
// ────────────────────────────────────────────────────────────────────────────

describe('getTopStreaks', () => {
  const TODAY = '2026-04-08';

  const store: StreakStore = {
    'users:UserID':              { streak: 5, lastSeen: TODAY },
    'daily:RecordDate':          { streak: 3, lastSeen: TODAY },
    'schedule_events:EventDate': { streak: 4, lastSeen: TODAY },
    'handoff:Message':           { streak: 1, lastSeen: TODAY },
    'support_plans:FormDataJson':{ streak: 2, lastSeen: TODAY },
    'meeting_minutes:Category':  { streak: 6, lastSeen: TODAY },
  };

  it('returns entries sorted by streak descending', () => {
    const result = getTopStreaks(store, TODAY);
    expect(result[0].streak).toBeGreaterThanOrEqual(result[1].streak);
    expect(result[1].streak).toBeGreaterThanOrEqual(result[2].streak);
  });

  it('returns at most topN entries (default 5)', () => {
    const result = getTopStreaks(store, TODAY);
    expect(result.length).toBe(5);
  });

  it('respects custom topN', () => {
    expect(getTopStreaks(store, TODAY, { topN: 3 })).toHaveLength(3);
    expect(getTopStreaks(store, TODAY, { topN: 1 })).toHaveLength(1);
  });

  it('top entry has highest streak', () => {
    const result = getTopStreaks(store, TODAY);
    expect(result[0].reasonKey).toBe('meeting_minutes:Category');
    expect(result[0].streak).toBe(6);
  });

  it('parses listKey and fieldName from reasonKey', () => {
    const result = getTopStreaks(store, TODAY, { topN: 6 });
    const entry = result.find((e) => e.reasonKey === 'users:UserID');
    expect(entry?.listKey).toBe('users');
    expect(entry?.fieldName).toBe('UserID');
  });

  it('marks streak >= PERSISTENT_DRIFT_THRESHOLD as persistent_drift', () => {
    const result = getTopStreaks(store, TODAY, { topN: 6 });
    const pd = result.filter((e) => e.status === 'persistent_drift');
    expect(pd.every((e) => e.streak >= PERSISTENT_DRIFT_THRESHOLD)).toBe(true);
  });

  it('marks streak < PERSISTENT_DRIFT_THRESHOLD as watching', () => {
    const result = getTopStreaks(store, TODAY, { topN: 6 });
    const watching = result.filter((e) => e.status === 'watching');
    expect(watching.every((e) => e.streak < PERSISTENT_DRIFT_THRESHOLD)).toBe(true);
  });

  it('excludes entries outside windowDays', () => {
    const storeWithOld: StreakStore = {
      ...store,
      'old:Field': { streak: 99, lastSeen: '2026-03-01' }, // outside 7-day window
    };
    const result = getTopStreaks(storeWithOld, TODAY, { topN: 10 });
    expect(result.find((e) => e.reasonKey === 'old:Field')).toBeUndefined();
  });

  it('returns empty array for empty store', () => {
    expect(getTopStreaks({}, TODAY)).toHaveLength(0);
  });
});
