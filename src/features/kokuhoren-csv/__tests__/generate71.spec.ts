import { describe, expect, it } from 'vitest';
import { generateKokuhorenCsv71, generateCsvFilename, CSV71_COLUMNS } from '../generate71';
import type { MonthlyProvisionInput, DailyProvisionEntry, KokuhorenUserProfile } from '@/features/kokuhoren-validation/types';

// ── ヘルパー ───────────────────────────────────────────────────

const user = (overrides: Partial<KokuhorenUserProfile> = {}): KokuhorenUserProfile => ({
  userCode: 'U001',
  userName: 'テスト太郎',
  recipientCertNumber: '1234567890',
  ...overrides,
});

const record = (overrides: Partial<DailyProvisionEntry> = {}): DailyProvisionEntry => ({
  userCode: 'U001',
  recordDateISO: '2026-03-15',
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

// ── CSV71_COLUMNS ──────────────────────────────────────────────

describe('CSV71_COLUMNS', () => {
  it('has 11 columns', () => {
    expect(CSV71_COLUMNS).toHaveLength(11);
  });

  it('starts with recordType (number)', () => {
    expect(CSV71_COLUMNS[0]).toEqual(
      expect.objectContaining({ key: 'recordType', kind: 'number' }),
    );
  });

  it('has certNumber as string kind', () => {
    const col = CSV71_COLUMNS.find(c => c.key === 'certNumber');
    expect(col?.kind).toBe('string');
  });
});

// ── generateKokuhorenCsv71 ─────────────────────────────────────

describe('generateKokuhorenCsv71', () => {
  it('generates CSV with correct record type 71', () => {
    const csv = generateKokuhorenCsv71(input([record()]));
    expect(csv).toContain('71,');
  });

  it('includes quoted cert number', () => {
    const csv = generateKokuhorenCsv71(input([record()]));
    expect(csv).toContain('"1234567890"');
  });

  it('extracts day from recordDateISO', () => {
    const csv = generateKokuhorenCsv71(input([record({ recordDateISO: '2026-03-15' })]));
    // provisionDay = 15 (number kind, no quotes)
    expect(csv).toMatch(/71,"1234567890",15,/);
  });

  it('sets serviceCode "1" for 提供', () => {
    const csv = generateKokuhorenCsv71(input([record({ status: '提供' })]));
    expect(csv).toContain('"1"');
  });

  it('sets serviceCode "2" for 欠席', () => {
    const csv = generateKokuhorenCsv71(input([
      record({ status: '欠席', startHHMM: undefined, endHHMM: undefined }),
    ]));
    expect(csv).toContain('"2"');
  });

  it('outputs start/end HHMM as numbers for 提供', () => {
    const csv = generateKokuhorenCsv71(input([record({ startHHMM: 900, endHHMM: 1700 })]));
    // startHHMM=900, endHHMM=1700 as number kind (no quotes)
    expect(csv).toMatch(/,900,1700,/);
  });

  it('omits start/end for 欠席', () => {
    const csv = generateKokuhorenCsv71(input([
      record({ status: '欠席', startHHMM: undefined, endHHMM: undefined }),
    ]));
    // Null values produce empty cells: ,,
    const lines = csv.split('\r\n').filter(Boolean);
    const fields = lines[0].split(',');
    // startHHMM(index 4) and endHHMM(index 5) should be empty
    expect(fields[4]).toBe('');
    expect(fields[5]).toBe('');
  });

  it('derives timeCode for 提供', () => {
    // 900-1700 = 480min → code '07'
    const csv = generateKokuhorenCsv71(input([record({ startHHMM: 900, endHHMM: 1700 })]));
    expect(csv).toContain('"07"');
  });

  it('sets transport flags', () => {
    const csv = generateKokuhorenCsv71(input([
      record({ hasTransportPickup: true, hasTransportDropoff: true }),
    ]));
    // transportPickup and transportDropoff are string kind → quoted "1"
    // Count occurrences of "1" — at least 2 for transport flags
    const matches = csv.match(/"1"/g);
    expect(matches!.length).toBeGreaterThanOrEqual(3); // serviceCode + 2 transport
  });

  it('returns empty string for empty records', () => {
    const csv = generateKokuhorenCsv71(input([]));
    expect(csv).toBe('');
  });

  it('sorts by userCode then recordDateISO', () => {
    const csv = generateKokuhorenCsv71(input(
      [
        record({ userCode: 'U002', recordDateISO: '2026-03-02' }),
        record({ userCode: 'U001', recordDateISO: '2026-03-02' }),
        record({ userCode: 'U001', recordDateISO: '2026-03-01' }),
      ],
      [user(), user({ userCode: 'U002', userName: 'テスト次郎' })],
    ));
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3);
    // U001/03-01 first, U001/03-02 second, U002/03-02 third
    expect(lines[0]).toContain(',1,'); // day=1
    expect(lines[1]).toContain(',2,'); // day=2 (U001)
    expect(lines[2]).toContain(',2,'); // day=2 (U002)
  });

  it('ends each line with CRLF', () => {
    const csv = generateKokuhorenCsv71(input([record()]));
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

// ── generateCsvFilename ────────────────────────────────────────

describe('generateCsvFilename', () => {
  it('generates correct filename format', () => {
    expect(generateCsvFilename('2026-03')).toBe('KOKU_71_202603.csv');
  });

  it('handles different year-month', () => {
    expect(generateCsvFilename('2025-12')).toBe('KOKU_71_202512.csv');
  });
});
