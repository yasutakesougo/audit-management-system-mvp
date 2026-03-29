/**
 * Contract Tests: mapItemToMinutes
 *
 * SharePoint レスポンスアイテム → MeetingMinutes ドメイン型への変換契約を固定する。
 *
 * ## 観点
 * 1. 必須フィールドの正常変換
 * 2. 欠損時のデフォルト値保証
 * 3. 日付の正規化（YYYY-MM-DD への slice）
 * 4. category の fallback（欠損 → '職員会議'）
 * 5. isPublished の boolean 変換と fallback（欠損 → true）
 * 6. attendees の JSON 文字列解析 / 配列直接受け取り / 不正値
 * 7. id の数値変換・NaN ガード
 * 8. created / modified の省略可能性
 * 9. 不正型への耐性（null, number, object など）
 */
import { describe, expect, it } from 'vitest';
import { mapItemToMinutes } from '../../infra/Legacy/sharepointRepository';
import { MeetingMinutesFields as F } from '../sharepoint';

// フル正常アイテムのベース
const validItem = {
  [F.id]: 42,
  [F.title]: '4月度職員会議',
  [F.meetingDate]: '2026-04-01T00:00:00Z',
  [F.category]: '職員会議',
  [F.summary]: '今月の目標を確認',
  [F.decisions]: '来週実施',
  [F.actions]: '担当者: 山田',
  [F.tags]: '月次,記録',
  [F.relatedLinks]: 'https://example.com',
  [F.isPublished]: true,
  [F.chair]: '田中',
  [F.scribe]: '鈴木',
  [F.attendees]: JSON.stringify(['田中', '鈴木', '山田']),
  [F.staffAttendance]: '全員出席',
  [F.userHealthNotes]: '利用者A 体調良好',
  [F.created]: '2026-04-01T09:00:00Z',
  [F.modified]: '2026-04-01T10:00:00Z',
};

