import { describe, expect, it } from 'vitest';

import { validateMonthly } from '@/features/kokuhoren-validation/validateMonthly';
import type { MonthlyProvisionInput, DailyProvisionEntry, KokuhorenUserProfile } from '@/features/kokuhoren-validation/types';
import { ABSENT_SUPPORT_MONTHLY_LIMIT } from '@/features/kokuhoren-validation/catalog';

// ─── ヘルパー ────────────────────────────────────────────────

const baseUser: KokuhorenUserProfile = {
  userCode: 'I022',
  userName: 'テスト太郎',
  recipientCertNumber: '1234567890',
};

const baseRecord: DailyProvisionEntry = {
  userCode: 'I022',
  recordDateISO: '2026-02-01',
  status: '提供',
  startHHMM: 930,
  endHHMM: 1530,
};

const makeInput = (
  overrides?: {
    users?: KokuhorenUserProfile[];
    records?: DailyProvisionEntry[];
  },
): MonthlyProvisionInput => ({
  yearMonth: '2026-02',
  users: overrides?.users ?? [baseUser],
  records: overrides?.records ?? [baseRecord],
});

// ─── 正常系 ─────────────────────────────────────────────────

describe('validateMonthly — 正常系', () => {
  it('正常レコード → issues 0、isValidForExport true', () => {
    const result = validateMonthly(makeInput());
    expect(result.isValidForExport).toBe(true);
    expect(result.summary.blockCount).toBe(0);
    expect(result.summary.totalRecords).toBe(1);
  });

  it('空レコード → issues 0', () => {
    const result = validateMonthly(makeInput({ records: [] }));
    expect(result.isValidForExport).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ─── KOKU-71-001: 受給者証番号 ──────────────────────────────

describe('KOKU-71-001: 受給者証番号未登録', () => {
  it('受給者証番号 null → BLOCK', () => {
    const result = validateMonthly(
      makeInput({ users: [{ ...baseUser, recipientCertNumber: null }] }),
    );
    const found = result.issues.find((i) => i.ruleId === 'KOKU-71-001');
    expect(found).toBeDefined();
    expect(found!.level).toBe('BLOCK');
  });

  it('受給者証番号 9桁 → BLOCK', () => {
    const result = validateMonthly(
      makeInput({ users: [{ ...baseUser, recipientCertNumber: '123456789' }] }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-001')).toBeDefined();
  });

  it('受給者証番号 10桁 → OK', () => {
    const result = validateMonthly(makeInput());
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-001')).toBeUndefined();
  });

  it('レコードのないユーザーはチェックしない', () => {
    const result = validateMonthly(
      makeInput({
        users: [
          baseUser,
          { userCode: 'I099', userName: 'レコードなし', recipientCertNumber: null },
        ],
      }),
    );
    const issues001 = result.issues.filter((i) => i.ruleId === 'KOKU-71-001');
    expect(issues001.every((i) => i.userCode !== 'I099')).toBe(true);
  });
});

// ─── KOKU-71-002: 提供時刻不完全 ───────────────────────────

describe('KOKU-71-002: 提供時刻不完全', () => {
  it('提供 + start null → BLOCK', () => {
    const result = validateMonthly(
      makeInput({ records: [{ ...baseRecord, startHHMM: null }] }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-002')).toBeDefined();
  });

  it('提供 + end null → BLOCK', () => {
    const result = validateMonthly(
      makeInput({ records: [{ ...baseRecord, endHHMM: null }] }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-002')).toBeDefined();
  });

  it('欠席 + 時刻なし → 002は発火しない', () => {
    const result = validateMonthly(
      makeInput({
        records: [{ ...baseRecord, status: '欠席', startHHMM: null, endHHMM: null }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-002')).toBeUndefined();
  });
});

// ─── KOKU-71-003: 開始≧終了 ────────────────────────────────

describe('KOKU-71-003: 開始≧終了', () => {
  it('start > end → BLOCK', () => {
    const result = validateMonthly(
      makeInput({ records: [{ ...baseRecord, startHHMM: 1530, endHHMM: 930 }] }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-003')).toBeDefined();
  });

  it('start == end → BLOCK', () => {
    const result = validateMonthly(
      makeInput({ records: [{ ...baseRecord, startHHMM: 930, endHHMM: 930 }] }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-003')).toBeDefined();
  });
});

// ─── KOKU-71-004: 非提供レコードに時間/加算 ────────────────

describe('KOKU-71-004: 非提供レコードに時間/加算', () => {
  it('欠席 + 時刻あり → BLOCK', () => {
    const result = validateMonthly(
      makeInput({
        records: [{ ...baseRecord, status: '欠席', startHHMM: 930 }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-004')).toBeDefined();
  });

  it('欠席 + 食事あり → BLOCK', () => {
    const result = validateMonthly(
      makeInput({
        records: [{
          ...baseRecord,
          status: '欠席',
          startHHMM: null, endHHMM: null,
          hasMeal: true,
        }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-004')).toBeDefined();
  });

  it('欠席 + 欠席時対応のみ → 004は発火しない', () => {
    const result = validateMonthly(
      makeInput({
        records: [{
          ...baseRecord,
          status: '欠席',
          startHHMM: null, endHHMM: null,
          hasAbsentSupport: true,
        }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-004')).toBeUndefined();
  });
});

// ─── KOKU-71-101: 送迎ありだが時間未入力 ────────────────────

describe('KOKU-71-101: 送迎ありだが時間未入力', () => {
  it('送迎あり + 時刻片方欠け → WARNING', () => {
    const result = validateMonthly(
      makeInput({
        records: [{ ...baseRecord, hasTransport: true, endHHMM: null }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-101')).toBeDefined();
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-101')!.level).toBe('WARNING');
  });

  it('送迎あり + 時刻完全 → OK', () => {
    const result = validateMonthly(
      makeInput({
        records: [{ ...baseRecord, hasTransport: true }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-101')).toBeUndefined();
  });
});

// ─── KOKU-71-102: 滞在時間が極端 ───────────────────────────

describe('KOKU-71-102: 滞在時間が極端', () => {
  it('20分滞在 → WARNING', () => {
    // 9:00〜9:20 = 20min
    const result = validateMonthly(
      makeInput({
        records: [{ ...baseRecord, startHHMM: 900, endHHMM: 920 }],
      }),
    );
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-102')).toBeDefined();
  });

  it('360分（6h）→ OK', () => {
    const result = validateMonthly(makeInput());
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-102')).toBeUndefined();
  });
});

// ─── KOKU-71-103: 欠席時対応の月間回数上限 ─────────────────

describe('KOKU-71-103: 欠席時対応の月間回数上限', () => {
  it(`${ABSENT_SUPPORT_MONTHLY_LIMIT}回以下 → OK`, () => {
    const records: DailyProvisionEntry[] = Array.from({ length: ABSENT_SUPPORT_MONTHLY_LIMIT }, (_, i) => ({
      ...baseRecord,
      recordDateISO: `2026-02-${String(i + 1).padStart(2, '0')}`,
      status: '欠席' as const,
      startHHMM: null,
      endHHMM: null,
      hasAbsentSupport: true,
    }));

    const result = validateMonthly(makeInput({ records }));
    expect(result.issues.find((i) => i.ruleId === 'KOKU-71-103')).toBeUndefined();
  });

  it(`${ABSENT_SUPPORT_MONTHLY_LIMIT + 1}回 → WARNING`, () => {
    const records: DailyProvisionEntry[] = Array.from({ length: ABSENT_SUPPORT_MONTHLY_LIMIT + 1 }, (_, i) => ({
      ...baseRecord,
      recordDateISO: `2026-02-${String(i + 1).padStart(2, '0')}`,
      status: '欠席' as const,
      startHHMM: null,
      endHHMM: null,
      hasAbsentSupport: true,
    }));

    const result = validateMonthly(makeInput({ records }));
    const found = result.issues.find((i) => i.ruleId === 'KOKU-71-103');
    expect(found).toBeDefined();
    expect(found!.level).toBe('WARNING');
  });
});

// ─── isValidForExport ───────────────────────────────────────

describe('isValidForExport', () => {
  it('BLOCKあり → false', () => {
    const result = validateMonthly(
      makeInput({ records: [{ ...baseRecord, startHHMM: null }] }),
    );
    expect(result.isValidForExport).toBe(false);
  });

  it('WARNINGのみ → true', () => {
    const result = validateMonthly(
      makeInput({
        records: [{ ...baseRecord, startHHMM: 900, endHHMM: 920 }],
      }),
    );
    // 20min extreme duration → WARNING but still valid
    expect(result.isValidForExport).toBe(true);
  });
});
