import { cancelIdle, scheduleIdle } from './util';

type PrefetchStatus = 'pending' | 'completed' | 'error' | 'aborted' | 'skipped' | 'reused';
export type PrefetchSource = 'hover' | 'nav' | 'viewport' | 'idle' | 'kbd';

export type PrefetchEntry = {
  key: string;
  source: PrefetchSource;
  status: PrefetchStatus;
  startedAt: number;
  finishedAt?: number;
  ttlMs: number;
  lastHitAt: number;
  meta?: Record<string, unknown>;
  error?: string;
};

type Listener = (entries: PrefetchEntry[]) => void;

const entries = new Map<string, PrefetchEntry>();
const listeners = new Set<Listener>();
let idleHandle: ReturnType<typeof scheduleIdle> | null = null;

/**
 * Creates a sorted snapshot of all prefetch entries.
 * @returns Array of entries sorted by startedAt timestamp
 */
const snapshotEntries = (): PrefetchEntry[] =>
  Array.from(entries.values()).sort((a, b) => a.startedAt - b.startedAt);

const readTtl = (): number => {
  const raw = (import.meta as ImportMeta).env?.VITE_PREFETCH_TTL_MS;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 60_000;
  }
  return parsed;
};

const publish = (): void => {
  const snapshot = snapshotEntries();
  if (typeof window !== 'undefined') {
    const target = window as typeof window & { __PREFETCH_HUD__?: { spans?: PrefetchEntry[] } };
    if (!target.__PREFETCH_HUD__) {
      target.__PREFETCH_HUD__ = {};
    }
    target.__PREFETCH_HUD__.spans = snapshot;
  }
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore subscription errors
    }
  });
};

const scheduleCleanup = (): void => {
  if (idleHandle !== null) {
    return;
  }
  idleHandle = scheduleIdle(() => {
    idleHandle = null;
    const now = Date.now();
    let changed = false;
    // クリーンアップは completed エントリのみ。error/aborted/skipped は履歴として保持
    entries.forEach((entry, key) => {
      if (entry.status === 'completed' && entry.finishedAt && now - entry.finishedAt > entry.ttlMs * 4) {
        entries.delete(key);
        changed = true;
      }
    });
    if (changed) {
      publish();
    }
  }, { timeout: 2_000 });
};

export const resetPrefetchEntries = (): void => {
  entries.clear();
  if (idleHandle !== null) {
    cancelIdle(idleHandle);
    idleHandle = null;
  }
  publish();
};

export const subscribePrefetchEntries = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(snapshotEntries());
  return () => {
    listeners.delete(listener);
  };
};

export const getPrefetchEntries = (): PrefetchEntry[] => Array.from(entries.values());

/**
 * Checks if a prefetch result is still fresh within the TTL period.
 * @param key The prefetch key to check
 * @param ttlMs Time-to-live in milliseconds (defaults to VITE_PREFETCH_TTL_MS)
 * @returns true if the prefetch is fresh and can be reused without re-importing
 * @note Considers both 'completed' and 'reused' status as fresh for consistent caching behavior
 */
export const isPrefetchFresh = (key: string, ttlMs = readTtl()): boolean => {
  const existing = entries.get(key);
  if (
    !existing ||
    // completed か reused を「成功した prefetched」と扱う
    (existing.status !== 'completed' && existing.status !== 'reused') ||
    !existing.finishedAt
  ) {
    return false;
  }
  return Date.now() - existing.finishedAt <= ttlMs;
};

/**
 * Marks an existing prefetch as reused, updating source and metadata.
 * @param key The prefetch key
 * @param source The new source triggering the reuse
 * @param meta Additional metadata to merge with existing meta
 * @note Changes status to 'reused' but preserves finishedAt for TTL calculations
 */
export const markPrefetchReuse = (key: string, source: PrefetchSource, meta?: Record<string, unknown>): void => {
  const now = Date.now();
  const existing = entries.get(key);
  if (existing) {
    entries.set(key, {
      ...existing,
      source,
      status: 'reused',
      lastHitAt: now,
      meta: meta ? { ...(existing.meta ?? {}), ...meta } : existing.meta,
    });
    publish();
  }
};

export const beginPrefetch = (
  key: string,
  source: PrefetchSource,
  meta?: Record<string, unknown>,
  ttlMs = readTtl(),
): PrefetchEntry => {
  const now = Date.now();
  const entry: PrefetchEntry = {
    key,
    source,
    meta,
    status: 'pending',
    startedAt: now,
    lastHitAt: now,
    ttlMs,
  };
  entries.set(key, entry);
  publish();
  return entry;
};

export const finalizePrefetch = (
  key: string,
  status: PrefetchStatus,
  error?: unknown,
): void => {
  const existing = entries.get(key);
  if (!existing) {
    return;
  }
  const now = Date.now();
  entries.set(key, {
    ...existing,
    status,
    finishedAt: now,
    lastHitAt: now,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
  });
  publish();
  if (status === 'completed') {
    scheduleCleanup();
  }
};

export const touchPrefetch = (key: string): void => {
  const existing = entries.get(key);
  if (!existing) {
    return;
  }
  entries.set(key, {
    ...existing,
    lastHitAt: Date.now(),
  });
  publish();
};
