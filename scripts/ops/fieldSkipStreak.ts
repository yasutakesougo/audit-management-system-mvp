/* eslint-disable no-console -- CLI ops script */
import * as fs from 'fs/promises';
import * as path from 'path';

// ── Constants ────────────────────────────────────────────────────────────────

export const PERSISTENT_DRIFT_THRESHOLD = 3;
export const STREAK_STORE_PATH = path.join('.nightly', 'field-skip-streak.json');

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreakEntry {
  streak: number;
  /** JST date string YYYY-MM-DD of the last day this key was observed */
  lastSeen: string;
}

export type StreakStore = Record<string, StreakEntry>;

export interface FieldSkipStreakResult {
  reasonKey: string;
  streak: number;
  status: 'watching' | 'persistent_drift';
}

// ── Date helper ───────────────────────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD string in JST (UTC+9) for the given date.
 * Nightly Patrol runs at UTC 21:00 = JST 06:00 the next day,
 * so using UTC directly would record the wrong date.
 */
export function toJstDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

// ── Streak logic ─────────────────────────────────────────────────────────────

/**
 * Produce an updated streak store given today's observed reason keys.
 *
 * Rules:
 * - key in seenKeys, lastSeen !== today  → streak++, lastSeen = today
 * - key in seenKeys, lastSeen === today  → unchanged  (1-day cap)
 * - key in store but NOT in seenKeys    → streak = 0  (reset)
 * - new key in seenKeys                 → streak = 1
 *
 * `seenKeys` must already be deduped (Set ensures 1-per-run counting).
 */
export function updateStreakStore(
  store: StreakStore,
  seenKeys: Set<string>,
  today: string,
): StreakStore {
  const updated: StreakStore = {};

  // Process keys already in the store
  for (const [key, entry] of Object.entries(store)) {
    if (seenKeys.has(key)) {
      updated[key] = entry.lastSeen === today
        ? entry // already counted today (idempotent)
        : { streak: entry.streak + 1, lastSeen: today };
    } else {
      // Not seen today → reset streak, preserve lastSeen for history
      updated[key] = { streak: 0, lastSeen: entry.lastSeen };
    }
  }

  // New keys seen today that weren't in the store
  for (const key of seenKeys) {
    if (!(key in updated)) {
      updated[key] = { streak: 1, lastSeen: today };
    }
  }

  return updated;
}

/**
 * Build summary result entries from the store.
 * Entries with streak = 0 (not seen today) are excluded from the output.
 */
export function buildStreakResults(store: StreakStore): FieldSkipStreakResult[] {
  return Object.entries(store)
    .filter(([, e]) => e.streak > 0)
    .map(([reasonKey, e]) => ({
      reasonKey,
      streak: e.streak,
      status: e.streak >= PERSISTENT_DRIFT_THRESHOLD ? 'persistent_drift' : 'watching',
    } satisfies FieldSkipStreakResult));
}

// ── Analysis helpers ─────────────────────────────────────────────────────────

/** Parsed representation of a reasonKey ("listKey:fieldName"). */
export interface FieldSkipRankEntry {
  listKey: string;
  fieldName: string;
  reasonKey: string;
  streak: number;
  lastSeen: string;
  status: 'watching' | 'persistent_drift';
}

/**
 * Parse a reasonKey of the form "listKey:fieldName" into its components.
 * If no colon is present the entire string is treated as listKey.
 */
export function parseReasonKey(reasonKey: string): { listKey: string; fieldName: string } {
  const idx = reasonKey.indexOf(':');
  if (idx === -1) return { listKey: reasonKey, fieldName: '' };
  return { listKey: reasonKey.slice(0, idx), fieldName: reasonKey.slice(idx + 1) };
}

/** Subtract `days` calendar days from a YYYY-MM-DD string, return YYYY-MM-DD. */
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z'); // noon UTC avoids any DST issue
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Return entries that have an active streak (> 0) AND were last seen within
 * the `windowDays`-day window ending on `today` (inclusive).
 *
 * e.g. today="2026-04-08", windowDays=7 → includes lastSeen >= "2026-04-02"
 */
export function filterActiveWindow(
  store: StreakStore,
  today: string,
  windowDays: number,
): StreakStore {
  const cutoff = subtractDays(today, windowDays - 1);
  const result: StreakStore = {};
  for (const [key, entry] of Object.entries(store)) {
    if (entry.streak > 0 && entry.lastSeen >= cutoff) {
      result[key] = entry;
    }
  }
  return result;
}

/**
 * Return the top-N entries by streak count from the store, restricted to
 * the active window.  Entries are sorted descending by streak.
 *
 * Default: windowDays=7, topN=5.
 */
export function getTopStreaks(
  store: StreakStore,
  today: string,
  opts?: { windowDays?: number; topN?: number },
): FieldSkipRankEntry[] {
  const windowDays = opts?.windowDays ?? 7;
  const topN = opts?.topN ?? 5;
  const active = filterActiveWindow(store, today, windowDays);

  return Object.entries(active)
    .map(([reasonKey, entry]) => {
      const { listKey, fieldName } = parseReasonKey(reasonKey);
      return {
        listKey,
        fieldName,
        reasonKey,
        streak: entry.streak,
        lastSeen: entry.lastSeen,
        status: (entry.streak >= PERSISTENT_DRIFT_THRESHOLD
          ? 'persistent_drift'
          : 'watching') as FieldSkipRankEntry['status'],
      };
    })
    .sort((a, b) => b.streak - a.streak)
    .slice(0, topN);
}

// ── File I/O ─────────────────────────────────────────────────────────────────

/** Load the streak store from disk. Returns {} when the file does not exist. */
export async function loadStreakStore(filePath: string): Promise<StreakStore> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as StreakStore;
  } catch {
    return {};
  }
}

/**
 * Atomically write the streak store to disk using a tmp-file → rename pattern.
 * Prevents partial writes from corrupting the store on crash or SIGTERM.
 */
export async function saveStreakStore(filePath: string, store: StreakStore): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}`;
  try {
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
    await fs.rename(tmp, filePath);
  } catch (err) {
    // Best-effort cleanup
    await fs.unlink(tmp).catch(() => undefined);
    throw err;
  }
}
