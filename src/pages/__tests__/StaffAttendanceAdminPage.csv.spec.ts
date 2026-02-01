import { describe, it, expect } from 'vitest';

// CSV helper functions (extracted for testing)
const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCsv = (rows: Array<Record<string, unknown>>, headers: Array<[string, string]>) => {
  const headerLine = headers.map(([, label]) => csvEscape(label)).join(',');
  const lines = rows.map((r) => headers.map(([key]) => csvEscape(r[key])).join(','));
  // Excel対策: UTF-8 BOM
  return `\ufeff${headerLine}\n${lines.join('\n')}\n`;
};

describe('StaffAttendanceAdminPage CSV Export', () => {
  describe('csvEscape', () => {
    it('escapes commas, quotes, and newlines correctly', () => {
      expect(csvEscape('normal text')).toBe('normal text');
      expect(csvEscape('text, with comma')).toBe('"text, with comma"');
      expect(csvEscape('text "with" quotes')).toBe('"text ""with"" quotes"');
      expect(csvEscape('text\nwith\nnewlines')).toBe('"text\nwith\nnewlines"');
      expect(csvEscape(null)).toBe('');
      expect(csvEscape(undefined)).toBe('');
      expect(csvEscape(123)).toBe('123');
    });
  });

  describe('toCsv', () => {
    it('generates CSV with BOM, header, and rows', () => {
      const headers: Array<[string, string]> = [
        ['id', 'ID'],
        ['name', '名前'],
        ['status', 'ステータス'],
      ];

      const rows = [
        { id: '001', name: '太郎', status: '出勤' },
        { id: '002', name: '花子', status: '欠勤' },
      ];

      const csv = toCsv(rows, headers);

      // BOM + ヘッダー + 2行 + 最終改行
      expect(csv).toBe('\ufeffID,名前,ステータス\n001,太郎,出勤\n002,花子,欠勤\n');
    });

    it('handles empty rows', () => {
      const headers: Array<[string, string]> = [['id', 'ID']];
      const rows: Array<Record<string, unknown>> = [];

      const csv = toCsv(rows, headers);

      // BOM + ヘッダーのみ
      expect(csv).toBe('\ufeffID\n\n');
    });

    it('handles special characters in data', () => {
      const headers: Array<[string, string]> = [
        ['note', '備考'],
      ];

      const rows = [
        { note: 'コンマ,付き' },
        { note: 'ダブル"クォート' },
        { note: '改行\n入り' },
      ];

      const csv = toCsv(rows, headers);

      expect(csv).toBe('\ufeff備考\n"コンマ,付き"\n"ダブル""クォート"\n"改行\n入り"\n');
    });
  });
});
