/**
 * Contract Tests: createLocalStorageMeetingMinutesRepository
 *
 * localStorage 実装の保存・取得・更新・検索契約を固定し、
 * meeting-minutes の local / SP 両輪を揃える。
 *
 * ## local vs SP 対応関係
 * | 操作     | localStorageRepository   | sharepointRepository          |
 * |---------|--------------------------|-------------------------------|
 * | フィルタ | matchesSearch (client)   | buildFilter (SP OData) + client |
 * | 変換     | そのまま保存             | mapItemToMinutes              |
 * | 更新     | スプレッド展開           | buildPatchBody → MERGE        |
 * | q/tag   | client matchesSearch     | client 処理（SP では行わない） |
 *
 * ## 仕様の核心
 * - nextId: max(id) + 1（空配列なら 1）
 * - ソート: meetingDate desc → modified desc
 * - publishedOnly: `isPublished === false` のみ除外（undefined は残す）
 * - matchesSearch q: title/summary/tags を対象
 * - update: スプレッドで上書き、modified は自動更新
 * - getById: 存在しない場合は例外
 * - 壊れた localStorage: catch → [] にフォールバック
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MeetingMinutes } from '../../types';
import { createLocalStorageMeetingMinutesRepository } from '../../infra/Legacy/localStorageRepository';

// ─── テスト用フィクスチャ ───────────────────────────────────

const STORAGE_KEY = 'meeting-minutes-local';

function seedStorage(items: MeetingMinutes[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function readStorage(): MeetingMinutes[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MeetingMinutes[];
}

const baseItem: MeetingMinutes = {
  id: 1,
  title: '4月度職員会議',
  meetingDate: '2026-04-01',
  category: '職員会議',
  summary: '今月の目標を確認',
  decisions: '来週実施',
  actions: '担当: 田中',
  tags: '月次,定例',
  relatedLinks: '',
  isPublished: true,
  chair: '田中',
  scribe: '鈴木',
  attendees: ['田中', '鈴木'],
  staffAttendance: '',
  userHealthNotes: '',
  created: '2026-04-01T09:00:00.000Z',
  modified: '2026-04-01T10:00:00.000Z',
};

// ─── セットアップ / クリーンアップ ──────────────────────────

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ─── テスト本体 ──────────────────────────────────────────────

describe('createLocalStorageMeetingMinutesRepository', () => {
  // ── 初期状態 ───────────────────────────────────────────────

  describe('初期状態', () => {
    it('should return empty array when localStorage is empty', async () => {
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({});
      expect(result).toEqual([]);
    });

    it('should return empty array when localStorage key is missing', async () => {
      localStorage.removeItem(STORAGE_KEY);
      const repo = createLocalStorageMeetingMinutesRepository();
      expect(await repo.list({})).toEqual([]);
    });

    it('should return empty array when localStorage value is invalid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json');
      const repo = createLocalStorageMeetingMinutesRepository();
      expect(await repo.list({})).toEqual([]);
    });

    it('should return empty array when localStorage value is null string', async () => {
      localStorage.setItem(STORAGE_KEY, 'null');
      const repo = createLocalStorageMeetingMinutesRepository();
      // JSON.parse('null') = null; then .filter would throw → catch → []
      // 実装の耐性テスト（型アサーション起因の安全性確認）
      const result = await repo.list({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── create ─────────────────────────────────────────────────

  describe('create', () => {
    it('should assign id=1 when storage is empty', async () => {
      const repo = createLocalStorageMeetingMinutesRepository();
      const { id: _, ...draft } = baseItem;
      const id = await repo.create(draft);
      expect(id).toBe(1);
    });

    it('should assign nextId = max(id) + 1', async () => {
      seedStorage([{ ...baseItem, id: 5 }, { ...baseItem, id: 3 }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const { id: _, ...draft } = baseItem;
      const id = await repo.create(draft);
      expect(id).toBe(6);
    });

    it('should persist item to localStorage', async () => {
      const repo = createLocalStorageMeetingMinutesRepository();
      const { id: _, ...draft } = baseItem;
      await repo.create(draft);
      const stored = readStorage();
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe(baseItem.title);
    });

    it('should set created and modified to current ISO timestamp', async () => {
      const before = new Date().toISOString();
      const repo = createLocalStorageMeetingMinutesRepository();
      const { id: _, created: _c, modified: _m, ...draft } = baseItem;
      const id = await repo.create(draft);
      const after = new Date().toISOString();
      const item = await repo.getById(id);
      expect(item.created! >= before).toBe(true);
      expect(item.created! <= after).toBe(true);
      expect(item.modified! >= before).toBe(true);
    });

    it('created items are retrievable via getById', async () => {
      const repo = createLocalStorageMeetingMinutesRepository();
      const { id: _, ...draft } = baseItem;
      const id = await repo.create(draft);
      const item = await repo.getById(id);
      expect(item.id).toBe(id);
      expect(item.title).toBe(draft.title);
    });
  });

  // ── getById ────────────────────────────────────────────────

  describe('getById', () => {
    it('should return the item with matching id', async () => {
      seedStorage([baseItem]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.getById(1);
      expect(result.id).toBe(1);
      expect(result.title).toBe(baseItem.title);
    });

    it('should throw when id does not exist', async () => {
      const repo = createLocalStorageMeetingMinutesRepository();
      await expect(repo.getById(999)).rejects.toThrow('999');
    });
  });

  // ── update ─────────────────────────────────────────────────

  describe('update', () => {
    it('should update only the patched fields', async () => {
      seedStorage([{ ...baseItem, id: 1 }, { ...baseItem, id: 2, title: '別の会議' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      await repo.update(1, { title: '更新済みタイトル' });
      const updated = await repo.getById(1);
      expect(updated.title).toBe('更新済みタイトル');
      expect(updated.category).toBe(baseItem.category); // 他フィールド維持
    });

    it('should NOT affect other items', async () => {
      seedStorage([{ ...baseItem, id: 1 }, { ...baseItem, id: 2, title: '別の会議' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      await repo.update(1, { title: '変更' });
      const other = await repo.getById(2);
      expect(other.title).toBe('別の会議');
    });

    it('should update modified timestamp automatically', async () => {
      seedStorage([baseItem]);
      const before = new Date().toISOString();
      const repo = createLocalStorageMeetingMinutesRepository();
      await repo.update(1, { summary: '更新後' });
      const item = await repo.getById(1);
      expect(item.modified! >= before).toBe(true);
      expect(item.modified).not.toBe(baseItem.modified); // 旧値と異なる
    });

    it('should apply empty string update (explicit clear)', async () => {
      seedStorage([{ ...baseItem, summary: '既存の内容' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      await repo.update(1, { summary: '' });
      const item = await repo.getById(1);
      expect(item.summary).toBe('');
    });

    it('should throw when updating non-existent id', async () => {
      const repo = createLocalStorageMeetingMinutesRepository();
      await expect(repo.update(999, { title: '変更' })).rejects.toThrow('999');
    });
  });

  // ── list / sort ─────────────────────────────────────────────

  describe('list: sort (meetingDate desc → modified desc)', () => {
    it('should sort by meetingDate descending', async () => {
      seedStorage([
        { ...baseItem, id: 1, meetingDate: '2026-01-01' },
        { ...baseItem, id: 2, meetingDate: '2026-03-01' },
        { ...baseItem, id: 3, meetingDate: '2026-02-01' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({});
      expect(result.map((r) => r.meetingDate)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
    });

    it('should sort by modified desc when meetingDate is equal', async () => {
      seedStorage([
        { ...baseItem, id: 1, meetingDate: '2026-03-01', modified: '2026-03-01T09:00:00Z' },
        { ...baseItem, id: 2, meetingDate: '2026-03-01', modified: '2026-03-01T11:00:00Z' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({});
      expect(result[0].id).toBe(2); // 新しい modified が先
    });
  });

  // ── list: publishedOnly ─────────────────────────────────────

  describe('list: publishedOnly', () => {
    it('should exclude isPublished===false when publishedOnly is true', async () => {
      seedStorage([
        { ...baseItem, id: 1, isPublished: true },
        { ...baseItem, id: 2, isPublished: false },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ publishedOnly: true });
      expect(result.map((r) => r.id)).toEqual([1]);
    });

    it('should include items with isPublished===undefined when publishedOnly is true', async () => {
      seedStorage([{ ...baseItem, id: 1, isPublished: undefined }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ publishedOnly: true });
      expect(result.map((r) => r.id)).toContain(1);
    });

    it('should return all items when publishedOnly is false/undefined', async () => {
      seedStorage([
        { ...baseItem, id: 1, isPublished: true },
        { ...baseItem, id: 2, isPublished: false },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      expect(await repo.list({})).toHaveLength(2);
      expect(await repo.list({ publishedOnly: false })).toHaveLength(2);
    });
  });

  // ── list: category ──────────────────────────────────────────

  describe('list: category', () => {
    it('should filter by category', async () => {
      seedStorage([
        { ...baseItem, id: 1, category: '職員会議' },
        { ...baseItem, id: 2, category: '朝会' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ category: '朝会' });
      expect(result.map((r) => r.id)).toEqual([2]);
    });

    it('should return all when category is ALL', async () => {
      seedStorage([
        { ...baseItem, id: 1, category: '職員会議' },
        { ...baseItem, id: 2, category: '朝会' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ category: 'ALL' });
      expect(result).toHaveLength(2);
    });
  });

  // ── list: from/to 境界包含 ──────────────────────────────────

  describe('list: from/to (boundary inclusive)', () => {
    const items: MeetingMinutes[] = [
      { ...baseItem, id: 1, meetingDate: '2026-01-01' },
      { ...baseItem, id: 2, meetingDate: '2026-03-01' },
      { ...baseItem, id: 3, meetingDate: '2026-06-01' },
    ];

    it('should include item on from date (ge)', async () => {
      seedStorage(items);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ from: '2026-03-01' });
      expect(result.map((r) => r.id).sort()).toEqual([2, 3]);
    });

    it('should include item on to date (le)', async () => {
      seedStorage(items);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ to: '2026-03-01' });
      expect(result.map((r) => r.id).sort()).toEqual([1, 2]);
    });

    it('should return items within from/to range', async () => {
      seedStorage(items);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ from: '2026-02-01', to: '2026-05-01' });
      expect(result.map((r) => r.id)).toEqual([2]);
    });
  });

  // ── list: q 検索 ─────────────────────────────────────────────

  describe('list: q (title/summary/tags 対象)', () => {
    it('should match by title', async () => {
      seedStorage([
        { ...baseItem, id: 1, title: '職員会議', summary: '' },
        { ...baseItem, id: 2, title: '朝のミーティング', summary: '' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ q: '朝' });
      expect(result.map((r) => r.id)).toEqual([2]);
    });

    it('should match by summary', async () => {
      seedStorage([{ ...baseItem, id: 1, summary: '重要な議題あり' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ q: '重要' });
      expect(result.map((r) => r.id)).toEqual([1]);
    });

    it('should match by tags', async () => {
      seedStorage([{ ...baseItem, id: 1, tags: '月次,重点課題' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ q: '重点' });
      expect(result.map((r) => r.id)).toEqual([1]);
    });

    it('should be case-insensitive', async () => {
      seedStorage([{ ...baseItem, id: 1, title: 'Meeting Minutes' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ q: 'meeting' });
      expect(result.map((r) => r.id)).toEqual([1]);
    });

    it('should return empty when q does not match any field', async () => {
      seedStorage([baseItem]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ q: 'xyznotfound' });
      expect(result).toEqual([]);
    });
  });

  // ── list: tag ───────────────────────────────────────────────

  describe('list: tag', () => {
    it('should match by tag', async () => {
      seedStorage([
        { ...baseItem, id: 1, tags: '月次,定例' },
        { ...baseItem, id: 2, tags: '臨時' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ tag: '定例' });
      expect(result.map((r) => r.id)).toEqual([1]);
    });

    it('should be case-insensitive for tag', async () => {
      seedStorage([{ ...baseItem, id: 1, tags: 'Monthly' }]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ tag: 'monthly' });
      expect(result).toHaveLength(1);
    });
  });

  // ── list: 複合条件 ──────────────────────────────────────────

  describe('list: 複合条件', () => {
    it('should apply publishedOnly + category together', async () => {
      seedStorage([
        { ...baseItem, id: 1, category: '朝会', isPublished: true },
        { ...baseItem, id: 2, category: '朝会', isPublished: false },
        { ...baseItem, id: 3, category: '職員会議', isPublished: true },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ publishedOnly: true, category: '朝会' });
      expect(result.map((r) => r.id)).toEqual([1]);
    });

    it('should apply q + from/to together', async () => {
      seedStorage([
        { ...baseItem, id: 1, title: '朝会', meetingDate: '2026-03-01' },
        { ...baseItem, id: 2, title: '朝会', meetingDate: '2026-05-01' },
        { ...baseItem, id: 3, title: '職員会議', meetingDate: '2026-03-01' },
      ]);
      const repo = createLocalStorageMeetingMinutesRepository();
      const result = await repo.list({ q: '朝会', from: '2026-04-01' });
      expect(result.map((r) => r.id)).toEqual([2]);
    });
  });

  // ── persistence ─────────────────────────────────────────────

  describe('persistence: 別インスタンスでの読み込み', () => {
    it('should persist data across different repository instances', async () => {
      const repo1 = createLocalStorageMeetingMinutesRepository();
      const { id: _, ...draft } = baseItem;
      const id = await repo1.create(draft);

      // 別インスタンスで読み込む
      const repo2 = createLocalStorageMeetingMinutesRepository();
      const item = await repo2.getById(id);
      expect(item.title).toBe(draft.title);
    });
  });
});