describe('mapItemToMinutes', () => {
  // ── 正常変換 ──────────────────────────────────────────────────

  describe('正常アイテム', () => {
    it('should map all fields correctly from a valid SP item', () => {
      const result = mapItemToMinutes(validItem);
      expect(result.id).toBe(42);
      expect(result.title).toBe('4月度職員会議');
      expect(result.category).toBe('職員会議');
      expect(result.summary).toBe('今月の目標を確認');
      expect(result.decisions).toBe('来週実施');
      expect(result.actions).toBe('担当者: 山田');
      expect(result.tags).toBe('月次,記録');
      expect(result.relatedLinks).toBe('https://example.com');
      expect(result.isPublished).toBe(true);
      expect(result.chair).toBe('田中');
      expect(result.scribe).toBe('鈴木');
      expect(result.staffAttendance).toBe('全員出席');
      expect(result.userHealthNotes).toBe('利用者A 体調良好');
      expect(result.created).toBe('2026-04-01T09:00:00Z');
      expect(result.modified).toBe('2026-04-01T10:00:00Z');
    });
  });

  // ── id 変換 ───────────────────────────────────────────────────

  describe('id', () => {
    it('should convert id string to number', () => {
      expect(mapItemToMinutes({ ...validItem, [F.id]: '99' }).id).toBe(99);
    });

    it('should use 0 when id is undefined', () => {
      const { [F.id]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).id).toBe(0);
    });

    it('should use 0 when id results in NaN', () => {
      expect(mapItemToMinutes({ ...validItem, [F.id]: 'not-a-number' }).id).toBe(0);
    });

    it('should use 0 when id is null', () => {
      expect(mapItemToMinutes({ ...validItem, [F.id]: null }).id).toBe(0);
    });
  });

  // ── meetingDate 正規化 ────────────────────────────────────────

  describe('meetingDate', () => {
    it('should slice datetime string to YYYY-MM-DD', () => {
      expect(
        mapItemToMinutes({ ...validItem, [F.meetingDate]: '2026-04-01T09:00:00Z' }).meetingDate
      ).toBe('2026-04-01');
    });

    it('should keep YYYY-MM-DD string as-is (slice is idempotent)', () => {
      expect(
        mapItemToMinutes({ ...validItem, [F.meetingDate]: '2026-04-01' }).meetingDate
      ).toBe('2026-04-01');
    });

    it('should return empty string when meetingDate is missing', () => {
      const { [F.meetingDate]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).meetingDate).toBe('');
    });

    it('should return empty string when meetingDate is null', () => {
      expect(mapItemToMinutes({ ...validItem, [F.meetingDate]: null }).meetingDate).toBe('');
    });
  });

  // ── category デフォルト ───────────────────────────────────────

  describe('category', () => {
    it('should use the given category value', () => {
      expect(mapItemToMinutes({ ...validItem, [F.category]: '朝会' }).category).toBe('朝会');
    });

    it('should default to 職員会議 when category is missing', () => {
      const { [F.category]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).category).toBe('職員会議');
    });

    it('should default to 職員会議 when category is null', () => {
      expect(mapItemToMinutes({ ...validItem, [F.category]: null }).category).toBe('職員会議');
    });

    it('should default to 職員会議 when category is a number', () => {
      expect(mapItemToMinutes({ ...validItem, [F.category]: 999 }).category).toBe('職員会議');
    });
  });

  // ── isPublished ───────────────────────────────────────────────

  describe('isPublished', () => {
    it('should return true when isPublished is true', () => {
      expect(mapItemToMinutes({ ...validItem, [F.isPublished]: true }).isPublished).toBe(true);
    });

    it('should return false when isPublished is false', () => {
      expect(mapItemToMinutes({ ...validItem, [F.isPublished]: false }).isPublished).toBe(false);
    });

    it('should default to true when isPublished is missing', () => {
      const { [F.isPublished]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).isPublished).toBe(true);
    });

    it('should default to true when isPublished is null', () => {
      expect(mapItemToMinutes({ ...validItem, [F.isPublished]: null }).isPublished).toBe(true);
    });

    it('should default to true when isPublished is a string (non-boolean)', () => {
      expect(mapItemToMinutes({ ...validItem, [F.isPublished]: '1' }).isPublished).toBe(true);
    });
  });

  // ── attendees ────────────────────────────────────────────────

  describe('attendees', () => {
    it('should parse JSON string array', () => {
      const result = mapItemToMinutes({
        ...validItem,
        [F.attendees]: JSON.stringify(['A', 'B', 'C']),
      });
      expect(result.attendees).toEqual(['A', 'B', 'C']);
    });

    it('should return empty array on invalid JSON string', () => {
      const result = mapItemToMinutes({ ...validItem, [F.attendees]: 'not-json' });
      expect(result.attendees).toEqual([]);
    });

    it('should return empty array on empty JSON string', () => {
      const result = mapItemToMinutes({ ...validItem, [F.attendees]: '' });
      expect(result.attendees).toEqual([]);
    });

    it('should accept a native string array directly (no JSON encoding)', () => {
      const result = mapItemToMinutes({ ...validItem, [F.attendees]: ['X', 'Y'] });
      expect(result.attendees).toEqual(['X', 'Y']);
    });

    it('should filter out non-string entries from a native array', () => {
      const result = mapItemToMinutes({ ...validItem, [F.attendees]: ['A', 1, null, 'B'] });
      expect(result.attendees).toEqual(['A', 'B']);
    });

    it('should return empty array when attendees is missing', () => {
      const { [F.attendees]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).attendees).toEqual([]);
    });

    it('should return empty array when attendees is null', () => {
      expect(mapItemToMinutes({ ...validItem, [F.attendees]: null }).attendees).toEqual([]);
    });
  });

  // ── 文字列フィールドの欠損デフォルト ('') ─────────────────────

  describe('文字列フィールド欠損時のデフォルト', () => {
    const stringFields = [
      { key: F.title, name: 'title' },
      { key: F.summary, name: 'summary' },
      { key: F.decisions, name: 'decisions' },
      { key: F.actions, name: 'actions' },
      { key: F.tags, name: 'tags' },
      { key: F.relatedLinks, name: 'relatedLinks' },
      { key: F.chair, name: 'chair' },
      { key: F.scribe, name: 'scribe' },
      { key: F.staffAttendance, name: 'staffAttendance' },
      { key: F.userHealthNotes, name: 'userHealthNotes' },
    ] as const;

    for (const { key, name } of stringFields) {
      it(`should default ${name} to '' when missing`, () => {
        const item = { ...validItem };
        delete (item as Record<string, unknown>)[key];
        const result = mapItemToMinutes(item);
        expect((result as Record<string, unknown>)[name]).toBe('');
      });
    }
  });

  // ── created / modified は undefined を許容 ───────────────────

  describe('created / modified (省略可能)', () => {
    it('should return the created string when present', () => {
      expect(mapItemToMinutes(validItem).created).toBe('2026-04-01T09:00:00Z');
    });

    it('should return undefined when created is missing', () => {
      const { [F.created]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).created).toBeUndefined();
    });

    it('should return undefined when modified is missing', () => {
      const { [F.modified]: _, ...rest } = validItem;
      expect(mapItemToMinutes(rest).modified).toBeUndefined();
    });
  });
});
