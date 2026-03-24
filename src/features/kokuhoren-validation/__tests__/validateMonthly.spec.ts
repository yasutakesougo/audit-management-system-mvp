import { describe, expect, it } from 'vitest';
import { validateMonthly } from '../validateMonthly';
import type { DailyProvisionEntry, KokuhorenUserProfile, MonthlyProvisionInput } from '../types';

// ── テストヘルパー ─────────────────────────────────────────────

const user = (overrides: Partial<KokuhorenUserProfile> = {}): KokuhorenUserProfile => ({
  userCode: 'U001',
  userName: 'テスト太郎',
  recipientCertNumber: '1234567890',
  ...overrides,
});

const record = (overrides: Partial<DailyProvisionEntry> = {}): DailyProvisionEntry => ({
  userCode: 'U001',
  recordDateISO: '2026-03-01',
  status: '提供',
  startHHMM: 900,
  endHHMM: 1700,
  ...overrides,
});

const input = (
  records: DailyProvisionEntry[],
  users: KokuhorenUserProfile[] = [user()],
): MonthlyProvisionInput => ({
  yearMonth: '2026-03',
  users,
  records,
});

// ── 正常系 ─────────────────────────────────────────────────────

describe('validateMonthly — 正常系', () => {
  it('正常なレコードでは issues が空になる', () => {
    const result = validateMonthly(input([record()]));
    expect(result.isValidForExport).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary.blockCount).toBe(0);
    expect(result.summary.warningCount).toBe(0);
  });

  it('空レコード配列ではバリデーションが通る', () => {
    const result = validateMonthly(input([]));
    expect(result.isValidForExport).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary.totalRecords).toBe(0);
  });

  it('yearMonthが正しく設定される', () => {
    const result = validateMonthly(input([record()]));
    expect(result.yearMonth).toBe('2026-03');
  });

  it('validRecords = totalRecords - blockCount', () => {
    const result = validateMonthly(input([record()]));
    expect(result.summary.validRecords).toBe(result.summary.totalRecords - result.summary.blockCount);
  });
});

// ── KOKU-71-001: 受給者証番号未登録 ────────────────────────────

describe('KOKU-71-001: 受給者証番号未登録', () => {
  it('受給者証番号が未設定でBLOCK', () => {
    const result = validateMonthly(input(
      [record()],
      [user({ recipientCertNumber: undefined })],
    ));
    const issue = result.issues.find(i => i.ruleId === 'KOKU-71-001');
    expect(issue).toBeDefined();
    expect(issue!.level).toBe('BLOCK');
  });

  it('受給者証番号がnullでBLOCK', () => {
    const result = validateMonthly(input(
      [record()],
      [user({ recipientCertNumber: null })],
    ));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-001')).toBe(true);
  });

  it('受給者証番号が空文字でBLOCK', () => {
    const result = validateMonthly(input(
      [record()],
      [user({ recipientCertNumber: '' })],
    ));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-001')).toBe(true);
  });

  it('受給者証番号が9桁でBLOCK', () => {
    const result = validateMonthly(input(
      [record()],
      [user({ recipientCertNumber: '123456789' })],
    ));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-001')).toBe(true);
  });

  it('受給者証番号が10桁で正常', () => {
    const result = validateMonthly(input(
      [record()],
      [user({ recipientCertNumber: '1234567890' })],
    ));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-001')).toBe(false);
  });

  it('受給者証番号に文字が含まれるとBLOCK', () => {
    const result = validateMonthly(input(
      [record()],
      [user({ recipientCertNumber: '123456789A' })],
    ));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-001')).toBe(true);
  });
});

// ── KOKU-71-002: 提供時刻不完全 ───────────────────────────────

