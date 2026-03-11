/**
 * handoffApiCache.ts — In-memory cache and optimistic update management for HandoffApi.
 *
 * Extracted from handoffApi.ts (L29-111) in NR23.
 * Both classes are internal to the handoff feature; they are not part of the public API.
 */
import type { HandoffRecord } from './handoffTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL for cached responses (milliseconds). */
export const CACHE_TTL_MS = 15_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  etag?: string;
};

// ---------------------------------------------------------------------------
// HandoffCache
// ---------------------------------------------------------------------------

/**
 * TTL-based in-memory cache for HandoffApi responses.
 * Entries automatically expire after CACHE_TTL_MS.
 * Includes a simple LRU-style cleanup to limit memory usage.
 */
export class HandoffCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > CACHE_TTL_MS;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, etag?: string): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });
    this.cleanup();
  }

  getETag(key: string): string | null {
    const entry = this.cache.get(key);
    return entry?.etag ?? null;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Evict expired entries when the cache grows beyond 100 items. */
  private cleanup(): void {
    if (this.cache.size > 100) {
      const oldEntries = Array.from(this.cache.entries())
        .filter(([, entry]) => this.isExpired(entry))
        .slice(0, 20);
      oldEntries.forEach(([key]) => this.cache.delete(key));
    }
  }
}

// ---------------------------------------------------------------------------
// OptimisticUpdateManager
// ---------------------------------------------------------------------------

/**
 * Tracks pending (optimistic) updates that have been applied locally
 * but not yet confirmed from the server.
 *
 * Usage pattern:
 *  1. Before PATCH: call setPendingUpdate(id, partialRecord)
 *  2. Call applyPendingUpdates to overlay pending state on cached records
 *  3. After server confirms: call clearPendingUpdate(id)
 *  4. On error: call clearPendingUpdate(id) to roll back
 */
export class OptimisticUpdateManager {
  private pendingUpdates = new Map<string, Partial<HandoffRecord>>();

  setPendingUpdate(id: string, update: Partial<HandoffRecord>): void {
    this.pendingUpdates.set(id, update);
  }

  getPendingUpdate(id: string): Partial<HandoffRecord> | null {
    return this.pendingUpdates.get(id) ?? null;
  }

  clearPendingUpdate(id: string): void {
    this.pendingUpdates.delete(id);
  }

  applyPendingUpdates(records: HandoffRecord[]): HandoffRecord[] {
    return records.map((record) => {
      const pending = this.getPendingUpdate(String(record.id));
      return pending ? { ...record, ...pending } : record;
    });
  }
}
