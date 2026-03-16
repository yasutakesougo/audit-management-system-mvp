import { describe, expect, it } from 'vitest';
import {
  computeBreakerStats,
  evaluateBreakerState,
  formatBreakerReason,
  DEFAULT_THRESHOLDS,
  type BreakerSample,
  type BreakerPreviousState,
} from '@/lib/circuitBreaker/evaluator';

// ─── helpers ────────────────────────────────────────────────────────────────

const ok = (durationMs = 100, retryCount = 0): BreakerSample => ({
  status: 200,
  durationMs,
  ok: true,
  retryCount,
  timestamp: Date.now(),
});

const err = (status = 500, durationMs = 100): BreakerSample => ({
  status,
  durationMs,
  ok: false,
  retryCount: 0,
  timestamp: Date.now(),
});

const slow = (durationMs = 3000): BreakerSample => ({
  status: 200,
  durationMs,
  ok: true,
  retryCount: 0,
  timestamp: Date.now(),
});

const CLOSED: BreakerPreviousState = { state: 'CLOSED', openedAt: null };

// ─── computeBreakerStats ────────────────────────────────────────────────────

describe('computeBreakerStats', () => {
  it('returns empty stats for empty input', () => {
    const stats = computeBreakerStats([]);
    expect(stats.total).toBe(0);
    expect(stats.successRate).toBe(1);
    expect(stats.consecutiveFailures).toBe(0);
  });

  it('counts successes and errors', () => {
    const samples = [ok(), ok(), err(500), ok(), err(429)];
    const stats = computeBreakerStats(samples);
    expect(stats.total).toBe(5);
    expect(stats.successCount).toBe(3);
    expect(stats.errorCount).toBe(2);
  });

  it('counts slow requests', () => {
    const samples = [ok(100), slow(3000), slow(2500), ok(50)];
    const stats = computeBreakerStats(samples);
    expect(stats.slowCount).toBe(2);
  });

  it('counts network errors (status 0) as errors', () => {
    const samples = [ok(), err(0), ok()];
    const stats = computeBreakerStats(samples);
    expect(stats.errorCount).toBe(1);
  });

  it('calculates consecutive failures from tail', () => {
    const samples = [ok(), err(500), err(429), err(503)];
    const stats = computeBreakerStats(samples);
    expect(stats.consecutiveFailures).toBe(3);
  });

  it('resets consecutive failures on success', () => {
    const samples = [err(500), err(500), ok()];
    const stats = computeBreakerStats(samples);
    expect(stats.consecutiveFailures).toBe(0);
  });

  it('calculates average and p95 duration', () => {
    // 10 samples: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    const samples = Array.from({ length: 10 }, (_, i) => ok((i + 1) * 100));
    const stats = computeBreakerStats(samples);
    expect(stats.avgDurationMs).toBe(550);
    expect(stats.p95DurationMs).toBe(1000); // ceil(10*0.95) - 1 = index 9
  });

  it('sums retry counts', () => {
    const samples = [ok(100, 2), ok(100, 1), ok(100, 0)];
    const stats = computeBreakerStats(samples);
    expect(stats.totalRetries).toBe(3);
  });

  it('only uses last N samples from window', () => {
    const thresholds = { ...DEFAULT_THRESHOLDS, windowSize: 3 };
    const samples = [err(500), err(500), err(500), ok(), ok(), ok()];
    const stats = computeBreakerStats(samples, thresholds);
    expect(stats.errorCount).toBe(0);
    expect(stats.successCount).toBe(3);
  });
});

// ─── evaluateBreakerState ───────────────────────────────────────────────────

