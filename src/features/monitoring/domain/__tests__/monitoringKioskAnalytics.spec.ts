import { aggregateKioskRecords, buildKioskInsightText } from '../monitoringKioskAnalytics';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';

describe('monitoringKioskAnalytics', () => {
  const mockRecords: ExecutionRecord[] = [
    {
      id: 'rec-1',
      date: '2026-05-01',
      userId: 'user-1',
      scheduleItemId: 'proc-1',
      status: 'completed',
      triggeredBipIds: [],
      memo: '順調',
      recordedBy: 'staff-1',
      recordedAt: '2026-05-01T10:00:00Z',
    },
    {
      id: 'rec-2',
      date: '2026-05-01',
      userId: 'user-1',
      scheduleItemId: 'proc-2',
      status: 'triggered',
      triggeredBipIds: ['bip-1'],
      memo: '少し不穏',
      recordedBy: 'staff-1',
      recordedAt: '2026-05-01T11:00:00Z',
    },
    {
      id: 'rec-3',
      date: '2026-05-02',
      userId: 'user-1',
      scheduleItemId: 'proc-1',
      status: 'skipped',
      triggeredBipIds: [],
      memo: '他行事のため',
      recordedBy: 'staff-2',
      recordedAt: '2026-05-02T10:00:00Z',
    },
  ];

  describe('aggregateKioskRecords', () => {
    it('should aggregate records correctly', () => {
      const summary = aggregateKioskRecords(mockRecords, {
        userId: 'user-1',
        from: '2026-05-01',
        to: '2026-05-02',
        procedureNames: {
          'proc-1': '朝の準備',
          'proc-2': '昼食',
        },
      });

      expect(summary.userId).toBe('user-1');
      expect(summary.recordedDays).toBe(2);
      expect(summary.totalRecords).toBe(3);
      expect(summary.procedures).toHaveLength(2);

      const p1 = summary.procedures.find(p => p.scheduleItemId === 'proc-1');
      expect(p1?.activityName).toBe('朝の準備');
      expect(p1?.totalCount).toBe(2);
      expect(p1?.completedCount).toBe(1);
      expect(p1?.skippedCount).toBe(1);
      expect(p1?.memoCount).toBe(2);

      const p2 = summary.procedures.find(p => p.scheduleItemId === 'proc-2');
      expect(p2?.activityName).toBe('昼食');
      expect(p2?.triggeredCount).toBe(1);
    });

    it('should sort procedures by row number in ID', () => {
      const records: ExecutionRecord[] = [
        { id: '1', date: '2026-05-01', userId: 'u1', scheduleItemId: 'proc-10', status: 'completed' } as any,
        { id: '2', date: '2026-05-01', userId: 'u1', scheduleItemId: 'proc-2', status: 'completed' } as any,
      ];
      const summary = aggregateKioskRecords(records, { userId: 'u1', from: 'a', to: 'b' });
      expect(summary.procedures[0].scheduleItemId).toBe('proc-2');
      expect(summary.procedures[1].scheduleItemId).toBe('proc-10');
    });
  });

  describe('buildKioskInsightText', () => {
    it('should generate empty message if no records', () => {
      const summary = aggregateKioskRecords([], { userId: 'u1', from: 'a', to: 'b' });
      const lines = buildKioskInsightText(summary);
      expect(lines[0]).toContain('実施記録はありません');
    });

    it('should generate insight lines with statistics', () => {
      const summary = aggregateKioskRecords(mockRecords, {
        userId: 'user-1',
        from: '2026-05-01',
        to: '2026-05-02',
        procedureNames: { 
          'proc-1': '朝の準備',
          'proc-2': '昼食' 
        },
      });
      const lines = buildKioskInsightText(summary);
      
      expect(lines[0]).toContain('2日の記録あり');
      expect(lines[1]).toContain('昼食(発生 1回)');
      expect(lines[2]).toContain('メモが残されています');
      expect(lines[3]).toContain('朝の準備(スキップ 1回)');
    });
  });
});
