// ---------------------------------------------------------------------------
// LocalComplianceRepository — LocalStorage ベースの適正化運用永続化
//
// 開発 / デモ環境用。各レコードは最大 500 件を FIFO で保持する。
// 将来 SharePoint アダプタに差し替え可能（同一インターフェース）。
// ---------------------------------------------------------------------------

import type { CommitteeMeetingRecord } from '@/domain/safety/complianceCommittee';
import type { GuidelineVersion, GuidelineStatus } from '@/domain/safety/guidelineVersion';
import type { TrainingRecord, TrainingStatus } from '@/domain/safety/trainingRecord';
import type {
  CommitteeRepository,
  GuidelineRepository,
  TrainingRepository,
} from '@/domain/safety/complianceRepository';

// ---------------------------------------------------------------------------
// Storage Keys & Constants
// ---------------------------------------------------------------------------

const COMMITTEE_KEY = 'compliance.committee.v1';
const GUIDELINE_KEY = 'compliance.guideline.v1';
const TRAINING_KEY = 'compliance.training.v1';
const MAX_RECORDS = 500;

// ---------------------------------------------------------------------------
// Generic Helpers
// ---------------------------------------------------------------------------

function readStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeStore<T>(key: string, records: T[]): void {
  localStorage.setItem(key, JSON.stringify(records));
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Committee Repository
// ---------------------------------------------------------------------------

export const localCommitteeRepository: CommitteeRepository = {
  async save(record: CommitteeMeetingRecord): Promise<CommitteeMeetingRecord> {
    const records = readStore<CommitteeMeetingRecord>(COMMITTEE_KEY);
    const existingIndex = records.findIndex((r) => r.id === record.id);

    const saved: CommitteeMeetingRecord = {
      ...record,
      id: record.id || generateId('cmte'),
    };

    if (existingIndex >= 0) {
      records[existingIndex] = saved;
    } else {
      records.unshift(saved);
      if (records.length > MAX_RECORDS) {
        records.length = MAX_RECORDS;
      }
    }

    writeStore(COMMITTEE_KEY, records);
    return saved;
  },

  async getAll(): Promise<CommitteeMeetingRecord[]> {
    return readStore<CommitteeMeetingRecord>(COMMITTEE_KEY);
  },

  async getById(id: string): Promise<CommitteeMeetingRecord | null> {
    return readStore<CommitteeMeetingRecord>(COMMITTEE_KEY).find((r) => r.id === id) ?? null;
  },

  async delete(id: string): Promise<void> {
    const records = readStore<CommitteeMeetingRecord>(COMMITTEE_KEY).filter((r) => r.id !== id);
    writeStore(COMMITTEE_KEY, records);
  },
};

// ---------------------------------------------------------------------------
// Guideline Repository
// ---------------------------------------------------------------------------

export const localGuidelineRepository: GuidelineRepository = {
  async save(version: GuidelineVersion): Promise<GuidelineVersion> {
    const records = readStore<GuidelineVersion>(GUIDELINE_KEY);
    const existingIndex = records.findIndex((r) => r.id === version.id);

    const saved: GuidelineVersion = {
      ...version,
      id: version.id || generateId('gl'),
    };

    if (existingIndex >= 0) {
      records[existingIndex] = saved;
    } else {
      records.unshift(saved);
      if (records.length > MAX_RECORDS) {
        records.length = MAX_RECORDS;
      }
    }

    writeStore(GUIDELINE_KEY, records);
    return saved;
  },

  async getAll(): Promise<GuidelineVersion[]> {
    return readStore<GuidelineVersion>(GUIDELINE_KEY);
  },

  async getById(id: string): Promise<GuidelineVersion | null> {
    return readStore<GuidelineVersion>(GUIDELINE_KEY).find((r) => r.id === id) ?? null;
  },

  async getCurrent(): Promise<GuidelineVersion | null> {
    const all = readStore<GuidelineVersion>(GUIDELINE_KEY);
    const active = all
      .filter((v) => v.status === 'active')
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
    return active[0] ?? null;
  },

  async delete(id: string): Promise<void> {
    const records = readStore<GuidelineVersion>(GUIDELINE_KEY).filter((r) => r.id !== id);
    writeStore(GUIDELINE_KEY, records);
  },

  async updateStatus(id: string, status: GuidelineStatus): Promise<GuidelineVersion | null> {
    const records = readStore<GuidelineVersion>(GUIDELINE_KEY);
    const target = records.find((r) => r.id === id);
    if (!target) return null;

    target.status = status;
    writeStore(GUIDELINE_KEY, records);
    return target;
  },
};

// ---------------------------------------------------------------------------
// Training Repository
// ---------------------------------------------------------------------------

export const localTrainingRepository: TrainingRepository = {
  async save(record: TrainingRecord): Promise<TrainingRecord> {
    const records = readStore<TrainingRecord>(TRAINING_KEY);
    const existingIndex = records.findIndex((r) => r.id === record.id);

    const saved: TrainingRecord = {
      ...record,
      id: record.id || generateId('trn'),
    };

    if (existingIndex >= 0) {
      records[existingIndex] = saved;
    } else {
      records.unshift(saved);
      if (records.length > MAX_RECORDS) {
        records.length = MAX_RECORDS;
      }
    }

    writeStore(TRAINING_KEY, records);
    return saved;
  },

  async getAll(): Promise<TrainingRecord[]> {
    return readStore<TrainingRecord>(TRAINING_KEY);
  },

  async getById(id: string): Promise<TrainingRecord | null> {
    return readStore<TrainingRecord>(TRAINING_KEY).find((r) => r.id === id) ?? null;
  },

  async delete(id: string): Promise<void> {
    const records = readStore<TrainingRecord>(TRAINING_KEY).filter((r) => r.id !== id);
    writeStore(TRAINING_KEY, records);
  },

  async updateStatus(id: string, status: TrainingStatus): Promise<TrainingRecord | null> {
    const records = readStore<TrainingRecord>(TRAINING_KEY);
    const target = records.find((r) => r.id === id);
    if (!target) return null;

    target.status = status;
    writeStore(TRAINING_KEY, records);
    return target;
  },
};
