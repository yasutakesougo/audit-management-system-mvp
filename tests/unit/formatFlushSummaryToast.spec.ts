import type { FlushEntrySummary, FlushSummary } from '@/features/nurse/state/useNurseSync';
import { formatFlushSummaryToast } from '@/features/nurse/toast/formatFlushSummaryToast';
import { describe, expect, it } from 'vitest';

const makeEntry = (userId: string, status: FlushEntrySummary['status']): FlushEntrySummary => ({
  userId,
  status,
  kind: 'observation',
});

const baseSummary = (): FlushSummary => ({
  sent: 0,
  remaining: 0,
  okCount: 0,
  errorCount: 0,
  partialCount: 0,
  entries: [],
  totalCount: 0,
  source: 'manual',
  durationMs: 1000,
  attempts: 1,
  failureSamples: [],
});

describe('formatFlushSummaryToast', () => {
  it('returns info severity when no items processed', () => {
    const result = formatFlushSummaryToast(baseSummary());
    expect(result.severity).toBe('info');
    expect(result.message).toContain('対象なし');
  });

  it('returns error severity when error entries exist', () => {
    const summary: FlushSummary = {
      ...baseSummary(),
      okCount: 2,
      errorCount: 1,
      totalCount: 3,
      entries: [
        makeEntry('I001', 'ok'),
        makeEntry('I002', 'ok'),
        makeEntry('I003', 'error'),
      ],
    };
    const result = formatFlushSummaryToast(summary);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('エラー 1件');
  });

  it('returns warning severity when partial sync occurs', () => {
    const summary: FlushSummary = {
      ...baseSummary(),
      okCount: 2,
      partialCount: 3,
      totalCount: 5,
      remaining: 2,
      entries: [
        makeEntry('I001', 'ok'),
        makeEntry('I002', 'ok'),
        makeEntry('I003', 'partial'),
        makeEntry('I004', 'partial'),
        makeEntry('I005', 'partial'),
      ],
    };
    const result = formatFlushSummaryToast(summary);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('一部同期');
  });

  it('returns success severity when all entries succeed', () => {
    const summary: FlushSummary = {
      ...baseSummary(),
      okCount: 5,
      sent: 5,
      totalCount: 5,
      entries: [
        makeEntry('I001', 'ok'),
        makeEntry('I002', 'ok'),
        makeEntry('I003', 'ok'),
        makeEntry('I004', 'ok'),
        makeEntry('I005', 'ok'),
      ],
    };
    const result = formatFlushSummaryToast(summary);
    expect(result.severity).toBe('success');
    expect(result.message).toContain('全5件を同期しました');
  });

  it('surfaces BP totals when present', () => {
    const summary: FlushSummary = {
      ...baseSummary(),
      okCount: 3,
      sent: 3,
      totalCount: 3,
      bpSent: 2,
      entries: [
        makeEntry('I010', 'ok'),
        makeEntry('I011', 'ok'),
        makeEntry('I012', 'ok'),
      ],
    };
    const result = formatFlushSummaryToast(summary);
    expect(result.severity).toBe('success');
    expect(result.message).toContain('BP記録を保存しました（2件）');
  });

  it('uses online label when source is online', () => {
    const summary: FlushSummary = {
      ...baseSummary(),
      okCount: 1,
      sent: 1,
      totalCount: 1,
      source: 'online',
      entries: [makeEntry('I001', 'ok')],
    };
    const result = formatFlushSummaryToast(summary);
    expect(result.message.startsWith('オンライン同期')).toBe(true);
  });
});
