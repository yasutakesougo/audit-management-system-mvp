/**
 * dateFormat-phase3-integration.spec.ts
 *
 * Phase 3 で置換した各ファイルの wrapper/置換関数が、
 * 旧実装と同一の出力を返すことを検証する統合テスト。
 */
import { describe, expect, it } from 'vitest';

// ── 共通 API ──
import {
  formatDateIso,
  formatDateTimeIntl,
  formatDateYmd,
  safeFormatDate,
} from '@/lib/dateFormat';

// ── 置換対象の wrapper 関数 ──
import { formatDateLocal } from '@/features/handoff/hooks/useHandoffDateNav';

// ─────────────────────────────────────────────────────────────────────
// Round A: useRoomReservations — formatDateDisplay → safeFormatDate
// ─────────────────────────────────────────────────────────────────────

describe('Phase 3: useRoomReservations formatDateDisplay parity', () => {
  const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  /** Reproduce the old inline implementation for comparison */
  const oldFormatDateDisplay = (date: string): string => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`;
  };

  /** New implementation using safeFormatDate */
  const newFormatDateDisplay = (date: string): string =>
    safeFormatDate(
      date,
      (d) => `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`,
      date,
    );

  const cases = [
    '2026-03-14', // Saturday
    '2026-03-09', // Monday
    '2026-03-15', // Sunday
    '2026-01-01', // Thursday (New Year)
    '2025-12-31', // Wednesday
  ];

  for (const dateStr of cases) {
    it(`${dateStr} → old/new match`, () => {
      const oldResult = oldFormatDateDisplay(dateStr);
      const newResult = newFormatDateDisplay(dateStr);
      expect(newResult).toBe(oldResult);
    });
  }

  it('includes weekday in parentheses', () => {
    const result = newFormatDateDisplay('2026-03-14');
    expect(result).toMatch(/^\d{1,2}\/\d{1,2}\([日月火水木金土]\)$/);
  });

  it('2026-03-14 (Saturday) → 3/14(土)', () => {
    expect(newFormatDateDisplay('2026-03-14')).toBe('3/14(土)');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Round A: useHandoffDateNav — formatDateLocal → formatDateIso
// ─────────────────────────────────────────────────────────────────────

describe('Phase 3: useHandoffDateNav formatDateLocal → formatDateIso parity', () => {
  const cases = [
    { input: new Date(2026, 2, 11), expected: '2026-03-11' },
    { input: new Date(2026, 0, 5), expected: '2026-01-05' },
    { input: new Date(2025, 11, 31), expected: '2025-12-31' },
    { input: new Date(2026, 2, 14), expected: '2026-03-14' },
  ];

  for (const { input, expected } of cases) {
    it(`${expected}`, () => {
      expect(formatDateLocal(input)).toBe(expected);
      expect(formatDateIso(input)).toBe(expected);
      // Verify they match
      expect(formatDateLocal(input)).toBe(formatDateIso(input));
    });
  }

  it('default parameter (no arg) returns today in YYYY-MM-DD', () => {
    const result = formatDateLocal();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Round B: SupportPlanningSheetPage — toLocaleDateString → formatDateTimeIntl
// ─────────────────────────────────────────────────────────────────────

describe('Phase 3: SupportPlanningSheetPage inline replacement parity', () => {
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  it('ISO datetime string → date-only format', () => {
    const input = '2026-01-15T09:30:00Z';
    const result = formatDateTimeIntl(input, dateOptions);
    expect(result).toBeTruthy();
    expect(result).toContain('2026');
  });

  it('null → empty string', () => {
    expect(formatDateTimeIntl(null, dateOptions)).toBe('');
  });

  it('undefined → empty string', () => {
    expect(formatDateTimeIntl(undefined, dateOptions)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Round B: RecordPanel — toLocaleDateString → formatDateYmd
// ─────────────────────────────────────────────────────────────────────

describe('Phase 3: RecordPanel recordDateLabel parity', () => {
  it('Date object → YYYY/MM/DD', () => {
    expect(formatDateYmd(new Date(2026, 2, 14))).toBe('2026/03/14');
  });

  it('single-digit month/day → zero-padded', () => {
    expect(formatDateYmd(new Date(2026, 0, 5))).toBe('2026/01/05');
  });

  // The old toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  // produces 'YYYY/MM/DD' in Japanese locale, matching formatDateYmd output
  it('matches Intl output pattern', () => {
    const d = new Date(2026, 2, 14);
    const intlResult = d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    expect(formatDateYmd(d)).toBe(intlResult);
  });
});
