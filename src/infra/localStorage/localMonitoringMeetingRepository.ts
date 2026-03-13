// ---------------------------------------------------------------------------
// LocalMonitoringMeetingRepository — LocalStorage ベースのモニタリング会議永続化
// ---------------------------------------------------------------------------

import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';

const STORAGE_KEY = 'monitoring.meetings.v1';
const MAX_RECORDS = 500;

function readStore(): MonitoringMeetingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MonitoringMeetingRecord[];
  } catch {
    return [];
  }
}

function writeStore(records: MonitoringMeetingRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId(): string {
  return `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const localMonitoringMeetingRepository: MonitoringMeetingRepository = {
  async save(record: MonitoringMeetingRecord): Promise<MonitoringMeetingRecord> {
    const all = readStore();
    const existingIndex = all.findIndex((r) => r.id === record.id);

    const saved: MonitoringMeetingRecord = {
      ...record,
      id: record.id || generateId(),
    };

    if (existingIndex >= 0) {
      all[existingIndex] = saved;
    } else {
      all.unshift(saved);
      if (all.length > MAX_RECORDS) {
        all.length = MAX_RECORDS;
      }
    }

    writeStore(all);
    return saved;
  },

  async getAll(): Promise<MonitoringMeetingRecord[]> {
    return readStore();
  },

  async getById(id: string): Promise<MonitoringMeetingRecord | null> {
    return readStore().find((r) => r.id === id) ?? null;
  },

  async listByUser(userId: string): Promise<MonitoringMeetingRecord[]> {
    return readStore().filter((r) => r.userId === userId);
  },

  async listByIsp(ispId: string): Promise<MonitoringMeetingRecord[]> {
    return readStore().filter((r) => r.ispId === ispId);
  },

  async delete(id: string): Promise<void> {
    const records = readStore().filter((r) => r.id !== id);
    writeStore(records);
  },
};