describe('KOKU-71-002: 提供時刻不完全', () => {
  it('提供で開始時刻のみ欠けBLOCK', () => {
    const result = validateMonthly(input([
      record({ startHHMM: null, endHHMM: 1700 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-002')).toBe(true);
  });

  it('提供で終了時刻のみ欠けBLOCK', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: null }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-002')).toBe(true);
  });

  it('提供で両方欠けBLOCK', () => {
    const result = validateMonthly(input([
      record({ startHHMM: null, endHHMM: null }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-002')).toBe(true);
  });

  it('提供で両方あれば正常', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: 1700 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-002')).toBe(false);
  });
});

// ── KOKU-71-003: 開始≧終了 ────────────────────────────────────

describe('KOKU-71-003: 開始≧終了', () => {
  it('開始 > 終了でBLOCK', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 1700, endHHMM: 900 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-003')).toBe(true);
  });

  it('開始 === 終了でBLOCK', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: 900 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-003')).toBe(true);
  });

  it('開始 < 終了で正常', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: 1700 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-003')).toBe(false);
  });
});

// ── KOKU-71-004: 非提供レコードに時間/加算 ────────────────────

describe('KOKU-71-004: 非提供レコードに時間/加算', () => {
  it('欠席レコードに時刻が設定されるとBLOCK', () => {
    const result = validateMonthly(input([
      record({ status: '欠席', startHHMM: 900, endHHMM: 1700 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-004')).toBe(true);
  });

  it('欠席レコードに送迎ありでBLOCK', () => {
    const result = validateMonthly(input([
      record({ status: '欠席', startHHMM: undefined, endHHMM: undefined, hasTransport: true }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-004')).toBe(true);
  });

  it('欠席レコードで時間/加算なしなら正常', () => {
    const result = validateMonthly(input([
      record({ status: '欠席', startHHMM: undefined, endHHMM: undefined }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-004')).toBe(false);
  });
});

// ── KOKU-71-101: 送迎ありだが時間未入力 ───────────────────────

describe('KOKU-71-101: 送迎ありだが時間未入力', () => {
  it('送迎ありで時刻が片方欠けるとWARNING', () => {
    const result = validateMonthly(input([
      record({ hasTransport: true, startHHMM: null, endHHMM: 1700 }),
    ]));
    const issue = result.issues.find(i => i.ruleId === 'KOKU-71-101');
    expect(issue).toBeDefined();
    expect(issue!.level).toBe('WARNING');
  });

  it('送迎ありで時刻が両方あれば正常', () => {
    const result = validateMonthly(input([
      record({ hasTransport: true, startHHMM: 900, endHHMM: 1700 }),
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-101')).toBe(false);
  });
});

// ── KOKU-71-102: 滞在時間が極端 ──────────────────────────────

describe('KOKU-71-102: 滞在時間が極端', () => {
  it('滞在10分でWARNING', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: 910 }), // 10分
    ]));
    const issue = result.issues.find(i => i.ruleId === 'KOKU-71-102');
    expect(issue).toBeDefined();
    expect(issue!.level).toBe('WARNING');
  });

  it('滞在6hで正常', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: 1500 }), // 360分
    ]));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-102')).toBe(false);
  });
});

// ── KOKU-71-103: 欠席時対応の月間回数上限 ────────────────────

describe('KOKU-71-103: 欠席時対応の月間回数上限', () => {
  it('5回（上限超過）でWARNING', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      record({
        recordDateISO: `2026-03-0${i + 1}`,
        status: '欠席',
        startHHMM: undefined,
        endHHMM: undefined,
        hasAbsentSupport: true,
      }),
    );
    const result = validateMonthly(input(records));
    const issue = result.issues.find(i => i.ruleId === 'KOKU-71-103');
    expect(issue).toBeDefined();
    expect(issue!.level).toBe('WARNING');
  });

  it('4回（上限以内）で正常', () => {
    const records = Array.from({ length: 4 }, (_, i) =>
      record({
        recordDateISO: `2026-03-0${i + 1}`,
        status: '欠席',
        startHHMM: undefined,
        endHHMM: undefined,
        hasAbsentSupport: true,
      }),
    );
    const result = validateMonthly(input(records));
    expect(result.issues.some(i => i.ruleId === 'KOKU-71-103')).toBe(false);
  });
});

// ── 集計の正確性 ──────────────────────────────────────────────

describe('集計の正確性', () => {
  it('BLOCK が含まれると isValidForExport が false', () => {
    const result = validateMonthly(input([
      record({ startHHMM: null, endHHMM: null }), // KOKU-71-002 BLOCK
    ]));
    expect(result.isValidForExport).toBe(false);
    expect(result.summary.blockCount).toBeGreaterThan(0);
  });

  it('WARNING のみでは isValidForExport は true', () => {
    const result = validateMonthly(input([
      record({ startHHMM: 900, endHHMM: 910, hasTransport: false }), // 10分 → KOKU-71-102 WARNING
    ]));
    expect(result.isValidForExport).toBe(true);
    expect(result.summary.warningCount).toBeGreaterThan(0);
    expect(result.summary.blockCount).toBe(0);
  });

  it('totalRecords がレコード数と一致', () => {
    const records = [record(), record({ recordDateISO: '2026-03-02' })];
    const result = validateMonthly(input(records));
    expect(result.summary.totalRecords).toBe(2);
  });
});
