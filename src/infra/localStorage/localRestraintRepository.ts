// ---------------------------------------------------------------------------
// LocalRestraintRepository — LocalStorage ベースの身体拘束等記録永続化
//
// 開発 / デモ環境用。最大 500 件を FIFO で保持する。
// 将来 SharePoint アダプタに差し替え可能（同一インターフェース）。
// ---------------------------------------------------------------------------

import type { PhysicalRestraintRecord, RestraintStatus } from '@/domain/safety/physicalRestraint';
import type { RestraintRepository } from '@/domain/safety/restraintRepository';

const STORAGE_KEY = 'restraint.records.v1';
const MAX_RECORDS = 500;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readAll(): PhysicalRestraintRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PhysicalRestraintRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: PhysicalRestraintRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId(): string {
  return `rst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const localRestraintRepository: RestraintRepository = {
  async save(record: PhysicalRestraintRecord): Promise<PhysicalRestraintRecord> {
    const records = readAll();
    const existingIndex = records.findIndex((r) => r.id === record.id);

    const saved: PhysicalRestraintRecord = {
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

  async getAll(): Promise<PhysicalRestraintRecord[]> {
    return readAll();
  },

  async getByUserId(userId: string): Promise<PhysicalRestraintRecord[]> {
    return readAll().filter((r) => r.userId === userId);
  },

  async getById(id: string): Promise<PhysicalRestraintRecord | null> {
    return readAll().find((r) => r.id === id) ?? null;
  },

  async delete(id: string): Promise<void> {
    const records = readAll().filter((r) => r.id !== id);
    writeAll(records);
  },

  async updateStatus(
    id: string,
    status: RestraintStatus,
    approvedBy?: string,
  ): Promise<PhysicalRestraintRecord | null> {
    const records = readAll();
    const target = records.find((r) => r.id === id);
    if (!target) return null;

    target.status = status;
    if (status === 'approved' && approvedBy) {
      target.approvedBy = approvedBy;
      target.approvedAt = new Date().toISOString();
    }

    writeAll(records);
    return target;
  },
};
