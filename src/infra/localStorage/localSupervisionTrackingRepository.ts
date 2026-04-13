import type { SupervisionTrackingRepository } from '@/domain/ibd/port';
import {
  createInitialSupervisionCounter,
  incrementSupervisionCounter,
  resetSupervisionCounter,
  type SupervisionCounter,
  type SupervisionLogRecord,
} from '@/domain/ibd/supervisionTracking';

const STORAGE_KEY = 'ibd.supervisionTracking.v1';

interface SupervisionTrackingStore {
  counters: SupervisionCounter[];
  logs: SupervisionLogRecord[];
}

const EMPTY_STORE: SupervisionTrackingStore = {
  counters: [],
  logs: [],
};

let memoryStore: SupervisionTrackingStore = { ...EMPTY_STORE };

function readStore(): SupervisionTrackingStore {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    const parsed = JSON.parse(raw) as SupervisionTrackingStore;
    return {
      counters: Array.isArray(parsed.counters) ? parsed.counters : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function writeStore(store: SupervisionTrackingStore): void {
  memoryStore = store;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage 書き込み失敗時は in-memory のみ維持
  }
}

function upsertCounter(
  counters: SupervisionCounter[],
  nextCounter: SupervisionCounter,
): SupervisionCounter[] {
  const index = counters.findIndex((c) => c.userId === nextCounter.userId);
  if (index < 0) return [...counters, nextCounter];
  const copied = [...counters];
  copied[index] = nextCounter;
  return copied;
}

function resolveCounter(
  counters: SupervisionCounter[],
  userId: number,
): SupervisionCounter {
  return counters.find((c) => c.userId === userId)
    ?? createInitialSupervisionCounter(userId);
}

export const localSupervisionTrackingRepository: SupervisionTrackingRepository = {
  getCounter(userId: number): SupervisionCounter {
    const store = readStore();
    return resolveCounter(store.counters, userId);
  },

  incrementSupportCount(userId: number): SupervisionCounter {
    const store = readStore();
    const current = resolveCounter(store.counters, userId);
    const next = incrementSupervisionCounter(current);
    writeStore({
      ...store,
      counters: upsertCounter(store.counters, next),
    });
    return next;
  },

  resetSupportCount(userId: number, observedAt: string): SupervisionCounter {
    const store = readStore();
    const current = resolveCounter(store.counters, userId);
    const next = resetSupervisionCounter(current, observedAt);
    writeStore({
      ...store,
      counters: upsertCounter(store.counters, next),
    });
    return next;
  },

  listLogsForUser(userId: number): SupervisionLogRecord[] {
    const store = readStore();
    return store.logs.filter((log) => log.userId === userId);
  },

  addSupervisionLog(log: SupervisionLogRecord): void {
    const store = readStore();
    const current = resolveCounter(store.counters, log.userId);
    const nextCounter = resetSupervisionCounter(current, log.observedAt);
    writeStore({
      logs: [...store.logs, log],
      counters: upsertCounter(store.counters, nextCounter),
    });
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
