import { describe, expect, it } from 'vitest';

import { generateCsvFilename, generateKokuhorenCsv71 } from '@/features/kokuhoren-csv/generate71';
import type { DailyProvisionEntry, KokuhorenUserProfile, MonthlyProvisionInput } from '@/features/kokuhoren-validation/types';

// ─── ヘルパー ────────────────────────────────────────────────

const baseUser: KokuhorenUserProfile = {
  userCode: 'I022',
  userName: 'テスト太郎',
  recipientCertNumber: '1234567890',
};

const provideRecord: DailyProvisionEntry = {
  userCode: 'I022',
  recordDateISO: '2026-02-15',
  status: '提供',
  startHHMM: 930,
  endHHMM: 1530,
  hasTransportPickup: true,
  hasTransportDropoff: false,
  hasBath: false,
  hasMeal: false,
};

const absenceRecord: DailyProvisionEntry = {
  userCode: 'I022',
  recordDateISO: '2026-02-16',
  status: '欠席',
};

const makeInput = (
  overrides?: Partial<MonthlyProvisionInput>,
): MonthlyProvisionInput => ({
  yearMonth: '2026-02',
  users: [baseUser],
  records: [provideRecord],
  ...overrides,
});

// ─── generateKokuhorenCsv71 ─────────────────────────────────

describe('generateKokuhorenCsv71', () => {
  it('提供レコード → 列が仕様通りの引用符で出力', () => {
    const csv = generateKokuhorenCsv71(makeInput());
    const lines = csv.split('\r\n').filter(Boolean);

    expect(lines).toHaveLength(1);

    const cols = lines[0].split(',');
    // recordType = 71（数値・引用符なし）
    expect(cols[0]).toBe('71');
    // certNumber（文字列・引用符あり）
    expect(cols[1]).toBe('"1234567890"');
    // provisionDay = 15（数値・引用符なし）
    expect(cols[2]).toBe('15');
    // serviceCode = "1"（提供 → 文字列・引用符あり）
    expect(cols[3]).toBe('"1"');
    // startHHMM = 930
    expect(cols[4]).toBe('930');
    // endHHMM = 1530
    expect(cols[5]).toBe('1530');
    // timeCode（文字列・引用符あり）— 6h → 05
    expect(cols[6]).toBe('"05"');
    // transportPickup = "1"
    expect(cols[7]).toBe('"1"');
    // transportDropoff = empty
    expect(cols[8]).toBe('');
    // mealFlag = empty
    expect(cols[9]).toBe('');
    // bathFlag = empty
    expect(cols[10]).toBe('');
  });

  it('欠席レコード → 時間/加算が空欄', () => {
    const csv = generateKokuhorenCsv71(makeInput({ records: [absenceRecord] }));
    const cols = csv.split('\r\n')[0].split(',');

    // serviceCode = "2"（欠席）
    expect(cols[3]).toBe('"2"');
    // startHHMM/endHHMM/timeCode = 空欄
    expect(cols[4]).toBe('');
    expect(cols[5]).toBe('');
    expect(cols[6]).toBe('');
  });

  it('複数ユーザー × 複数日 → userCode→日付順にソート', () => {
    const records: DailyProvisionEntry[] = [
      { ...provideRecord, userCode: 'I023', recordDateISO: '2026-02-10' },
      { ...provideRecord, userCode: 'I022', recordDateISO: '2026-02-20' },
      { ...provideRecord, userCode: 'I022', recordDateISO: '2026-02-05' },
    ];

    const csv = generateKokuhorenCsv71(makeInput({
      users: [baseUser, { ...baseUser, userCode: 'I023' }],
      records,
    }));

    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3);

    // I022が先、日付昇順
    expect(lines[0]).toContain(',5,'); // day=5
    expect(lines[1]).toContain(',20,'); // day=20
    expect(lines[2]).toContain(',10,'); // I023, day=10
  });

  it('空レコード → 空文字', () => {
    const csv = generateKokuhorenCsv71(makeInput({ records: [] }));
    expect(csv).toBe('');
  });

  it('CRLF改行で末尾改行あり', () => {
    const csv = generateKokuhorenCsv71(makeInput());
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.includes('\r\n')).toBe(true);
  });
});

// ─── generateCsvFilename ────────────────────────────────────

describe('generateCsvFilename', () => {
  it('2026-02 → KOKU_71_202602.csv', () => {
    expect(generateCsvFilename('2026-02')).toBe('KOKU_71_202602.csv');
  });

  it('2025-12 → KOKU_71_202512.csv', () => {
    expect(generateCsvFilename('2025-12')).toBe('KOKU_71_202512.csv');
  });
});
