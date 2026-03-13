// ---------------------------------------------------------------------------
// LocalStaffQualificationRepository — LocalStorage adapters for P4
// ---------------------------------------------------------------------------

import type { StaffTrainingHistory } from '@/domain/regulatory/staffTrainingHistory';
import type { QualificationAssignment } from '@/domain/regulatory/qualificationAssignment';
import type { WeeklyObservationRecord } from '@/domain/regulatory/weeklyObservation';
import type {
  StaffTrainingHistoryRepository,
  QualificationAssignmentRepository,
  WeeklyObservationRepository,
} from '@/domain/regulatory/staffQualificationRepository';

const TRAINING_KEY = 'staff.training.history.v1';
const ASSIGNMENT_KEY = 'staff.assignment.v1';
const OBSERVATION_KEY = 'staff.observation.v1';
const MAX_RECORDS = 500;

// ---------------------------------------------------------------------------
// Generic helpers
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

function saveRecord<T extends { id: string }>(
  key: string,
  prefix: string,
  record: T,
): T {
  const all = readStore<T>(key);
  const existingIndex = all.findIndex((r) => r.id === record.id);

  const saved: T = {
    ...record,
    id: record.id || generateId(prefix),
  };

  if (existingIndex >= 0) {
    all[existingIndex] = saved;
  } else {
    all.unshift(saved);
    if (all.length > MAX_RECORDS) {
      all.length = MAX_RECORDS;
    }
  }

  writeStore(key, all);
  return saved;
}

// ---------------------------------------------------------------------------
// Training History Repository
// ---------------------------------------------------------------------------

export const localStaffTrainingHistoryRepository: StaffTrainingHistoryRepository = {
  async save(record: StaffTrainingHistory): Promise<StaffTrainingHistory> {
    return saveRecord(TRAINING_KEY, 'trh', record);
  },

  async getAll(): Promise<StaffTrainingHistory[]> {
    return readStore<StaffTrainingHistory>(TRAINING_KEY);
  },

  async listByStaff(staffId: string): Promise<StaffTrainingHistory[]> {
    return readStore<StaffTrainingHistory>(TRAINING_KEY).filter(
      (r) => r.staffId === staffId,
    );
  },

  async delete(id: string): Promise<void> {
    const records = readStore<StaffTrainingHistory>(TRAINING_KEY).filter(
      (r) => r.id !== id,
    );
    writeStore(TRAINING_KEY, records);
  },
};

// ---------------------------------------------------------------------------
// Assignment Repository
// ---------------------------------------------------------------------------

export const localQualificationAssignmentRepository: QualificationAssignmentRepository = {
  async save(record: QualificationAssignment): Promise<QualificationAssignment> {
    return saveRecord(ASSIGNMENT_KEY, 'asn', record);
  },

  async getAll(): Promise<QualificationAssignment[]> {
    return readStore<QualificationAssignment>(ASSIGNMENT_KEY);
  },

  async listByStaff(staffId: string): Promise<QualificationAssignment[]> {
    return readStore<QualificationAssignment>(ASSIGNMENT_KEY).filter(
      (r) => r.staffId === staffId,
    );
  },

  async listByUser(userId: string): Promise<QualificationAssignment[]> {
    return readStore<QualificationAssignment>(ASSIGNMENT_KEY).filter(
      (r) => r.userId === userId,
    );
  },

  async delete(id: string): Promise<void> {
    const records = readStore<QualificationAssignment>(ASSIGNMENT_KEY).filter(
      (r) => r.id !== id,
    );
    writeStore(ASSIGNMENT_KEY, records);
  },
};

// ---------------------------------------------------------------------------
// Weekly Observation Repository
// ---------------------------------------------------------------------------

export const localWeeklyObservationRepository: WeeklyObservationRepository = {
  async save(record: WeeklyObservationRecord): Promise<WeeklyObservationRecord> {
    return saveRecord(OBSERVATION_KEY, 'obs', record);
  },

  async getAll(): Promise<WeeklyObservationRecord[]> {
    return readStore<WeeklyObservationRecord>(OBSERVATION_KEY);
  },

  async listByStaffPair(
    observerId: string,
    targetStaffId: string,
  ): Promise<WeeklyObservationRecord[]> {
    return readStore<WeeklyObservationRecord>(OBSERVATION_KEY).filter(
      (r) => r.observerId === observerId && r.targetStaffId === targetStaffId,
    );
  },

  async listByUser(userId: string): Promise<WeeklyObservationRecord[]> {
    return readStore<WeeklyObservationRecord>(OBSERVATION_KEY).filter(
      (r) => r.userId === userId,
    );
  },

  async delete(id: string): Promise<void> {
    const records = readStore<WeeklyObservationRecord>(OBSERVATION_KEY).filter(
      (r) => r.id !== id,
    );
    writeStore(OBSERVATION_KEY, records);
  },
};
