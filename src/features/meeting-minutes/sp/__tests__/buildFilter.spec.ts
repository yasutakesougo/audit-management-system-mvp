/**
 * Contract Tests: buildFilter / escapeODataString
 *
 * meeting-minutes SP 向け OData フィルタ文字列の仕様を固定する。
 *
 * ## 設計仕様（コメントから確認済み）
 * - q / tag は SharePoint OData では扱わず、クライアント側でフィルタ処理する
 * - from / to は境界値を含む（ge / le）
 * - 複数条件は ' and ' で結合する
 * - category: 'ALL' は条件なし扱い
 * - publishedOnly は isPublished eq 1
 *
 * ## local matchesSearch との対応
 * | 条件     | SP buildFilter   | local matchesSearch       |
 * |---------|------------------|---------------------------|
 * | q       | なし（クライアント）| title/summary/tags contains |
 * | tag     | なし（クライアント）| tags contains              |
 * | category| Category eq '.'  | category ===               |
 * | from    | MeetingDate ge   | date >= from               |
 * | to      | MeetingDate le   | date <= to                 |
 */
import { describe, expect, it } from 'vitest';
import {
  buildFilter,
  escapeODataString,
} from '../sharepointRepository';

// フィールド名の定数（実装と同期を保つためインポート）
import { MeetingMinutesFields as F } from '../sharepoint';

describe('buildFilter', () => {
  // ── 基底ケース ──────────────────────────────────────────────

  describe('条件なし', () => {
    it('should return empty string when no params given', () => {
      expect(buildFilter({})).toBe('');
    });

    it('should return empty string when all params are undefined', () => {
      expect(buildFilter({
        q: undefined,
        tag: undefined,
        category: undefined,
        from: undefined,
        to: undefined,
        publishedOnly: undefined,
      })).toBe('');
    });
  });

  // ── 単一条件 ────────────────────────────────────────────────

  describe('publishedOnly', () => {
    it('should include isPublished eq 1 when publishedOnly is true', () => {
      const result = buildFilter({ publishedOnly: true });
      expect(result).toBe(`${F.isPublished} eq 1`);
    });

    it('should not include isPublished filter when publishedOnly is false', () => {
      const result = buildFilter({ publishedOnly: false });
      expect(result).toBe('');
    });
  });

  describe('category', () => {
    it('should include category eq condition for specific category', () => {
      const result = buildFilter({ category: '職員会議' });
      expect(result).toBe(`${F.category} eq '職員会議'`);
    });

    it('should NOT include category filter when category is ALL', () => {
      const result = buildFilter({ category: 'ALL' });
      expect(result).toBe('');
    });

    it('should NOT include category filter when category is undefined', () => {
      const result = buildFilter({ category: undefined });
      expect(result).toBe('');
    });
  });

  describe('from', () => {
    it('should include ge condition for from date (inclusive lower bound)', () => {
      const result = buildFilter({ from: '2026-01-01' });
      expect(result).toBe(`${F.meetingDate} ge '2026-01-01'`);
    });

    it('should use the exact date string without transformation', () => {
      const result = buildFilter({ from: '2026-03-18' });
      expect(result).toContain("'2026-03-18'");
    });
  });

  describe('to', () => {
    it('should include le condition for to date (inclusive upper bound)', () => {
      const result = buildFilter({ to: '2026-12-31' });
      expect(result).toBe(`${F.meetingDate} le '2026-12-31'`);
    });

    it('should use the exact date string without transformation', () => {
      const result = buildFilter({ to: '2026-03-18' });
      expect(result).toContain("'2026-03-18'");
    });
  });

  // ── q / tag はSPフィルタに含まれない（設計仕様の固定） ──────────

  describe('q (client-side フィルタ)', () => {
    it('should NOT include q in SP filter string (client-side processing)', () => {
      const result = buildFilter({ q: '会議' });
      expect(result).toBe('');
    });

    it('should NOT include q even in combination with other params', () => {
      const result = buildFilter({ q: '計画', publishedOnly: true });
      // publishedOnly は残る、q は含まれない
      expect(result).toBe(`${F.isPublished} eq 1`);
      expect(result).not.toContain('計画');
    });
  });

  describe('tag (client-side フィルタ)', () => {
    it('should NOT include tag in SP filter string (client-side processing)', () => {
      const result = buildFilter({ tag: '振り返り' });
      expect(result).toBe('');
    });

    it('should NOT include tag even in combination with other params', () => {
      const result = buildFilter({ tag: '訓練', category: '防災訓練' });
      expect(result).toBe(`${F.category} eq '防災訓練'`);
      expect(result).not.toContain('訓練用タグ');
    });
  });

  // ── 複合条件 ────────────────────────────────────────────────

  describe('from + to (日付範囲)', () => {
    it('should join from and to with AND', () => {
      const result = buildFilter({ from: '2026-01-01', to: '2026-03-31' });
      expect(result).toBe(
        `${F.meetingDate} ge '2026-01-01' and ${F.meetingDate} le '2026-03-31'`
      );
    });

    it('should handle same date for from and to (single day)', () => {
      const result = buildFilter({ from: '2026-03-18', to: '2026-03-18' });
      expect(result).toBe(
        `${F.meetingDate} ge '2026-03-18' and ${F.meetingDate} le '2026-03-18'`
      );
    });
  });

  describe('publishedOnly + category', () => {
    it('should join publishedOnly and category with AND', () => {
      const result = buildFilter({ publishedOnly: true, category: '職員会議' });
      expect(result).toBe(
        `${F.isPublished} eq 1 and ${F.category} eq '職員会議'`
      );
    });
  });

  describe('full combination (publishedOnly + category + from + to)', () => {
    it('should join all SP-side conditions with AND in order', () => {
      const result = buildFilter({
        publishedOnly: true,
        category: '職員会議',
        from: '2026-01-01',
        to: '2026-12-31',
      });
      expect(result).toBe(
        `${F.isPublished} eq 1 and ` +
        `${F.category} eq '職員会議' and ` +
        `${F.meetingDate} ge '2026-01-01' and ` +
        `${F.meetingDate} le '2026-12-31'`
      );
    });

    it('should ignore q and tag in full combination', () => {
      const result = buildFilter({
        q: '検索ワード',
        tag: 'タグ',
        publishedOnly: true,
        category: '職員会議',
        from: '2026-01-01',
        to: '2026-12-31',
      });
      expect(result).not.toContain('検索ワード');
      expect(result).not.toContain('タグ');
      expect(result).toContain(`${F.isPublished} eq 1`);
    });
  });
});

// ── escapeODataString ──────────────────────────────────────────

describe('escapeODataString', () => {
  it('should return the string unchanged when no single quotes', () => {
    expect(escapeODataString('職員会議')).toBe('職員会議');
  });

  it('should escape a single quote to double single quotes', () => {
    expect(escapeODataString("O'Brien")).toBe("O''Brien");
  });

  it('should escape multiple single quotes', () => {
    expect(escapeODataString("it's a 'test'")).toBe("it''s a ''test''");
  });

  it('should handle string with only single quotes', () => {
    expect(escapeODataString("'")).toBe("''");
  });

  it('should handle consecutive single quotes', () => {
    expect(escapeODataString("''")).toBe("''''");
  });

  it('should handle empty string', () => {
    expect(escapeODataString('')).toBe('');
  });

  it('should be applied in category filter to prevent OData injection', () => {
    // category に ' が含まれる場合もフィルタ文字列が壊れないこと
    const result = buildFilter({ category: "it's a test" as never });
    expect(result).toBe(`${F.category} eq 'it''s a test'`);
  });
});
