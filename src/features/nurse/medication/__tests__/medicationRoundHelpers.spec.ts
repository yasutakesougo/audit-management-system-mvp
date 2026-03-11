/**
 * medicationRoundHelpers.spec.ts
 *
 * Focused unit tests for medicationRoundHelpers.ts pure functions.
 * No mocks, no React, no MSW — pure input/output assertions.
 */
import { describe, expect, it } from 'vitest';
import {
    categorizeStatus,
    createDefaultInventoryByUser,
    filterInventory,
    mergeInventory,
    statusLabel,
    summarizeInventory,
    type StatusFilter,
} from '../medicationRoundHelpers';
import type { MedicationInventoryEntry } from '../medicationRoundTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDaysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const makeEntry = (override: Partial<MedicationInventoryEntry> = {}): MedicationInventoryEntry => ({
  id: 1,
  category: '定期',
  name: 'テスト薬',
  dosage: '1日1錠',
  stock: 10,
  unit: '錠',
  expirationDate: makeDaysFromNow(60),
  prescribedBy: 'テスト病院',
  storage: '医務室',
  ...override,
});

// ---------------------------------------------------------------------------
// categorizeStatus
// ---------------------------------------------------------------------------

describe('categorizeStatus', () => {
  it('returns "ok" when expiry is 31+ days away', () => {
    const entry = makeEntry({ expirationDate: makeDaysFromNow(60) });
    expect(categorizeStatus(entry)).toBe('ok');
  });

  it('returns "expiring" when expiry is 30 days away', () => {
    const entry = makeEntry({ expirationDate: makeDaysFromNow(30) });
    expect(categorizeStatus(entry)).toBe('expiring');
  });

  it('returns "expiring" when expiry is 1 day away', () => {
    const entry = makeEntry({ expirationDate: makeDaysFromNow(1) });
    expect(categorizeStatus(entry)).toBe('expiring');
  });

  it('returns "expired" when expiry was yesterday', () => {
    const entry = makeEntry({ expirationDate: makeDaysFromNow(-1) });
    expect(categorizeStatus(entry)).toBe('expired');
  });

  it('returns "expired" when expiry was far in the past', () => {
    const entry = makeEntry({ expirationDate: '2000-01-01' });
    expect(categorizeStatus(entry)).toBe('expired');
  });
});

// ---------------------------------------------------------------------------
// statusLabel
// ---------------------------------------------------------------------------

describe('statusLabel', () => {
  const cases: [StatusFilter, string][] = [
    ['ok', '良好'],
    ['expiring', '30日以内'],
    ['expired', '期限切れ'],
    ['all', 'すべて'],
  ];
  it.each(cases)('statusLabel("%s") === "%s"', (input, expected) => {
    expect(statusLabel(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// filterInventory
// ---------------------------------------------------------------------------

describe('filterInventory', () => {
  const ok = makeEntry({ id: 1, name: 'リシノプリル', expirationDate: makeDaysFromNow(60) });
  const expiring = makeEntry({ id: 2, name: 'アムロジピン', expirationDate: makeDaysFromNow(10) });
  const expired = makeEntry({ id: 3, name: 'ロスバスタチン', expirationDate: makeDaysFromNow(-5) });

  it('returns all when filter is "all" and search is empty', () => {
    expect(filterInventory([ok, expiring, expired], 'all', '')).toHaveLength(3);
  });

  it('returns only ok entries when filter is "ok"', () => {
    const result = filterInventory([ok, expiring, expired], 'ok', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns only expiring entries when filter is "expiring"', () => {
    const result = filterInventory([ok, expiring, expired], 'expiring', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('returns only expired entries when filter is "expired"', () => {
    const result = filterInventory([ok, expiring, expired], 'expired', '');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by name search (case-insensitive)', () => {
    const result = filterInventory([ok, expiring, expired], 'all', 'リシノプリル');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty when search matches nothing', () => {
    expect(filterInventory([ok, expiring, expired], 'all', 'XXXXXX')).toHaveLength(0);
  });

  it('combines status filter and search', () => {
    // Search for "アムロ" but filter to expired — should return empty
    expect(filterInventory([ok, expiring, expired], 'expired', 'アムロ')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// summarizeInventory
// ---------------------------------------------------------------------------

describe('summarizeInventory', () => {
  it('counts correctly with mixed statuses', () => {
    const entries = [
      makeEntry({ id: 1, expirationDate: makeDaysFromNow(60) }),   // ok
      makeEntry({ id: 2, expirationDate: makeDaysFromNow(10) }),   // expiring
      makeEntry({ id: 3, expirationDate: makeDaysFromNow(-1) }),   // expired
      makeEntry({ id: 4, expirationDate: makeDaysFromNow(90) }),   // ok
    ];
    const result = summarizeInventory(entries);
    expect(result.total).toBe(4);
    expect(result.ok).toBe(2);
    expect(result.expiring).toBe(1);
    expect(result.expired).toBe(1);
  });

  it('returns all zeros for empty inventory', () => {
    const result = summarizeInventory([]);
    expect(result).toEqual({ total: 0, ok: 0, expiring: 0, expired: 0 });
  });
});

// ---------------------------------------------------------------------------
// mergeInventory
// ---------------------------------------------------------------------------

describe('mergeInventory', () => {
  const base = { u1: [makeEntry({ id: 1 })], u2: [makeEntry({ id: 2 })] };

  it('returns base entries when no overrides provided', () => {
    const result = mergeInventory(base);
    expect(result.u1).toHaveLength(1);
    expect(result.u2).toHaveLength(1);
  });

  it('overrides per-user entries when override is provided', () => {
    const overrides = { u1: [makeEntry({ id: 9, name: 'Override薬' })] };
    const result = mergeInventory(base, overrides);
    expect(result.u1[0].name).toBe('Override薬');
    expect(result.u2[0].id).toBe(2); // base unchanged
  });

  it('auto-assigns id when override entry has id undefined', () => {
    // id is required in the type so omit via casting
    const noId = { ...makeEntry(), id: undefined as unknown as number };
    const result = mergeInventory(base, { u1: [noId] });
    expect(result.u1[0].id).toBe(1); // index 0 + 1
  });

  it('adds new user id that does not exist in base', () => {
    const overrides = { u99: [makeEntry({ id: 1 })] };
    const result = mergeInventory(base, overrides);
    expect(result.u99).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// createDefaultInventoryByUser
// ---------------------------------------------------------------------------

describe('createDefaultInventoryByUser', () => {
  it('returns empty array for users without seed entries', () => {
    const users = [{ id: 'UNKNOWN', name: 'テスト太郎', furigana: 'てすとたろう' }];
    const result = createDefaultInventoryByUser(users);
    expect(result.UNKNOWN).toEqual([]);
  });

  it('clones seed entries (no shared reference)', () => {
    const users = [{ id: 'I022', name: 'テスト', furigana: 'てすと' }];
    const r1 = createDefaultInventoryByUser(users);
    const r2 = createDefaultInventoryByUser(users);
    r1.I022[0].stock = 9999;
    expect(r2.I022[0].stock).not.toBe(9999);
  });
});
