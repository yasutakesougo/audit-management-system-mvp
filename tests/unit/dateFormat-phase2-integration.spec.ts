/**
 * dateFormat-phase2-integration.spec.ts
 *
 * Phase 2 で置換した各ファイルの関数が、
 * 旧実装と同一の出力を返すことを検証する統合テスト。
 *
 * Note: Phase 4 で formatDateJP wrapper は削除済み。
 * 呼び出し元はすべて formatDateYmd を直接使用する形に移行完了。
 */
import { describe, expect, it } from 'vitest';

// ── 置換対象の wrapper 関数を直接インポート ──
import { formatDateLabel } from '@/features/users/UserDetailSections/helpers';

// ── 共通 API ──
import { formatDateYmd, formatDateJapanese, formatDateIso } from '@/lib/dateFormat';

// ─────────────────────────────────────────────────────────────────────
// Round A: formatDateJP (2 files) → formatDateYmd
// Note: formatDateJP wrapper は Phase 4 で削除済み。
// 呼び出し元は formatDateYmd を直接使用。ここでは API 出力を確認。
// ─────────────────────────────────────────────────────────────────────

describe('Phase 2 Round A: formatDateJP → formatDateYmd', () => {
  const cases: Array<{ label: string; input: Date | undefined; expected: string }> = [
    { label: 'valid date → YYYY/MM/DD', input: new Date(2025, 0, 15), expected: '2025/01/15' },
    { label: 'single-digit month/day → zero-padded', input: new Date(2025, 2, 5), expected: '2025/03/05' },
    { label: 'end of year', input: new Date(2025, 11, 31), expected: '2025/12/31' },
    { label: 'undefined → empty string', input: undefined, expected: '' },
  ];

  describe('formatDateYmd (direct — previously support-plan-guide/helpers)', () => {
    for (const { label, input, expected } of cases) {
      it(label, () => {
        expect(formatDateYmd(input ?? null)).toBe(expected);
      });
    }
  });

  describe('formatDateYmd (direct — previously ibd/supportPlanDeadline)', () => {
    for (const { label, input, expected } of cases) {
      it(label, () => {
        expect(formatDateYmd(input ?? null)).toBe(expected);
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Round A: MonitoringCountdown formatDate → formatDateYmd
// ─────────────────────────────────────────────────────────────────────

describe('Phase 2 Round A: MonitoringCountdown formatDate output parity', () => {
  // The formatDate inside MonitoringCountdown is a private const, so we test
  // via the shared API which it now delegates to.
  const cases = [
    { input: new Date(2025, 0, 15), expected: '2025/01/15' },
    { input: new Date(2025, 2, 5), expected: '2025/03/05' },
    { input: new Date(2025, 11, 31), expected: '2025/12/31' },
  ];

  for (const { input, expected } of cases) {
    it(`${expected}`, () => {
      expect(formatDateYmd(input)).toBe(expected);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Round A: InMemoryDailyRecordRepository formatDateLocal → formatDateIso
// ─────────────────────────────────────────────────────────────────────

describe('Phase 2 Round A: formatDateLocal → formatDateIso parity', () => {
  const cases = [
    { input: new Date(2026, 1, 24), expected: '2026-02-24' },
    { input: new Date(2025, 0, 1), expected: '2025-01-01' },
    { input: new Date(2025, 11, 31), expected: '2025-12-31' },
  ];

  for (const { input, expected } of cases) {
    it(`${expected}`, () => {
      expect(formatDateIso(input)).toBe(expected);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Round B: DaySummaryDrawer formatDateDisplay → formatDateJapanese
// ─────────────────────────────────────────────────────────────────────

describe('Phase 2 Round B: DaySummaryDrawer formatDateDisplay → formatDateJapanese parity', () => {
  const cases = [
    { input: '2025-01-15', expected: '2025年1月15日' },
    { input: '2025-03-05', expected: '2025年3月5日' },
    { input: '2025-12-31', expected: '2025年12月31日' },
  ];

  for (const { input, expected } of cases) {
    it(`${input} → ${expected}`, () => {
      expect(formatDateJapanese(input)).toBe(expected);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Round B: UserDetailSections/helpers formatDateLabel
// ─────────────────────────────────────────────────────────────────────

describe('Phase 2 Round B: formatDateLabel (UserDetailSections)', () => {
  it('null → "未設定"', () => {
    expect(formatDateLabel(null)).toBe('未設定');
  });

  it('undefined → "未設定"', () => {
    expect(formatDateLabel(undefined)).toBe('未設定');
  });

  it('empty string → "未設定"', () => {
    expect(formatDateLabel('')).toBe('未設定');
  });

  it('valid ISO date string → YYYY年M月D日', () => {
    expect(formatDateLabel('2025-01-15')).toBe('2025年1月15日');
  });

  it('ISO datetime string → YYYY年M月D日', () => {
    expect(formatDateLabel('2025-01-15T09:30:00Z')).toBe('2025年1月15日');
  });

  it('single-digit month and day → no zero-padding', () => {
    expect(formatDateLabel('2025-03-05')).toBe('2025年3月5日');
  });

  it('invalid string → returns original value (fallback)', () => {
    expect(formatDateLabel('not-a-date')).toBe('not-a-date');
  });
});
