// ---------------------------------------------------------------------------
// LocalIncidentRepository — LocalStorage ベースのインシデント記録永続化
//
// 開発 / デモ環境用。最大 500 件を FIFO で保持する。
// 将来 SharePoint アダプタに差し替え可能（同一インターフェース）。
// ---------------------------------------------------------------------------

import type { IncidentRecord, IncidentRepository } from '@/domain/support/incidentRepository';

const STORAGE_KEY = 'incident.records.v1';
const MAX_RECORDS = 500;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readAll(): IncidentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as IncidentRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: IncidentRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId(): string {
  return `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const localIncidentRepository: IncidentRepository = {
  async save(record: IncidentRecord): Promise<IncidentRecord> {
    const records = readAll();
    const existingIndex = records.findIndex((r) => r.id === record.id);

    const saved: IncidentRecord = {
      ...record,
      id: record.id || generateId(),
    };

    if (existingIndex >= 0) {
      // 既存レコードの更新
      records[existingIndex] = saved;
    } else {
      // 新規レコードを先頭に追加
      records.unshift(saved);

      // 最大件数を超えたら古いものを削除
      if (records.length > MAX_RECORDS) {
        records.length = MAX_RECORDS;
      }
    }

    writeAll(records);
    return saved;
  },

  async getAll(): Promise<IncidentRecord[]> {
    return readAll();
  },

  async getByUserId(userId: string): Promise<IncidentRecord[]> {
    return readAll().filter((r) => r.userId === userId);
  },

  async getById(id: string): Promise<IncidentRecord | null> {
    return readAll().find((r) => r.id === id) ?? null;
  },

  async delete(id: string): Promise<void> {
    const records = readAll().filter((r) => r.id !== id);
    writeAll(records);
  },
};
