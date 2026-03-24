import { describe, expect, it } from 'vitest';
import { serializeCell, serializeRow, serializeRows } from '../serializer';
import type { CsvColumnDef, CsvRowValues } from '../types';

// ── serializeCell ──────────────────────────────────────────────

describe('serializeCell', () => {
  describe('string kind', () => {
    it('wraps value in double quotes', () => {
      expect(serializeCell('hello', 'string')).toBe('"hello"');
    });

    it('escapes internal double quotes', () => {
      expect(serializeCell('say "hi"', 'string')).toBe('"say ""hi"""');
    });

    it('returns empty for null', () => {
      expect(serializeCell(null, 'string')).toBe('');
    });

    it('returns empty for undefined', () => {
      expect(serializeCell(undefined, 'string')).toBe('');
    });

    it('returns empty for empty string', () => {
      expect(serializeCell('', 'string')).toBe('');
    });

    it('converts number to quoted string', () => {
      expect(serializeCell(123, 'string')).toBe('"123"');
    });
  });

  describe('number kind', () => {
    it('outputs number without quotes', () => {
      expect(serializeCell(42, 'number')).toBe('42');
    });

    it('outputs string-encoded number without quotes', () => {
      expect(serializeCell('123', 'number')).toBe('123');
    });

    it('returns empty for null', () => {
      expect(serializeCell(null, 'number')).toBe('');
    });

    it('returns empty for undefined', () => {
      expect(serializeCell(undefined, 'number')).toBe('');
    });

    it('returns empty for empty string', () => {
      expect(serializeCell('', 'number')).toBe('');
    });

    it('returns empty for NaN string', () => {
      expect(serializeCell('abc', 'number')).toBe('');
    });

    it('handles zero correctly', () => {
      expect(serializeCell(0, 'number')).toBe('0');
    });

    it('handles negative numbers', () => {
      expect(serializeCell(-5, 'number')).toBe('-5');
    });
  });
});

// ── serializeRow ───────────────────────────────────────────────

describe('serializeRow', () => {
  const columns: CsvColumnDef[] = [
    { key: 'name', label: '名前', kind: 'string' },
    { key: 'age', label: '年齢', kind: 'number' },
    { key: 'code', label: 'コード', kind: 'string' },
  ];

  it('serializes a full row with comma separation', () => {
    const row: CsvRowValues = { name: '田中', age: 30, code: 'A01' };
    expect(serializeRow(columns, row)).toBe('"田中",30,"A01"');
  });

  it('handles null values as empty cells', () => {
    const row: CsvRowValues = { name: '田中', age: null, code: null };
    expect(serializeRow(columns, row)).toBe('"田中",,');
  });

  it('handles missing keys as empty cells', () => {
    const row: CsvRowValues = { name: '田中' };
    expect(serializeRow(columns, row)).toBe('"田中",,');
  });
});

// ── serializeRows ──────────────────────────────────────────────

describe('serializeRows', () => {
  const columns: CsvColumnDef[] = [
    { key: 'id', label: 'ID', kind: 'number' },
    { key: 'name', label: '名前', kind: 'string' },
  ];

  it('joins rows with CRLF and adds trailing CRLF', () => {
    const rows: CsvRowValues[] = [
      { id: 1, name: '田中' },
      { id: 2, name: '山田' },
    ];
    expect(serializeRows(columns, rows)).toBe('1,"田中"\r\n2,"山田"\r\n');
  });

  it('returns empty string for empty array', () => {
    expect(serializeRows(columns, [])).toBe('');
  });

  it('handles single row with trailing CRLF', () => {
    const rows: CsvRowValues[] = [{ id: 1, name: 'テスト' }];
    expect(serializeRows(columns, rows)).toBe('1,"テスト"\r\n');
  });
});
