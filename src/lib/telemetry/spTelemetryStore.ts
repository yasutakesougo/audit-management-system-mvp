export type SpFetchTelemetryEvent =
  | 'sp:request_start'
  | 'sp:request_end'
  | 'sp:retry'
  | 'sp:throttled'
  | 'sp:request_failed';

export interface SpMetric {
  timestamp: number;
  event: SpFetchTelemetryEvent;
  url: string;
  method: string;
  lane?: string;
  status?: number;
  attempt?: number;
  durationMs?: number;
  queuedMs?: number;
  retryAfterMs?: number;
  message?: string;
}

const MAX_EVENTS = 1000;
let events: SpMetric[] = [];

export const spTelemetryStore = {
  record(event: SpFetchTelemetryEvent, payload: Omit<SpMetric, 'timestamp' | 'event'>) {
    if (events.length >= MAX_EVENTS) {
      events.shift(); // Ring buffer behavior: drop oldest
    }
    
    // Normalize url to path only for aggregation, strip query params
    const endpointPath = (() => {
      try {
        const u = new URL(payload.url);
        return u.pathname;
      } catch {
        return payload.url.split('?')[0]; // fallback
      }
    })();

    events.push({
      timestamp: Date.now(),
      event,
      ...payload,
      url: endpointPath, // Store normalized endpoint for easier group by
    });
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

    for (const e of events) {
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
    };
  },

  getTopEndpoints() {
    const stats: Record<string, { failures: number; retries: number }> = {};
    
    for (const e of events) {
      const ep = e.url; // already normalized to endpoint in record()
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
