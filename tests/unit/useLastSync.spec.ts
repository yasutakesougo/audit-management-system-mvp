import {
    __resetLastSyncStoreForTests,
    formatLastSyncCaption,
    getLastSyncSnapshot,
    markSyncFailure,
    markSyncPending,
    markSyncResult
} from '@/features/nurse/state/useLastSync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSummary = (sent: number, remaining: number) => ({
  sent,
  remaining,
  okCount: sent,
  errorCount: 0,
  partialCount: 0,
  entries: [],
  totalCount: sent + remaining,
  source: 'manual' as const,
  durationMs: 1000,
  attempts: 1,
  failureSamples: [],
});

describe('useLastSync telemetry store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetLastSyncStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetLastSyncStoreForTests();
  });

  it('starts idle with no history', () => {
    const snapshot = getLastSyncSnapshot();
    expect(snapshot.status).toBe('idle');
    expect(formatLastSyncCaption(snapshot)).toBe('未同期');
  });

  it('formats captions for pending and success states', () => {
    markSyncPending('manual');
    const pending = getLastSyncSnapshot();
    expect(pending.status).toBe('pending');
    expect(formatLastSyncCaption(pending)).toBe('同期中...');

    markSyncResult({
      sent: 2,
      remaining: 0,
      source: 'manual',
      summary: mockSummary(2, 0)
    });
    const success = getLastSyncSnapshot();
    expect(success.status).toBe('success');
    expect(formatLastSyncCaption(success)).toBe('同期済み 2件');

    markSyncResult({
      sent: 0,
      remaining: 3,
      source: 'manual',
      summary: mockSummary(0, 3)
    });
    const zeroSent = getLastSyncSnapshot();
    expect(zeroSent.status).toBe('success');
    expect(formatLastSyncCaption(zeroSent)).toBe('同期済み 0件');
  });

  it('captures failure details and recovers on next success', () => {
    markSyncPending('online');
    markSyncFailure({ source: 'online', error: new Error('network error') });

    const errorSnapshot = getLastSyncSnapshot();
    expect(errorSnapshot.status).toBe('error');
    expect(errorSnapshot.source).toBe('online');
    expect(formatLastSyncCaption(errorSnapshot)).toBe('同期に失敗しました');

    markSyncPending('manual');
    markSyncResult({
      sent: 3,
      remaining: 0,
      source: 'manual',
      summary: mockSummary(3, 0)
    });
    const recovery = getLastSyncSnapshot();
    expect(recovery.status).toBe('success');
    expect(recovery.source).toBe('manual');
    expect(formatLastSyncCaption(recovery)).toBe('同期済み 3件');
  });
});
