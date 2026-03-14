/**
 * dateFormat.spec.ts — 共通日付フォーマットAPIテスト（Phase 1）
 *
 * このテストは API仕様を固定し、次フェーズでの安全な置換の土台とする。
 * 各関数について以下をカバー:
 * - Date 入力
 * - ISO 文字列入力
 * - timestamp (number) 入力
 * - null / undefined / 空文字 / 不正文字列
 * - フォールバック文字列
 */
import { describe, expect, it } from 'vitest';
import {
  formatDateIso,
  formatDateJapanese,
  formatDateTimeIntl,
  formatDateTimeYmdHm,
  formatDateYmd,
  formatRelativeTime,
  safeFormatDate,
  toSafeDate,
} from '@/lib/dateFormat';

// ---------------------------------------------------------------------------
// toSafeDate (internal helper, but exported for composability)
// ---------------------------------------------------------------------------

describe('toSafeDate', () => {
  it('returns Date for valid Date input', () => {
    const d = new Date(2025, 0, 15, 9, 30);
    const result = toSafeDate(d);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(d.getTime());
  });

  it('returns null for invalid Date input', () => {
    expect(toSafeDate(new Date('invalid'))).toBeNull();
  });

  it('returns Date for valid ISO string', () => {
    const result = toSafeDate('2025-01-15T09:30:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBeGreaterThanOrEqual(2025);
  });

  it('returns Date for date-only string', () => {
    const result = toSafeDate('2025-01-15');
    expect(result).toBeInstanceOf(Date);
  });

  it('returns Date for timestamp number', () => {
    const ts = new Date(2025, 0, 15).getTime();
    const result = toSafeDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts);
  });

  it('returns null for null', () => {
    expect(toSafeDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toSafeDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toSafeDate('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(toSafeDate('   ')).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(toSafeDate('not-a-date')).toBeNull();
  });

  it('returns null for NaN number', () => {
    expect(toSafeDate(NaN)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatDateYmd — YYYY/MM/DD
// ---------------------------------------------------------------------------

describe('formatDateYmd', () => {
  it('formats Date object correctly', () => {
    expect(formatDateYmd(new Date(2025, 0, 15))).toBe('2025/01/15');
  });

  it('pads single-digit month and day', () => {
    expect(formatDateYmd(new Date(2025, 2, 5))).toBe('2025/03/05');
  });

  it('formats ISO string input', () => {
    // Uses local timezone, so exact output depends on env
    const result = formatDateYmd('2025-06-01');
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('formats timestamp input', () => {
    const ts = new Date(2025, 11, 31).getTime();
    expect(formatDateYmd(ts)).toBe('2025/12/31');
  });

  it('returns empty string for null by default', () => {
    expect(formatDateYmd(null)).toBe('');
  });

  it('returns empty string for undefined by default', () => {
    expect(formatDateYmd(undefined)).toBe('');
  });

  it('returns custom fallback for null', () => {
    expect(formatDateYmd(null, '-')).toBe('-');
  });

  it('returns custom fallback for invalid string', () => {
    expect(formatDateYmd('xyz', '未設定')).toBe('未設定');
  });

  it('returns empty string for empty string input', () => {
    expect(formatDateYmd('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatDateJapanese — YYYY年M月D日
// ---------------------------------------------------------------------------

describe('formatDateJapanese', () => {
  it('formats Date object correctly', () => {
    expect(formatDateJapanese(new Date(2025, 0, 15))).toBe('2025年1月15日');
  });

  it('formats single-digit month without padding', () => {
    expect(formatDateJapanese(new Date(2025, 2, 5))).toBe('2025年3月5日');
  });

  it('formats double-digit month correctly', () => {
    expect(formatDateJapanese(new Date(2025, 11, 25))).toBe('2025年12月25日');
  });

  it('formats ISO string input', () => {
    const result = formatDateJapanese('2025-06-01');
    expect(result).toContain('年');
    expect(result).toContain('月');
    expect(result).toContain('日');
  });

  it('formats timestamp input', () => {
    const ts = new Date(2025, 0, 1).getTime();
    expect(formatDateJapanese(ts)).toBe('2025年1月1日');
  });

  it('returns empty string for null by default', () => {
    expect(formatDateJapanese(null)).toBe('');
  });

  it('returns custom fallback for null', () => {
    expect(formatDateJapanese(null, '未設定')).toBe('未設定');
  });

  it('returns custom fallback for undefined', () => {
    expect(formatDateJapanese(undefined, '未入力')).toBe('未入力');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDateJapanese('bad-date', '—')).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// formatDateTimeYmdHm — YYYY/MM/DD HH:mm
// ---------------------------------------------------------------------------

describe('formatDateTimeYmdHm', () => {
  it('formats Date object with time correctly', () => {
    expect(formatDateTimeYmdHm(new Date(2025, 0, 15, 9, 30))).toBe('2025/01/15 09:30');
  });

  it('formats midnight correctly', () => {
    expect(formatDateTimeYmdHm(new Date(2025, 0, 15, 0, 0))).toBe('2025/01/15 00:00');
  });

  it('formats 23:59 correctly', () => {
    expect(formatDateTimeYmdHm(new Date(2025, 0, 15, 23, 59))).toBe('2025/01/15 23:59');
  });

  it('formats ISO string input', () => {
    // Local timezone interpretation
    const result = formatDateTimeYmdHm('2025-01-15T09:30:00');
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(result).toBe('2025/01/15 09:30');
  });

  it('formats timestamp input', () => {
    const ts = new Date(2025, 5, 15, 14, 45).getTime();
    expect(formatDateTimeYmdHm(ts)).toBe('2025/06/15 14:45');
  });

  it('returns empty string for null', () => {
    expect(formatDateTimeYmdHm(null)).toBe('');
  });

  it('returns custom fallback for undefined', () => {
    expect(formatDateTimeYmdHm(undefined, '—')).toBe('—');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDateTimeYmdHm('nope', '-')).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// formatDateTimeIntl — Intl.DateTimeFormat (ja-JP)
// ---------------------------------------------------------------------------

describe('formatDateTimeIntl', () => {
  it('formats Date using default options', () => {
    const result = formatDateTimeIntl(new Date(2025, 0, 15, 9, 30));
    expect(result).toBeTruthy();
    // Intl output varies, but should contain date parts
    expect(result).toContain('2025');
  });

  it('formats with custom options', () => {
    const result = formatDateTimeIntl(
      new Date(2025, 0, 15),
      { year: 'numeric', month: 'long' },
    );
    expect(result).toContain('2025');
    expect(result).toContain('1月');
  });

  it('returns empty string for null', () => {
    expect(formatDateTimeIntl(null)).toBe('');
  });

  it('returns custom fallback for undefined', () => {
    expect(formatDateTimeIntl(undefined, undefined, '未取得')).toBe('未取得');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDateTimeIntl('garbage', undefined, '-')).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// safeFormatDate — custom formatter with null-safety
// ---------------------------------------------------------------------------

describe('safeFormatDate', () => {
  it('applies custom formatter to valid input', () => {
    const result = safeFormatDate(
      '2025-01-15',
      (d) => `${d.getFullYear()}年`,
    );
    expect(result).toBe('2025年');
  });

  it('returns fallback for null input', () => {
    expect(safeFormatDate(null, (d) => d.toISOString(), '—')).toBe('—');
  });

  it('returns fallback for undefined input', () => {
    expect(safeFormatDate(undefined, (d) => d.toISOString(), 'N/A')).toBe('N/A');
  });

  it('returns fallback for invalid string input', () => {
    expect(safeFormatDate('bad', (d) => d.toISOString(), '-')).toBe('-');
  });

  it('returns fallback when formatter throws', () => {
    const throwingFormatter = (_d: Date): string => {
      throw new Error('boom');
    };
    expect(safeFormatDate('2025-01-15', throwingFormatter, 'error')).toBe('error');
  });

  it('returns empty string by default when input is null', () => {
    expect(safeFormatDate(null, (d) => d.toISOString())).toBe('');
  });

  it('works with Date input', () => {
    const d = new Date(2025, 5, 1);
    const result = safeFormatDate(d, (date) => `${date.getMonth() + 1}月`);
    expect(result).toBe('6月');
  });

  it('works with timestamp input', () => {
    const ts = new Date(2025, 0, 1).getTime();
    const result = safeFormatDate(ts, (d) => String(d.getFullYear()));
    expect(result).toBe('2025');
  });
});

// ---------------------------------------------------------------------------
// formatDateIso — YYYY-MM-DD (local TZ)
// ---------------------------------------------------------------------------

describe('formatDateIso', () => {
  it('formats Date object correctly', () => {
    expect(formatDateIso(new Date(2025, 0, 15))).toBe('2025-01-15');
  });

  it('pads single-digit month and day', () => {
    expect(formatDateIso(new Date(2025, 2, 5))).toBe('2025-03-05');
  });

  it('formats timestamp input', () => {
    const ts = new Date(2025, 11, 31).getTime();
    expect(formatDateIso(ts)).toBe('2025-12-31');
  });

  it('returns empty string for null', () => {
    expect(formatDateIso(null)).toBe('');
  });

  it('returns custom fallback for undefined', () => {
    expect(formatDateIso(undefined, '-')).toBe('-');
  });

  it('returns empty string for empty string input', () => {
    expect(formatDateIso('')).toBe('');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDateIso('abc', '未設定')).toBe('未設定');
  });

  it('uses local timezone, not UTC', () => {
    // This ensures we don't use toISOString().slice(0,10) which is UTC-based
    const d = new Date(2025, 0, 15, 3, 0); // 3am local time
    expect(formatDateIso(d)).toBe('2025-01-15');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  // Fixed "now" for deterministic tests: 2026-03-14T12:00:00.000Z
  const NOW = new Date('2026-03-14T12:00:00.000Z').getTime();

  it('< 1 minute → たった今', () => {
    const iso = new Date(NOW - 30_000).toISOString(); // 30s ago
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('たった今');
  });

  it('< 1 hour → N分前', () => {
    const iso = new Date(NOW - 15 * 60_000).toISOString(); // 15m ago
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('15分前');
  });

  it('< 24 hours → N時間前', () => {
    const iso = new Date(NOW - 5 * 3_600_000).toISOString(); // 5h ago
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('5時間前');
  });

  it('< 7 days → N日前', () => {
    const iso = new Date(NOW - 3 * 86_400_000).toISOString(); // 3d ago
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('3日前');
  });

  it('>= 7 days → Intl fallback (default: month short + day)', () => {
    const iso = new Date(NOW - 10 * 86_400_000).toISOString(); // 10d ago
    const result = formatRelativeTime(iso, undefined, NOW);
    // Should be a date string, not a relative time
    expect(result).not.toContain('前');
    expect(result).not.toBe('たった今');
    expect(result).toBeTruthy();
  });

  it('>= 7 days → custom fallback options', () => {
    const iso = new Date(NOW - 10 * 86_400_000).toISOString();
    const result = formatRelativeTime(
      iso,
      { year: 'numeric', month: '2-digit', day: '2-digit' },
      NOW,
    );
    // Should contain year in numeric format
    expect(result).toContain('2026');
  });

  it('invalid input → returns original string', () => {
    expect(formatRelativeTime('not-a-date', undefined, NOW)).toBe('not-a-date');
    expect(formatRelativeTime('', undefined, NOW)).toBe('');
  });

  it('boundary: exactly 1 minute → 1分前', () => {
    const iso = new Date(NOW - 60_000).toISOString();
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('1分前');
  });

  it('boundary: exactly 1 hour → 1時間前', () => {
    const iso = new Date(NOW - 3_600_000).toISOString();
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('1時間前');
  });

  it('boundary: exactly 1 day → 1日前', () => {
    const iso = new Date(NOW - 86_400_000).toISOString();
    expect(formatRelativeTime(iso, undefined, NOW)).toBe('1日前');
  });
});
