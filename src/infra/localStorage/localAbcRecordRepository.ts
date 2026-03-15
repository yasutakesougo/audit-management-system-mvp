// ---------------------------------------------------------------------------
// LocalAbcRecordRepository — LocalStorage ベースの ABC 記録永続化
//
// 開発 / デモ環境用。最大 1000 件を FIFO で保持する。
// 将来 SharePoint アダプタに差し替え可能（同一インターフェース）。
// ---------------------------------------------------------------------------

import type {
  AbcRecord,
  AbcRecordCreateInput,
  AbcRecordRepository,
} from '@/domain/abc/abcRecord';

const STORAGE_KEY = 'abc.records.v1';
const MAX_RECORDS = 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readAll(): AbcRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AbcRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: AbcRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId(): string {
  return `abc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const localAbcRecordRepository: AbcRecordRepository = {
  async save(input: AbcRecordCreateInput): Promise<AbcRecord> {
    const records = readAll();

    const saved: AbcRecord = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    // 新規レコードを先頭に追加
    records.unshift(saved);

    // 最大件数を超えたら古いものを削除
    if (records.length > MAX_RECORDS) {
      records.length = MAX_RECORDS;
    }

    writeAll(records);
    return saved;
  },

  async update(id: string, fields: Partial<AbcRecordCreateInput>): Promise<AbcRecord | null> {
    const records = readAll();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const updated: AbcRecord = { ...records[idx], ...fields };
    records[idx] = updated;
    writeAll(records);
    return updated;
  },

  async getAll(): Promise<AbcRecord[]> {
    return readAll();
  },

  async getByUserId(userId: string): Promise<AbcRecord[]> {
    return readAll().filter((r) => r.userId === userId);
  },

  async getById(id: string): Promise<AbcRecord | null> {
    return readAll().find((r) => r.id === id) ?? null;
  },

  async delete(id: string): Promise<void> {
    const records = readAll().filter((r) => r.id !== id);
    writeAll(records);
  },
};
