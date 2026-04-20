import { describe, it, expect } from 'vitest';
import { 
  normalizeReportToHistoryEntry, 
  aggregateHistory 
} from '../selfHealingNormalization';
import { DiagnosticsReportItem } from '@/sharepoint/diagnosticsReports';

describe('selfHealingNormalization', () => {
  describe('normalizeReportToHistoryEntry', () => {
    it('should extract remediation events from SummaryText', () => {
      const mockReport = {
        ID: 101,
        Modified: '2026-04-20T10:00:00Z',
        SummaryText: JSON.stringify({
          events: [
            { eventType: 'remediation', resourceKey: 'ListA', sampleMessage: '修復に成功しました' },
            { eventType: 'drift', resourceKey: 'ListB' }, // remediation 以外は除外
          ]
        })
      } as DiagnosticsReportItem;

      const entry = normalizeReportToHistoryEntry(mockReport);
      expect(entry.runId).toBe('101');
      expect(entry.events).toHaveLength(1);
      expect(entry.events[0].resourceKey).toBe('ListA');
      expect(entry.events[0].outcome).toBe('added');
    });

    it('should categorize outcomes correctly based on messages', () => {
      const events = [
        { sample: 'success', expected: 'added' },
        { sample: '成功', expected: 'added' },
        { sample: 'failed', expected: 'failed' },
        { sample: '失敗', expected: 'failed' },
        { sample: 'limit', expected: 'skipped_limit' },
        { sample: '上限', expected: 'skipped_limit' },
      ];

      events.forEach(({ sample, expected }) => {
        const report = {
          SummaryText: JSON.stringify({
            events: [{ eventType: 'remediation', sampleMessage: sample, resourceKey: 'K' }]
          })
        } as DiagnosticsReportItem;
        const entry = normalizeReportToHistoryEntry(report);
        expect(entry.events[0].outcome).toBe(expected);
      });
    });

    it('should handle broken JSON gracefully', () => {
      const report = { SummaryText: '{ invalid: json' } as DiagnosticsReportItem;
      const entry = normalizeReportToHistoryEntry(report);
      expect(entry.events).toEqual([]);
    });
  });

  describe('aggregateHistory', () => {
    it('should aggregate counts correctly', () => {
      const history = [
        {
          runId: '1',
          timestamp: '2026-04-20T10:00:00Z',
          events: [
            { resourceKey: 'ListA', outcome: 'added', message: 'ok', occurredAt: 't' }
          ]
        },
        {
          runId: '2',
          timestamp: '2026-04-20T09:00:00Z',
          events: [
            { resourceKey: 'ListA', outcome: 'added', message: 'ok', occurredAt: 't' }
          ]
        }
      ] as any[];

      const aggregates = aggregateHistory(history);
      const aggA = aggregates.find(a => a.resourceKey === 'ListA');
      expect(aggA?.successCount).toBe(2);
      expect(aggA?.isFlappingCandidate).toBe(false); // 3回未満
    });

    it('should mark as flapping candidate after 3 successes', () => {
      const history = Array(3).fill(null).map((_, i) => ({
        runId: String(i),
        timestamp: 't',
        events: [{ resourceKey: 'ListA', outcome: 'added', message: 'ok', occurredAt: 't' }]
      })) as any[];

      const aggregates = aggregateHistory(history);
      const aggA = aggregates.find(a => a.resourceKey === 'ListA');
      expect(aggA?.isFlappingCandidate).toBe(true);
      expect(aggA?.lastOutcome).toBe('added');
    });

    it('should mark as flapping candidate after 3 skips', () => {
      const history = Array(3).fill(null).map((_, i) => ({
        runId: String(i),
        timestamp: 't',
        events: [{ resourceKey: 'ListA', outcome: 'skipped_limit', message: 'limit', occurredAt: 't' }]
      })) as any[];

      const aggregates = aggregateHistory(history);
      const aggA = aggregates.find(a => a.resourceKey === 'ListA');
      expect(aggA?.isFlappingCandidate).toBe(true);
      expect(aggA?.lastOutcome).toBe('skipped_limit');
    });
  });
});
