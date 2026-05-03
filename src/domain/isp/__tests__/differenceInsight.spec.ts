import { describe, it, expect } from 'vitest';
import { summarizeIcebergSnapshot, calculateDifferenceInsight } from '../differenceInsight';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { SupportPlanningSheet, IcebergSummary } from '../schema';

describe('differenceInsight domain logic', () => {
  describe('summarizeIcebergSnapshot', () => {
    it('最新の行動ノードが主要行動として選択されること', () => {
      const snapshot: IcebergSnapshot = {
        sessionId: 'sess-1',
        userId: 'user-1',
        nodes: [
          { id: 'n1', type: 'behavior', label: '古い行動', updatedAt: '2026-04-01T10:00:00Z' },
          { id: 'n2', type: 'behavior', label: '新しい行動', updatedAt: '2026-04-02T10:00:00Z' },
        ],
        links: [],
        updatedAt: '2026-04-02T10:00:00Z',
      } as unknown as IcebergSnapshot;

      const summary = summarizeIcebergSnapshot(snapshot);
      expect(summary?.primaryBehavior).toBe('新しい行動');
    });

    it('信頼度の最も高いリンクの sourceNode が主要要因として選択されること', () => {
      const snapshot: IcebergSnapshot = {
        sessionId: 'sess-1',
        userId: 'user-1',
        nodes: [
          { id: 'f-low', type: 'factor', label: '低い要因' },
          { id: 'f-high', type: 'factor', label: '高い要因' },
          { id: 'b1', type: 'behavior', label: '行動' },
        ],
        links: [
          { id: 'l1', sourceNodeId: 'f-low', targetNodeId: 'b1', confidence: 'low' },
          { id: 'l2', sourceNodeId: 'f-high', targetNodeId: 'b1', confidence: 'high' },
        ],
        updatedAt: '2026-04-01T10:00:00Z',
      } as unknown as IcebergSnapshot;

      const summary = summarizeIcebergSnapshot(snapshot);
      expect(summary?.primaryFactor).toBe('高い要因');
    });

    it('ノードやリンクがない場合にフォールバックされること', () => {
      const snapshot: IcebergSnapshot = {
        sessionId: 'sess-1',
        userId: 'user-1',
        nodes: [],
        links: [],
        updatedAt: '2026-04-01T10:00:00Z',
      } as unknown as IcebergSnapshot;

      const summary = summarizeIcebergSnapshot(snapshot);
      expect(summary?.primaryBehavior).toBe('—');
      expect(summary?.primaryFactor).toBe('—');
    });
  });

  describe('calculateDifferenceInsight', () => {
    const mockSummary: IcebergSummary = {
      sessionId: 'sess-1',
      updatedAt: '2026-04-02',
      primaryBehavior: 'パニック',
      primaryFactor: '音過敏',
    };

    const mockSheet = {
      assessment: {
        targetBehaviors: [{ name: '自傷' }],
        hypotheses: [{ function: '要求' }],
      }
    } as unknown as SupportPlanningSheet;

    it('行動が未反映の場合、high レベルのインサイトを出すこと', () => {
      const insight = calculateDifferenceInsight(mockSummary, mockSheet);
      const behaviorChange = insight?.changes.find(c => c.label === '行動');
      
      expect(behaviorChange?.value).toBe('追加: パニック');
      expect(behaviorChange?.level).toBe('high');
    });

    it('要因が未反映の場合、medium レベルのインサイトを出すこと', () => {
      const insight = calculateDifferenceInsight(mockSummary, mockSheet);
      const factorChange = insight?.changes.find(c => c.label === '要因');
      
      expect(factorChange?.value).toBe('要検討: 音過敏');
      expect(factorChange?.level).toBe('medium');
    });

    it('すべて反映済みの場合、null を返すこと', () => {
      const fullReflectedSheet = {
        assessment: {
          targetBehaviors: [{ name: 'パニック' }],
          hypotheses: [{ function: '音過敏' }],
        }
      } as unknown as SupportPlanningSheet;

      const insight = calculateDifferenceInsight(mockSummary, fullReflectedSheet);
      expect(insight).toBeNull();
    });

    it('summary が "—" の場合は差分として検知しないこと', () => {
      const emptySummary: IcebergSummary = {
        sessionId: 'sess-1',
        updatedAt: '2026-04-02',
        primaryBehavior: '—',
        primaryFactor: '—',
      };

      const insight = calculateDifferenceInsight(emptySummary, mockSheet);
      expect(insight).toBeNull();
    });
  });
});