describe('evaluateBreakerState', () => {
  const NOW = 100_000;

  it('stays CLOSED with all-ok samples', () => {
    const samples = Array.from({ length: 10 }, () => ok());
    const result = evaluateBreakerState('sp', samples, CLOSED, NOW);
    expect(result.state).toBe('CLOSED');
    expect(result.reason).toBeNull();
  });

  it('stays CLOSED with insufficient samples', () => {
    const samples = [err(500), err(500)]; // only 2
    const result = evaluateBreakerState('sp', samples, CLOSED, NOW);
    expect(result.state).toBe('CLOSED');
  });

  it('opens on error rate threshold', () => {
    const samples = [
      ...Array.from({ length: 15 }, () => ok()),
      ...Array.from({ length: 5 }, () => err(500)),
    ];
    const result = evaluateBreakerState('sp', samples, CLOSED, NOW);
    expect(result.state).toBe('OPEN');
    expect(result.reason?.kind).toBe('error_rate');
    expect(result.openedAt).toBe(NOW);
  });

  it('opens on 429 throttling', () => {
    const samples = [
      ...Array.from({ length: 15 }, () => ok()),
      ...Array.from({ length: 5 }, () => err(429)),
    ];
    const result = evaluateBreakerState('sp', samples, CLOSED, NOW);
    expect(result.state).toBe('OPEN');
  });

  it('opens on consecutive failures', () => {
    const samples = [ok(), ok(), ok(), err(500), err(500), err(500)];
    const result = evaluateBreakerState('sp', samples, CLOSED, NOW);
    expect(result.state).toBe('OPEN');
    expect(result.reason?.kind).toBe('consecutive_failures');
  });

  it('opens on slow rate', () => {
    const thresholds = { ...DEFAULT_THRESHOLDS, slowCountThreshold: 3 };
    const samples = [
      ok(), ok(),
      slow(3000), slow(3000), slow(3000),
    ];
    const result = evaluateBreakerState('sp', samples, CLOSED, NOW, thresholds);
    expect(result.state).toBe('OPEN');
    expect(result.reason?.kind).toBe('slow_rate');
  });

  it('stays OPEN during cooldown', () => {
    const openedAt = NOW - 10_000; // 10s ago, cooldown is 30s
    const prev: BreakerPreviousState = { state: 'OPEN', openedAt };
    const result = evaluateBreakerState('sp', [ok()], prev, NOW);
    expect(result.state).toBe('OPEN');
  });

  it('transitions OPEN → HALF_OPEN after cooldown', () => {
    const openedAt = NOW - 31_000; // 31s ago, cooldown is 30s
    const prev: BreakerPreviousState = { state: 'OPEN', openedAt };
    const result = evaluateBreakerState('sp', [ok()], prev, NOW);
    expect(result.state).toBe('HALF_OPEN');
  });

  it('transitions HALF_OPEN → CLOSED on success', () => {
    const prev: BreakerPreviousState = { state: 'HALF_OPEN', openedAt: NOW - 40_000 };
    const samples = [ok()];
    const result = evaluateBreakerState('sp', samples, prev, NOW);
    expect(result.state).toBe('CLOSED');
    expect(result.openedAt).toBeNull();
  });

  it('transitions HALF_OPEN → OPEN on failure', () => {
    const prev: BreakerPreviousState = { state: 'HALF_OPEN', openedAt: NOW - 40_000 };
    const samples = [err(500)];
    const result = evaluateBreakerState('sp', samples, prev, NOW);
    expect(result.state).toBe('OPEN');
    expect(result.openedAt).toBe(NOW);
  });
});

// ─── formatBreakerReason ────────────────────────────────────────────────────

describe('formatBreakerReason', () => {
  it('formats error_rate', () => {
    const reason = formatBreakerReason({ kind: 'error_rate', errorCount: 5, window: 20 });
    expect(reason).toBe('5/20 errors');
  });

  it('formats consecutive_failures', () => {
    const reason = formatBreakerReason({ kind: 'consecutive_failures', count: 3 });
    expect(reason).toBe('3 consecutive failures');
  });

  it('formats slow_rate', () => {
    const reason = formatBreakerReason({ kind: 'slow_rate', slowCount: 8, window: 20, avgMs: 2500 });
    expect(reason).toBe('8/20 slow (avg 2500ms)');
  });

  it('returns empty string for null', () => {
    expect(formatBreakerReason(null)).toBe('');
  });
});
