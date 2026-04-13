import type { ABCRecord } from '@/domain/behavior';
import type { BehaviorObservationRepository } from '@/domain/behavior/port';
import { abcRecordSchema } from '@/domain/behavior/abc.schema';

const STORAGE_KEY = 'ibd.behaviorObservations.v1';

interface BehaviorObservationStore {
  records: ABCRecord[];
}

const EMPTY_STORE: BehaviorObservationStore = {
  records: [],
};

let memoryStore: BehaviorObservationStore = { ...EMPTY_STORE };

function readStore(): BehaviorObservationStore {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    const parsed = JSON.parse(raw) as BehaviorObservationStore;
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function writeStore(store: BehaviorObservationStore): void {
  memoryStore = store;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage 書き込み失敗時は in-memory のみ維持
  }
}

function sortByRecordedAtDesc(records: ABCRecord[]): ABCRecord[] {
  return [...records].sort((a, b) => {
    const aTs = new Date(a.recordedAt).getTime();
    const bTs = new Date(b.recordedAt).getTime();
    return bTs - aTs;
  });
}

function validateRecord(record: ABCRecord): ABCRecord {
  const parsed = abcRecordSchema.safeParse(record);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(', ');
    throw new Error(`[localBehaviorObservationRepository] Invalid ABCRecord: ${message}`);
  }
  return parsed.data;
}

export const localBehaviorObservationRepository: BehaviorObservationRepository = {
  add(record: ABCRecord): ABCRecord {
    const validated = validateRecord(record);
    const store = readStore();
    const next = sortByRecordedAtDesc([validated, ...store.records]);
    writeStore({ records: next });
    return validated;
  },

  listByUser(userId: string): ABCRecord[] {
    const store = readStore();
    return sortByRecordedAtDesc(store.records.filter((record) => record.userId === userId));
  },

  listAll(): ABCRecord[] {
    const store = readStore();
    return sortByRecordedAtDesc(store.records);
  },

  clearAll(): void {
    memoryStore = { ...EMPTY_STORE };
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
