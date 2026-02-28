/**
 * 国保連CSV — シリアライザ
 *
 * 列の kind（string/number）に基づいて引用符を物理制御。
 * 汎用 CSV.stringify は使わない（返戻ゼロの要）。
 *
 * ルール:
 *  - string → "..." （内部の " は "" にエスケープ）
 *  - number → 引用符なし
 *  - null/undefined/'' → 空欄（何も出さない）
 *  - 改行 → \r\n（CRLF）
 */
import type { CsvColumnDef, CsvRowValues } from './types';

/**
 * 値1つをシリアライズ
 */
export function serializeCell(
  value: string | number | null | undefined,
  kind: 'string' | 'number',
): string {
  // 空欄
  if (value == null || value === '') return '';

  if (kind === 'number') {
    // 数値 → 引用符なし、文字列が来ても数値化
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return '';
    return String(n);
  }

  // 文字列 → 必ず引用符
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * 1行をシリアライズ
 */
export function serializeRow(
  columns: CsvColumnDef[],
  row: CsvRowValues,
): string {
  return columns.map((col) => serializeCell(row[col.key], col.kind)).join(',');
}

/**
 * 複数行をシリアライズ（CRLF区切り、末尾改行あり）
 */
export function serializeRows(
  columns: CsvColumnDef[],
  rows: CsvRowValues[],
): string {
  if (rows.length === 0) return '';
  return rows.map((row) => serializeRow(columns, row)).join('\r\n') + '\r\n';
}
