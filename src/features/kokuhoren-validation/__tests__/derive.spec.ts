import { describe, expect, it } from 'vitest';
import {
  hhmmToMinutes,
  calcDurationMinutes,
  durationToTimeCode,
  deriveProvisionEntry,
  isDurationExtreme,
  hasDataOnNonProvided,
} from '../derive';
import type { DailyProvisionEntry } from '../types';

// ── hhmmToMinutes ──────────────────────────────────────────────

describe('hhmmToMinutes', () => {
  it.each([
    [0, 0],
    [100, 60],
    [130, 90],
    [930, 570],
    [1200, 720],
    [1530, 930],
    [2359, 1439],
  ])('converts HHMM %i → %i minutes', (hhmm, expected) => {
    expect(hhmmToMinutes(hhmm)).toBe(expected);
  });
});

// ── calcDurationMinutes ────────────────────────────────────────

describe('calcDurationMinutes', () => {
  it('returns null when start is null', () => {
    expect(calcDurationMinutes(null, 1700)).toBeNull();
  });

  it('returns null when end is null', () => {
    expect(calcDurationMinutes(900, null)).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(calcDurationMinutes(null, null)).toBeNull();
  });

  it('returns null when both are undefined', () => {
    expect(calcDurationMinutes(undefined, undefined)).toBeNull();
  });

  it('returns null when start equals end', () => {
    expect(calcDurationMinutes(900, 900)).toBeNull();
  });

  it('returns null when start is after end', () => {
    expect(calcDurationMinutes(1700, 900)).toBeNull();
  });

  it.each([
    [900, 1700, 480],   // 9:00-17:00 = 8h
    [930, 1530, 360],   // 9:30-15:30 = 6h
    [900, 910, 10],     // 9:00-9:10 = 10min
    [0, 100, 60],       // 0:00-1:00 = 1h
  ])('calculates %i to %i = %i minutes', (start, end, expected) => {
    expect(calcDurationMinutes(start, end)).toBe(expected);
  });
});

// ── durationToTimeCode ─────────────────────────────────────────

describe('durationToTimeCode', () => {
  it('returns null for null input', () => {
    expect(durationToTimeCode(null)).toBeNull();
  });

  it('returns null for 0 minutes', () => {
    expect(durationToTimeCode(0)).toBeNull();
  });

  it('returns null for negative minutes', () => {
    expect(durationToTimeCode(-1)).toBeNull();
  });

  // 境界値テスト: 各タイムコードの上限と次のコードの下限
  it.each([
    [1, '01'],     // 最小有効値
    [120, '01'],   // 〜2h 上限
    [121, '02'],   // 2h超 → 02
    [180, '02'],   // 3h 上限
    [181, '03'],   // 3h超 → 03
    [240, '03'],   // 4h 上限
    [241, '04'],   // 4h超 → 04
    [300, '04'],   // 5h 上限
    [301, '05'],   // 5h超 → 05
    [360, '05'],   // 6h 上限
    [361, '06'],   // 6h超 → 06
    [420, '06'],   // 7h 上限
    [421, '07'],   // 7h超 → 07
    [480, '07'],   // 8h 上限
    [481, '08'],   // 8h超 → 08
    [720, '08'],   // 12h
    [1440, '08'],  // 24h
  ])('maps %i min → code %s', (minutes, code) => {
    expect(durationToTimeCode(minutes)).toBe(code);
  });
});

// ── isDurationExtreme ──────────────────────────────────────────

describe('isDurationExtreme', () => {
  it('returns false for null', () => {
    expect(isDurationExtreme(null)).toBe(false);
  });

  it.each([
    [29, true],    // 30分未満 → 極端
    [30, false],   // 30分 → OK
    [360, false],  // 6h → OK
    [720, false],  // 12h → OK
    [721, true],   // 12h超 → 極端
  ])('isDurationExtreme(%i) → %s', (minutes, expected) => {
    expect(isDurationExtreme(minutes)).toBe(expected);
  });
});

// ── hasDataOnNonProvided ───────────────────────────────────────

describe('hasDataOnNonProvided', () => {
  const base: DailyProvisionEntry = {
    userCode: 'U001',
    recordDateISO: '2026-03-01',
    status: '欠席',
  };

  it('returns false when status is 提供', () => {
    expect(hasDataOnNonProvided({ ...base, status: '提供', startHHMM: 900 })).toBe(false);
  });

  it('returns false when non-提供 has no time or addons', () => {
    expect(hasDataOnNonProvided(base)).toBe(false);
  });

  it('returns true when non-提供 has startHHMM', () => {
    expect(hasDataOnNonProvided({ ...base, startHHMM: 900 })).toBe(true);
  });

  it('returns true when non-提供 has endHHMM', () => {
    expect(hasDataOnNonProvided({ ...base, endHHMM: 1700 })).toBe(true);
  });

  it.each([
    ['hasTransport', { hasTransport: true }],
    ['hasMeal', { hasMeal: true }],
    ['hasBath', { hasBath: true }],
    ['hasExtended', { hasExtended: true }],
  ] as const)('returns true when non-提供 has %s', (_label, addon) => {
    expect(hasDataOnNonProvided({ ...base, ...addon })).toBe(true);
  });

  it('returns false when non-提供 has only hasAbsentSupport', () => {
    // hasAbsentSupport は欠席でもあり得るので除外
    expect(hasDataOnNonProvided({ ...base, hasAbsentSupport: true })).toBe(false);
  });
});

// ── deriveProvisionEntry ───────────────────────────────────────

describe('deriveProvisionEntry', () => {
  it('derives duration and timeCode for a normal record', () => {
    const entry: DailyProvisionEntry = {
      userCode: 'U001',
      recordDateISO: '2026-03-01',
      status: '提供',
      startHHMM: 900,
      endHHMM: 1500,
    };
    const derived = deriveProvisionEntry(entry);
    expect(derived.durationMinutes).toBe(360); // 6h
    expect(derived.timeCode).toBe('05');       // 5h〜6h
  });

  it('returns null duration and timeCode when times are missing', () => {
    const entry: DailyProvisionEntry = {
      userCode: 'U001',
      recordDateISO: '2026-03-01',
      status: '欠席',
    };
    const derived = deriveProvisionEntry(entry);
    expect(derived.durationMinutes).toBeNull();
    expect(derived.timeCode).toBeNull();
  });

  it('preserves original entry fields', () => {
    const entry: DailyProvisionEntry = {
      userCode: 'U001',
      recordDateISO: '2026-03-01',
      status: '提供',
      startHHMM: 900,
      endHHMM: 1100,
      hasMeal: true,
    };
    const derived = deriveProvisionEntry(entry);
    expect(derived.userCode).toBe('U001');
    expect(derived.hasMeal).toBe(true);
    expect(derived.durationMinutes).toBe(120);
    expect(derived.timeCode).toBe('01');
  });
});
