import { describe, expect, it } from 'vitest';

import { serializeCell, serializeRow, serializeRows } from '@/features/kokuhoren-csv/serializer';
import type { CsvColumnDef } from '@/features/kokuhoren-csv/types';

// ─── serializeCell ──────────────────────────────────────────

describe('serializeCell', () => {
  // string kind
  it('string: 通常文字列 → "abc"', () => {
    expect(serializeCell('abc', 'string')).toBe('"abc"');
  });

  it('string: ダブルクォート含む → "a""b"', () => {
    expect(serializeCell('a"b', 'string')).toBe('"a""b"');
  });

  it('string: 空文字 → 空欄', () => {
    expect(serializeCell('', 'string')).toBe('');
  });

  it('string: null → 空欄', () => {
    expect(serializeCell(null, 'string')).toBe('');
  });

  it('string: undefined → 空欄', () => {
    expect(serializeCell(undefined, 'string')).toBe('');
  });

  // number kind
  it('number: 数値 → 引用符なし', () => {
    expect(serializeCell(123, 'number')).toBe('123');
  });

  it('number: 文字列数値 → 数値化して引用符なし', () => {
    expect(serializeCell('456' as any, 'number')).toBe('456');
  });

  it('number: null → 空欄', () => {
    expect(serializeCell(null, 'number')).toBe('');
  });

  it('number: NaN文字列 → 空欄', () => {
    expect(serializeCell('abc' as any, 'number')).toBe('');
  });

  it('number: 0 → "0"（有効値）', () => {
    expect(serializeCell(0, 'number')).toBe('0');
  });
});

// ─── serializeRow ───────────────────────────────────────────

describe('serializeRow', () => {
  const cols: CsvColumnDef[] = [
    { key: 'type', label: '種別', kind: 'number' },
    { key: 'cert', label: '受給者番号', kind: 'string' },
    { key: 'day', label: '日', kind: 'number' },
  ];

  it('正常行 → 引用符制御が列ごとに適用', () => {
    const result = serializeRow(cols, { type: 71, cert: '1234567890', day: 15 });
    expect(result).toBe('71,"1234567890",15');
  });

  it('欠損値は空欄', () => {
    const result = serializeRow(cols, { type: 71, cert: null, day: null });
    expect(result).toBe('71,,');
  });
});

// ─── serializeRows ──────────────────────────────────────────

describe('serializeRows', () => {
  const cols: CsvColumnDef[] = [
    { key: 'a', label: 'A', kind: 'number' },
    { key: 'b', label: 'B', kind: 'string' },
  ];

  it('複数行 → CRLF区切り、末尾改行あり', () => {
    const result = serializeRows(cols, [
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ]);
    expect(result).toBe('1,"x"\r\n2,"y"\r\n');
  });

  it('空配列 → 空文字', () => {
    expect(serializeRows(cols, [])).toBe('');
  });
});
