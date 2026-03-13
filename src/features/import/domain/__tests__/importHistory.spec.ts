// ---------------------------------------------------------------------------
// importHistory.spec — CSVインポート履歴ストアのユニットテスト
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { importHistoryStore, type ImportHistoryEntry } from '../importHistory';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// localStorage のモック
const mockStorage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    mockStorage.delete(key);
  }),
});

function createEntry(
  overrides: Partial<Omit<ImportHistoryEntry, 'id'>> = {},
): Omit<ImportHistoryEntry, 'id'> {
  return {
    importedAt: new Date().toISOString(),
    target: 'users',
    fileName: 'test.csv',
    fileSize: 1024,
    totalRows: 10,
    importedRecords: 8,
    skippedRows: 2,
    errorCount: 0,
    userCount: 5,
    validationIssues: [],
    status: 'success',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importHistoryStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('addEntry', () => {
    it('エントリを追加して自動的にIDを生成する', () => {
      const entry = createEntry();
      const result = importHistoryStore.addEntry(entry);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^imphist_/);
      expect(result.fileName).toBe('test.csv');
      expect(result.status).toBe('success');
    });

    it('指定されたIDを使用する', () => {
      const result = importHistoryStore.addEntry({
        ...createEntry(),
        id: 'custom-id-123',
      });

      expect(result.id).toBe('custom-id-123');
    });

    it('新しいエントリが先頭に追加される', () => {
      importHistoryStore.addEntry(createEntry({ fileName: 'first.csv' }));
      importHistoryStore.addEntry(createEntry({ fileName: 'second.csv' }));

      const entries = importHistoryStore.getAll();
      expect(entries).toHaveLength(2);
      expect(entries[0].fileName).toBe('second.csv');
      expect(entries[1].fileName).toBe('first.csv');
    });

    it('最大件数(100)を超えたら古いものを削除する', () => {
      // 100件追加
      for (let i = 0; i < 100; i++) {
        importHistoryStore.addEntry(createEntry({ fileName: `file_${i}.csv` }));
      }

      expect(importHistoryStore.getAll()).toHaveLength(100);

      // 101件目を追加 → 最古のものが消える
      importHistoryStore.addEntry(createEntry({ fileName: 'newest.csv' }));
      const entries = importHistoryStore.getAll();
      expect(entries).toHaveLength(100);
      expect(entries[0].fileName).toBe('newest.csv');
    });
  });

  describe('getAll', () => {
    it('空のストレージでは空配列を返す', () => {
      expect(importHistoryStore.getAll()).toEqual([]);
    });

    it('すべてのエントリを新しい順で返す', () => {
      importHistoryStore.addEntry(createEntry({ target: 'users' }));
      importHistoryStore.addEntry(createEntry({ target: 'support' }));
      importHistoryStore.addEntry(createEntry({ target: 'care' }));

      const entries = importHistoryStore.getAll();
      expect(entries).toHaveLength(3);
      expect(entries[0].target).toBe('care');
      expect(entries[2].target).toBe('users');
    });

    it('不正なJSONがある場合は空配列を返す', () => {
      mockStorage.set('csvImport.history.v1', 'invalid-json');
      expect(importHistoryStore.getAll()).toEqual([]);
    });
  });

  describe('getByTarget', () => {
    it('ターゲット別にフィルターして返す', () => {
      importHistoryStore.addEntry(createEntry({ target: 'users', fileName: 'u1.csv' }));
      importHistoryStore.addEntry(createEntry({ target: 'support', fileName: 's1.csv' }));
      importHistoryStore.addEntry(createEntry({ target: 'users', fileName: 'u2.csv' }));
      importHistoryStore.addEntry(createEntry({ target: 'care', fileName: 'c1.csv' }));

      const usersEntries = importHistoryStore.getByTarget('users');
      expect(usersEntries).toHaveLength(2);
      expect(usersEntries.every((e) => e.target === 'users')).toBe(true);

      const supportEntries = importHistoryStore.getByTarget('support');
      expect(supportEntries).toHaveLength(1);
      expect(supportEntries[0].fileName).toBe('s1.csv');

      const careEntries = importHistoryStore.getByTarget('care');
      expect(careEntries).toHaveLength(1);
    });

    it('該当なしの場合は空配列を返す', () => {
      importHistoryStore.addEntry(createEntry({ target: 'users' }));
      expect(importHistoryStore.getByTarget('care')).toEqual([]);
    });
  });

  describe('getLatest', () => {
    it('最新 n 件を返す', () => {
      importHistoryStore.addEntry(createEntry({ fileName: 'a.csv' }));
      importHistoryStore.addEntry(createEntry({ fileName: 'b.csv' }));
      importHistoryStore.addEntry(createEntry({ fileName: 'c.csv' }));

      const latest2 = importHistoryStore.getLatest(2);
      expect(latest2).toHaveLength(2);
      expect(latest2[0].fileName).toBe('c.csv');
      expect(latest2[1].fileName).toBe('b.csv');
    });

    it('n が全件数より大きい場合は全件返す', () => {
      importHistoryStore.addEntry(createEntry());
      expect(importHistoryStore.getLatest(10)).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('すべてのエントリを削除する', () => {
      importHistoryStore.addEntry(createEntry());
      importHistoryStore.addEntry(createEntry());
      expect(importHistoryStore.getAll()).toHaveLength(2);

      importHistoryStore.clear();
      expect(importHistoryStore.getAll()).toEqual([]);
    });
  });

  describe('データ整合性', () => {
    it('validationIssues を含むエントリを正しく保存・復元する', () => {
      const entry = createEntry({
        status: 'partial',
        errorCount: 2,
        validationIssues: [
          { field: 'UserID', message: '重複あり', severity: 'warning', count: 3 },
          { field: 'FullName', message: '空欄', severity: 'error', count: 1 },
        ],
      });

      importHistoryStore.addEntry(entry);
      const [saved] = importHistoryStore.getAll();

      expect(saved.status).toBe('partial');
      expect(saved.validationIssues).toHaveLength(2);
      expect(saved.validationIssues[0].field).toBe('UserID');
      expect(saved.validationIssues[0].count).toBe(3);
      expect(saved.validationIssues[1].severity).toBe('error');
    });

    it('notes フィールドが保存される', () => {
      importHistoryStore.addEntry(
        createEntry({
          status: 'failed',
          notes: '保存中にタイムアウトが発生しました。',
        }),
      );

      const [saved] = importHistoryStore.getAll();
      expect(saved.notes).toBe('保存中にタイムアウトが発生しました。');
    });
  });
});
