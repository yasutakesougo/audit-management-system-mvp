export type SpFetchTelemetryEvent =
  | 'sp:request_start'
  | 'sp:request_end'
  | 'sp:retry'
  | 'sp:throttled'
  | 'sp:request_failed';

export interface SpMetric {
  timestamp: number;
  event: SpFetchTelemetryEvent | 'config_warning';
  url?: string;
  method?: string;
  lane?: string;
  status?: number;
  attempt?: number;
  durationMs?: number;
  queuedMs?: number;
  retryAfterMs?: number;
  message?: string;
  // Structured Signal fields
  scope?: string;
  code?: string;
  count?: number;
  itemId?: string;
  reason?: string;
}

const MAX_EVENTS = 1000;
let events: SpMetric[] = [];

// ─── Throttle pub/sub (for 429 realtime detection) ──────────────────────────
type ThrottleCallback = () => void;
const _throttleCallbacks: Set<ThrottleCallback> = new Set();

/**
 * 429 発生時に呼ばれるコールバックを登録する。
 * @returns unsubscribe 関数
 */
export function subscribeToThrottle(cb: ThrottleCallback): () => void {
  _throttleCallbacks.add(cb);
  return () => { _throttleCallbacks.delete(cb); };
}

export const spTelemetryStore = {
  record(
    eventOrSignal: SpFetchTelemetryEvent | { type: 'config_warning'; scope: string; code: string; count?: number; message?: string; itemId?: string; reason?: string },
    payload?: Omit<SpMetric, 'timestamp' | 'event'>
  ) {
    if (events.length >= MAX_EVENTS) {
      events.shift(); // Ring buffer behavior: drop oldest
    }
    
    if (typeof eventOrSignal === 'object') {
      // Structured Signal Flow
      events.push({
        timestamp: Date.now(),
        event: 'config_warning',
        scope: eventOrSignal.scope,
        code: eventOrSignal.code,
        count: eventOrSignal.count,
        message: eventOrSignal.message,
        itemId: eventOrSignal.itemId,
        reason: eventOrSignal.reason,
      });
      return;
    }

    // Legacy / SpFetch Flow
    if (!payload) return;

    // Normalize url to path only for aggregation, strip query params
    const endpointPath = (() => {
      try {
        const u = new URL(payload.url || '');
        return u.pathname;
      } catch {
        return (payload.url || '').split('?')[0]; // fallback
      }
    })();

    events.push({
      timestamp: Date.now(),
      event: eventOrSignal,
      ...payload,
      url: endpointPath, // Store normalized endpoint for easier group by
    });

    if (eventOrSignal === 'sp:throttled') {
      _throttleCallbacks.forEach((cb) => { try { cb(); } catch { /* fail-open */ } });
    }
  },

  getSummary() {
    let throttledCount = 0;
    let retryCount = 0;
    let failedCount = 0;

    let totalDurationMs = 0;
    const durations: number[] = [];

    let totalQueuedMs = 0;
    let maxQueuedMs = 0;
    let queueCount = 0;

    const lanes: Record<string, { requests: number; failed: number; retries: number; maxQueue: number; totalQueue: number; totalDur: number; durCount: number }> = {
      read: { requests: 0, failed: 0, retries: 0, maxQueue: 0, totalQueue: 0, totalDur: 0, durCount: 0 },
      write: { requests: 0, failed: 0, retries: 0, maxQueue: 0, totalQueue: 0, totalDur: 0, durCount: 0 },
      provisioning: { requests: 0, failed: 0, retries: 0, maxQueue: 0, totalQueue: 0, totalDur: 0, durCount: 0 }
    };

    let assignmentConcurrencyConflicts = 0;
    const assignmentConflictVehicles: string[] = [];
    let assignmentConflictResolved = 0;
    let assignmentConflictUnresolved = 0;
    let assignmentRetryTotal = 0;

    for (const e of events) {
      if (e.event === 'config_warning' && e.code === 'CONCURRENCY_CONFLICT') {
        assignmentConcurrencyConflicts++;
        if (e.message) {
          const vehicles = e.message.split(',').map(v => v.trim());
          assignmentConflictVehicles.push(...vehicles);
        }
        continue;
      }

      if (e.event === 'config_warning' && (e.code === 'CONFLICT_RESOLVED' || e.code === 'CONFLICT_UNRESOLVED')) {
        if (e.code === 'CONFLICT_RESOLVED') assignmentConflictResolved++;
        else assignmentConflictUnresolved++;
        
        assignmentRetryTotal += Number(e.count ?? 1);
        continue;
      }

      const lane = e.lane && lanes[e.lane] ? e.lane : 'read';

      if (e.event === 'sp:request_start') {
        lanes[lane].requests++;
        if (e.queuedMs !== undefined) {
          totalQueuedMs += e.queuedMs;
          queueCount++;
          maxQueuedMs = Math.max(maxQueuedMs, e.queuedMs);

          lanes[lane].totalQueue += e.queuedMs;
          lanes[lane].maxQueue = Math.max(lanes[lane].maxQueue, e.queuedMs);
        }
      }

      if (e.event === 'sp:throttled') throttledCount++;
      if (e.event === 'sp:retry') {
        retryCount++;
        lanes[lane].retries++;
      }
      if (e.event === 'sp:request_failed') {
        failedCount++;
        lanes[lane].failed++;
      }

      if (e.event === 'sp:request_end' && e.durationMs !== undefined) {
        totalDurationMs += e.durationMs;
        durations.push(e.durationMs);

        lanes[lane].totalDur += e.durationMs;
        lanes[lane].durCount++;
      }
    }

    durations.sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p95DurationMs = durations.length > 0 ? durations[p95Index] : 0;
    const avgDurationMs = durations.length > 0 ? Math.round(totalDurationMs / durations.length) : 0;
    const avgQueuedMs = queueCount > 0 ? Math.round(totalQueuedMs / queueCount) : 0;

    type LaneMetrics = { requests: number; failed: number; retries: number; maxQueuedMs: number; avgQueuedMs: number; avgDurationMs: number };
    const laneMetrics: Record<string, LaneMetrics> = {};
    for (const [lane, data] of Object.entries(lanes)) {
      laneMetrics[lane] = {
        requests: data.requests,
        failed: data.failed,
        retries: data.retries,
        maxQueuedMs: data.maxQueue,
        avgQueuedMs: data.requests > 0 ? Math.round(data.totalQueue / data.requests) : 0,
        avgDurationMs: data.durCount > 0 ? Math.round(data.totalDur / data.durCount) : 0,
      };
    }

    return {
      throttledCount,
      retryCount,
      failedCount,
      avgDurationMs,
      p95DurationMs,
      avgQueuedMs,
      maxQueuedMs,
      lanes: laneMetrics,
      assignmentConcurrencyConflicts,
      assignmentConflictVehicles: [...new Set(assignmentConflictVehicles)], // Unique list
      assignmentConflictResolved,
      assignmentConflictUnresolved,
      assignmentRetryTotal,
    };
  },

  /**
   * Return raw UNRESOLVED assignment-conflict events (as recorded by the
   * `assignment:conflict_unresolved` bridge). The `reason` field carries
   * the specific failure mode (retry_exhausted / item_gone).
   * Consumed by Exception Center to surface genuine human-intervention cases.
   */
  getAssignmentConflictEvents(): Array<{ timestamp: number; reason: string; retryCount: number; itemId: string }> {
    const result: Array<{ timestamp: number; reason: string; retryCount: number; itemId: string }> = [];
    for (const e of events) {
      if (e.event !== 'config_warning') continue;
      if (e.code !== 'CONFLICT_UNRESOLVED') continue;
      result.push({
        timestamp: e.timestamp,
        reason: e.reason ?? e.message ?? '',
        retryCount: Number(e.count ?? 0),
        itemId: e.itemId ?? '',
      });
    }
    return result;
  },

  getTopEndpoints() {
    const stats: Record<string, { failures: number; retries: number }> = {};
    
    for (const e of events) {
      const ep = e.url;
      if (!ep) continue; // Skip non-fetch events or events without URL
      if (!stats[ep]) stats[ep] = { failures: 0, retries: 0 };
      
      if (e.event === 'sp:request_failed') stats[ep].failures++;
      if (e.event === 'sp:retry') stats[ep].retries++;
    }

    return Object.entries(stats)
      .map(([endpoint, data]) => ({ endpoint, ...data }))
      .sort((a, b) => {
        const totalA = a.failures * 10 + a.retries; // Wait, sort properly: failures prioritize over retries
        const totalB = b.failures * 10 + b.retries;
        return totalB - totalA;
      })
      .slice(0, 5); // top 5 endpoints
  },
  
  // For dev panel / testing
  clear() {
    events = [];
  },

  getSnapshot() {
    return {
      summary: this.getSummary(),
      metrics: this.getSummary(), // Added for compatibility with Nightly
      topEndpoints: this.getTopEndpoints(),
      generatedAt: new Date().toISOString(),
    };
  }
};

if (typeof window !== 'undefined') {
  (window as unknown as { spTelemetryStore: typeof spTelemetryStore }).spTelemetryStore = spTelemetryStore;
}

import './dumpSpTelemetry';
