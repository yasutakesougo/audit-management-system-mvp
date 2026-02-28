import { describe, expect, it } from 'vitest';

import {
  hhmmToMinutes,
  calcDurationMinutes,
  durationToTimeCode,
  deriveProvisionEntry,
  isDurationExtreme,
  hasDataOnNonProvided,
} from '@/features/kokuhoren-validation/derive';

// ─── hhmmToMinutes ──────────────────────────────────────────

describe('hhmmToMinutes', () => {
  it('930 → 570分', () => expect(hhmmToMinutes(930)).toBe(570));
  it('1530 → 930分', () => expect(hhmmToMinutes(1530)).toBe(930));
  it('0 → 0分', () => expect(hhmmToMinutes(0)).toBe(0));
  it('2359 → 1439分', () => expect(hhmmToMinutes(2359)).toBe(1439));
});

// ─── calcDurationMinutes ────────────────────────────────────

describe('calcDurationMinutes', () => {
  it('930→1530 = 360分', () => expect(calcDurationMinutes(930, 1530)).toBe(360));
  it('900→1700 = 480分', () => expect(calcDurationMinutes(900, 1700)).toBe(480));
  it('start null → null', () => expect(calcDurationMinutes(null, 1530)).toBeNull());
  it('end null → null', () => expect(calcDurationMinutes(930, null)).toBeNull());
  it('start >= end → null', () => expect(calcDurationMinutes(1530, 930)).toBeNull());
  it('start == end → null', () => expect(calcDurationMinutes(930, 930)).toBeNull());
});

// ─── durationToTimeCode ─────────────────────────────────────

describe('durationToTimeCode', () => {
  it('null → null', () => expect(durationToTimeCode(null)).toBeNull());
  it('0 → null', () => expect(durationToTimeCode(0)).toBeNull());
  it('60分 → 01', () => expect(durationToTimeCode(60)).toBe('01'));
  it('120分 → 01', () => expect(durationToTimeCode(120)).toBe('01'));
  it('121分 → 02', () => expect(durationToTimeCode(121)).toBe('02'));
  it('180分 → 02', () => expect(durationToTimeCode(180)).toBe('02'));
  it('240分 → 03', () => expect(durationToTimeCode(240)).toBe('03'));
  it('300分 → 04', () => expect(durationToTimeCode(300)).toBe('04'));
  it('360分 → 05', () => expect(durationToTimeCode(360)).toBe('05'));
  it('420分 → 06', () => expect(durationToTimeCode(420)).toBe('06'));
  it('480分 → 07', () => expect(durationToTimeCode(480)).toBe('07'));
  it('481分 → 08', () => expect(durationToTimeCode(481)).toBe('08'));
  it('600分 → 08', () => expect(durationToTimeCode(600)).toBe('08'));
});

// ─── isDurationExtreme ──────────────────────────────────────

describe('isDurationExtreme', () => {
  it('null → false', () => expect(isDurationExtreme(null)).toBe(false));
  it('29分 → true（短すぎ）', () => expect(isDurationExtreme(29)).toBe(true));
  it('30分 → false', () => expect(isDurationExtreme(30)).toBe(false));
  it('360分 → false', () => expect(isDurationExtreme(360)).toBe(false));
  it('720分 → false', () => expect(isDurationExtreme(720)).toBe(false));
  it('721分 → true（長すぎ）', () => expect(isDurationExtreme(721)).toBe(true));
});

// ─── hasDataOnNonProvided ───────────────────────────────────

describe('hasDataOnNonProvided', () => {
  it('提供 → false（ルール対象外）', () => {
    expect(hasDataOnNonProvided({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '提供',
      startHHMM: 930, endHHMM: 1530,
    })).toBe(false);
  });

  it('欠席 + 時刻あり → true', () => {
    expect(hasDataOnNonProvided({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '欠席',
      startHHMM: 930,
    })).toBe(true);
  });

  it('欠席 + 食事あり → true', () => {
    expect(hasDataOnNonProvided({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '欠席',
      hasMeal: true,
    })).toBe(true);
  });

  it('欠席 + 欠席時対応のみ → false（除外対象）', () => {
    expect(hasDataOnNonProvided({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '欠席',
      hasAbsentSupport: true,
    })).toBe(false);
  });

  it('欠席 + データなし → false', () => {
    expect(hasDataOnNonProvided({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '欠席',
    })).toBe(false);
  });
});

// ─── deriveProvisionEntry ───────────────────────────────────

describe('deriveProvisionEntry', () => {
  it('提供レコードに duration + timeCode を付与', () => {
    const result = deriveProvisionEntry({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '提供',
      startHHMM: 930, endHHMM: 1530,
    });
    expect(result.durationMinutes).toBe(360);
    expect(result.timeCode).toBe('05');
  });

  it('時刻なし → null/null', () => {
    const result = deriveProvisionEntry({
      userCode: 'I022', recordDateISO: '2026-02-27', status: '欠席',
    });
    expect(result.durationMinutes).toBeNull();
    expect(result.timeCode).toBeNull();
  });
});
