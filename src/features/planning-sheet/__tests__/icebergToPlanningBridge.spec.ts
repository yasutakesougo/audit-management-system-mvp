import { describe, it, expect } from 'vitest';
import { 
  icebergToPlanningBridge, 
  classifyTriggerFactor,
  buildIcebergImportResult 
} from '../icebergToPlanningBridge';
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';

describe('icebergToPlanningBridge', () => {
  describe('classifyTriggerFactor', () => {
    it('should classify environment related keywords as environment', () => {
      expect(classifyTriggerFactor('騒がしい部屋')).toBe('environment');
      expect(classifyTriggerFactor('明るい光')).toBe('environment');
      expect(classifyTriggerFactor('人込み')).toBe('environment');
    });

    it('should classify others as trigger', () => {
      expect(classifyTriggerFactor('指示されたとき')).toBe('trigger');
      expect(classifyTriggerFactor('待ち時間')).toBe('trigger');
      expect(classifyTriggerFactor('予定の変更')).toBe('trigger');
    });
  });

  describe('mapping logic', () => {
    const mockDrafts: BehaviorInterventionPlan[] = [
      {
        id: '1',
        userId: 'user1',
        targetBehavior: 'パニック',
        targetBehaviorNodeId: 'node-b1',
        triggerFactors: [
          { label: '指示された', nodeId: 'node-t1' },
          { label: '騒がしい部屋', nodeId: 'node-e1' },
        ],
        strategies: {
          prevention: 'イヤーマフ装着',
          alternative: '「うるさい」と伝える',
          reactive: '静かな場所へ移動',
        },
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        userId: 'user1',
        targetBehavior: 'パニック', // 同じ行動
        targetBehaviorNodeId: 'node-b1',
        triggerFactors: [
          { label: '指示された', nodeId: 'node-t1' }, // 重複
          { label: '予定の変更', nodeId: 'node-t2' },
        ],
        strategies: {
          prevention: 'イヤーマフ装着', // 重複
          alternative: 'タイマーを使う',
          reactive: '深呼吸を促す',
        },
        createdAt: '',
        updatedAt: '',
      }
    ];

    it('should map targetBehavior and icebergSurface', () => {
      const result = icebergToPlanningBridge(mockDrafts);
      expect(result.targetBehavior).toBe('パニック');
      expect(result.icebergSurface).toBe('パニック');
    });

    it('should separate triggers and environment factors with deduplication', () => {
      const result = icebergToPlanningBridge(mockDrafts);
      // '指示された' は重複排除され triggers へ
      // '予定の変更' は triggers へ
      // '騒がしい部屋' は environmentFactors へ
      expect(result.triggers).toBe('指示された, 予定の変更');
      expect(result.environmentFactors).toBe('騒がしい部屋');
    });

    it('should map strategies to planning sections', () => {
      const result = icebergToPlanningBridge(mockDrafts);
      
      // §5 予防的支援
      expect(result.environmentalAdjustment).toBe('イヤーマフ装着');
      
      // §6 代替行動 (alternative は teachingMethod へ)
      expect(result.teachingMethod).toContain('「うるさい」と伝える');
      expect(result.teachingMethod).toContain('タイマーを使う');
      
      // §7 問題行動時対応 (reactive は initialResponse/staffResponse へ)
      expect(result.initialResponse).toContain('静かな場所へ移動');
      expect(result.initialResponse).toContain('深呼吸を促す');
      expect(result.staffResponse).toBe(result.initialResponse);
    });

    it('should handle empty drafts', () => {
      expect(icebergToPlanningBridge([])).toEqual({});
    });
  });

  describe('buildIcebergImportResult', () => {
    const mockDrafts: BehaviorInterventionPlan[] = [
      {
        id: '1',
        userId: 'user1',
        targetBehavior: '行動A',
        targetBehaviorNodeId: 'n1',
        triggerFactors: [
          { label: '要因1', nodeId: 'f1' },
          { label: '静かな部屋', nodeId: 'f2' },
        ],
        strategies: {
          prevention: '予防A',
          alternative: '',
          reactive: '事後A',
        },
        createdAt: '',
        updatedAt: '',
      }
    ];

    it('should return patches and accurate summary', () => {
      const result = buildIcebergImportResult(mockDrafts);
      expect(result.formPatches.targetBehavior).toBe('行動A');
      expect(result.summary).toEqual({
        behaviorCount: 1,
        triggerCount: 1, // '要因1'
        environmentFactorCount: 1, // '静かな部屋'
        strategyCount: 2, // '予防A', '事後A'
      });
    });
  });
});
