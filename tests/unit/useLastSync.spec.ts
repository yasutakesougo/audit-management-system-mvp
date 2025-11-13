import {
    __resetLastSyncStoreForTests,
    formatLastSyncCaption,
    getLastSyncSnapshot,
    markSyncFailure,
    markSyncPending,
    markSyncResult,
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
    vi.setSystemTime(new Date('2025-01-01T10:00:00Z'));
    __resetLastSyncStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetLastSyncStoreForTests();
  });

  it('starts idle with no history', () => {
    const snapshot = getLastSyncSnapshot();
    expect(snapshot.status).toBe('idle');
    expect(formatLastSyncCaption(snapshot)).toBe('同期履歴なし');
  });

  it('provides captions for pending, success, partial, and empty results', () => {
    markSyncPending('manual');
    const pending = getLastSyncSnapshot();
    expect(pending.status).toBe('pending');
  expect(formatLastSyncCaption(pending)).toBe('同期中...（手動）');

    vi.setSystemTime(new Date('2025-01-01T10:05:00Z'));
    markSyncResult({ 
      sent: 2, 
      remaining: 0, 
      source: 'manual',
      summary: {
        sent: 2,
        remaining: 0,
        okCount: 2,
        errorCount: 0,
        partialCount: 0,
        entries: [],
        totalCount: 2,
        source: 'manual',
        durationMs: 1000,
        attempts: 1,
        failureSamples: [],
      }
    });
    const success = getLastSyncSnapshot();
    expect(success.status).toBe('success');
    const successCaption = formatLastSyncCaption(success);
  expect(successCaption).toBe('Synced (manual) at 10:05');

    markSyncPending('manual');
    vi.setSystemTime(new Date('2025-01-01T10:06:00Z'));
    markSyncResult({ 
      sent: 1, 
      remaining: 2, 
      source: 'manual',
      summary: mockSummary(1, 2)
    });
    const partial = getLastSyncSnapshot();
    expect(partial.status).toBe('partial');
    const partialCaption = formatLastSyncCaption(partial);
  expect(partialCaption).toBe('一部同期（手動） 10:06 1/3');

    markSyncPending('manual');
    vi.setSystemTime(new Date('2025-01-01T10:07:00Z'));
    markSyncResult({ 
      sent: 0, 
      remaining: 0, 
      source: 'manual',
      summary: mockSummary(0, 0)
    });
    const empty = getLastSyncSnapshot();
    expect(empty.status).toBe('empty');
    const emptyCaption = formatLastSyncCaption(empty);
  expect(emptyCaption).toBe('対象なし（手動） 10:07 時点');
  });

  it('captures failure details with online source and recovers on success', () => {
    markSyncPending('online');
    vi.setSystemTime(new Date('2025-01-01T10:10:00Z'));
    markSyncFailure({ source: 'online', error: new Error('network error') });

    const errorSnapshot = getLastSyncSnapshot();
    expect(errorSnapshot.status).toBe('error');
    expect(errorSnapshot.source).toBe('online');
    const errorCaption = formatLastSyncCaption(errorSnapshot);
  expect(errorCaption).toBe('同期に失敗（自動） 10:10 時点 - network error');

    markSyncPending('manual');
    vi.setSystemTime(new Date('2025-01-01T10:11:00Z'));
    markSyncResult({ 
      sent: 3, 
      remaining: 0, 
      source: 'manual',
      summary: mockSummary(3, 0)
    });
    const recovery = getLastSyncSnapshot();
    expect(recovery.status).toBe('success');
    expect(recovery.source).toBe('manual');
   expect(formatLastSyncCaption(recovery)).toBe('同期済み（手動） 10:11 時点');
  });
});
