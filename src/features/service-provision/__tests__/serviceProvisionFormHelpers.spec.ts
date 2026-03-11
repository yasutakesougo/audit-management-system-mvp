/**
 * Unit tests for serviceProvisionFormHelpers.ts
 *
 * Pure input/output assertions — no React renderer, no MSW, no mocks.
 */

import { describe, expect, it } from 'vitest';
import type { ServiceProvisionRecord } from '../index';
import {
    formatHHMM,
    getAddonLabels,
    parseHHMM,
    SERVICE_PROVISION_SAMPLE_RECORDS,
    STATUS_COLOR,
    STATUS_OPTIONS,
    todayISO,
} from '../serviceProvisionFormHelpers';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Minimal ServiceProvisionRecord fixture. Supply only the fields under test. */
const makeRecord = (
  overrides: Partial<ServiceProvisionRecord> = {},
): ServiceProvisionRecord => ({
  id: 1,
  entryKey: 'TEST|2026-01-01',
  userCode: 'TEST',
  recordDateISO: '2026-01-01',
  status: '提供',
  ...overrides,
});

// ────────────────────────────────────────────────────────────
// todayISO
// ────────────────────────────────────────────────────────────

describe('todayISO', () => {
  it('returns a string matching YYYY-MM-DD format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ────────────────────────────────────────────────────────────
// parseHHMM
// ────────────────────────────────────────────────────────────

describe('parseHHMM', () => {
  // Valid inputs
  it('parses "09:30" → 930', () => {
    expect(parseHHMM('09:30')).toBe(930);
  });

  it('parses "17:00" → 1700', () => {
    expect(parseHHMM('17:00')).toBe(1700);
  });

  it('parses "00:00" → 0', () => {
    expect(parseHHMM('00:00')).toBe(0);
  });

  it('parses "23:59" → 2359', () => {
    expect(parseHHMM('23:59')).toBe(2359);
  });

  it('parses "0:00" → 0 (single-digit hour allowed by regex)', () => {
    expect(parseHHMM('0:00')).toBe(0);
  });

  // Empty / falsy
  it('returns null for empty string ""', () => {
    expect(parseHHMM('')).toBeNull();
  });

  // Invalid format
  it('returns null for "abc" (non-numeric)', () => {
    expect(parseHHMM('abc')).toBeNull();
  });

  it('returns null for "9:3" (single-digit mm not allowed)', () => {
    expect(parseHHMM('9:3')).toBeNull();
  });

  it('returns null for "1700" (no colon)', () => {
    expect(parseHHMM('1700')).toBeNull();
  });

  // Out-of-range
  it('returns null for "24:00" (hh > 23)', () => {
    expect(parseHHMM('24:00')).toBeNull();
  });

  it('returns null for "12:60" (mm > 59)', () => {
    expect(parseHHMM('12:60')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// formatHHMM
// ────────────────────────────────────────────────────────────

describe('formatHHMM', () => {
  it('returns "—" for null', () => {
    expect(formatHHMM(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatHHMM(undefined)).toBe('—');
  });

  it('formats 0 → "00:00"', () => {
    expect(formatHHMM(0)).toBe('00:00');
  });

  it('formats 930 → "09:30"', () => {
    expect(formatHHMM(930)).toBe('09:30');
  });

  it('formats 1700 → "17:00"', () => {
    expect(formatHHMM(1700)).toBe('17:00');
  });

  it('formats 2359 → "23:59"', () => {
    expect(formatHHMM(2359)).toBe('23:59');
  });
});

// ────────────────────────────────────────────────────────────
// getAddonLabels
// ────────────────────────────────────────────────────────────

describe('getAddonLabels', () => {
  it('returns ["送迎:往復"] when both hasTransportPickup and hasTransportDropoff are true', () => {
    const labels = getAddonLabels(
      makeRecord({ hasTransportPickup: true, hasTransportDropoff: true }),
    );
    expect(labels).toContain('送迎:往復');
    expect(labels).not.toContain('送迎:往');
    expect(labels).not.toContain('送迎:復');
  });

  it('returns ["送迎:往"] when only hasTransportPickup is true', () => {
    const labels = getAddonLabels(
      makeRecord({ hasTransportPickup: true, hasTransportDropoff: false }),
    );
    expect(labels).toContain('送迎:往');
    expect(labels).not.toContain('送迎:往復');
  });

  it('returns ["送迎:復"] when only hasTransportDropoff is true', () => {
    const labels = getAddonLabels(
      makeRecord({ hasTransportPickup: false, hasTransportDropoff: true }),
    );
    expect(labels).toContain('送迎:復');
    expect(labels).not.toContain('送迎:往復');
  });

  it('returns ["送迎"] when hasTransport is true but pickup/dropoff are false', () => {
    const labels = getAddonLabels(
      makeRecord({
        hasTransport: true,
        hasTransportPickup: false,
        hasTransportDropoff: false,
      }),
    );
    expect(labels).toContain('送迎');
    expect(labels).not.toContain('送迎:往復');
  });

  it('includes "食事" when hasMeal is true', () => {
    expect(getAddonLabels(makeRecord({ hasMeal: true }))).toContain('食事');
  });

  it('includes "入浴" when hasBath is true', () => {
    expect(getAddonLabels(makeRecord({ hasBath: true }))).toContain('入浴');
  });

  it('includes "延長" when hasExtended is true', () => {
    expect(getAddonLabels(makeRecord({ hasExtended: true }))).toContain('延長');
  });

  it('includes "欠席対応" when hasAbsentSupport is true', () => {
    expect(getAddonLabels(makeRecord({ hasAbsentSupport: true }))).toContain('欠席対応');
  });

  it('returns empty array when all addon flags are false/absent', () => {
    const labels = getAddonLabels(
      makeRecord({
        hasTransport: false,
        hasTransportPickup: false,
        hasTransportDropoff: false,
        hasMeal: false,
        hasBath: false,
        hasExtended: false,
        hasAbsentSupport: false,
      }),
    );
    expect(labels).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// STATUS_OPTIONS
// ────────────────────────────────────────────────────────────

describe('STATUS_OPTIONS', () => {
  it("contains ['提供', '欠席', 'その他'] in that order", () => {
    expect(STATUS_OPTIONS).toEqual(['提供', '欠席', 'その他']);
  });
});

// ────────────────────────────────────────────────────────────
// STATUS_COLOR
// ────────────────────────────────────────────────────────────

describe('STATUS_COLOR', () => {
  it('has keys for every status in STATUS_OPTIONS', () => {
    for (const status of STATUS_OPTIONS) {
      expect(Object.prototype.hasOwnProperty.call(STATUS_COLOR, status)).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────
// SERVICE_PROVISION_SAMPLE_RECORDS — smoke test only
// ────────────────────────────────────────────────────────────

describe('SERVICE_PROVISION_SAMPLE_RECORDS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SERVICE_PROVISION_SAMPLE_RECORDS)).toBe(true);
    expect(SERVICE_PROVISION_SAMPLE_RECORDS.length).toBeGreaterThan(0);
  });

  it('each record has the required shape (id, entryKey, userCode, recordDateISO, status)', () => {
    for (const record of SERVICE_PROVISION_SAMPLE_RECORDS) {
      expect(typeof record.id).toBe('number');
      expect(typeof record.entryKey).toBe('string');
      expect(typeof record.userCode).toBe('string');
      expect(typeof record.recordDateISO).toBe('string');
      expect(['提供', '欠席', 'その他']).toContain(record.status);
    }
  });
});
