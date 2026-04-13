import { describe, expect, it } from 'vitest';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { bridgePlanningSheetToDailyProcedures, type BridgeSource } from '../planningToRecordBridge';

// ─── Mock Data Helpers ───

function makeSheet(overrides: Partial<SupportPlanningSheet> = {}): SupportPlanningSheet {
  return {
    id: 'sheet-001',
    userId: 'user-001',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    status: 'active',
    version: 1,
    isCurrent: true,
    title: 'テスト計画書',
    supportPolicy: '',
    concreteApproaches: '',
    environmentalAdjustments: '',
    intake: {
      userId: 'user-001',
      medicalFlags: [],
      sensoryTriggers: [],
      riskBehaviors: [],
      strengths: '',
      weaknesses: '',
      history: '',
      remarks: '',
    },
    assessment: {
      behaviorSummary: '',
      environmentalFactors: '',
      hypothesis: '',
    },
    planning: {
      supportPriorities: [],
      antecedentStrategies: [],
      teachingStrategies: [],
      consequenceStrategies: [],
      procedureSteps: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency',
      reviewCycleDays: 180,
    },
    ...overrides,
  };
}

// ─── Tests ───

describe('bridgePlanningSheetToDailyProcedures', () => {
  it('prioritizes structured procedureSteps when available', () => {
    const sheet = makeSheet({
      supportPolicy: 'テキストの方針',
      planning: {
        procedureSteps: [
          { order: 1, instruction: '構造化手順1', timing: '09:00', staff: '' },
          { order: 2, instruction: '構造化手順2', timing: '10:00', staff: '' },
        ],
      } as any,
    });

    const { steps, source } = bridgePlanningSheetToDailyProcedures(sheet);

    expect(source).toBe('sheet_structured' as BridgeSource);
    expect(steps).toHaveLength(2);
    expect(steps[0].activity).toBe('構造化手順1');
    expect(steps[0].time).toBe('09:00');
    expect(steps[0].instruction).toBe('構造化手順1');
    expect(steps[1].activity).toBe('構造化手順2');
  });

  it('falls back to supportPolicy and concreteApproaches when procedureSteps is empty', () => {
    const sheet = makeSheet({
      supportPolicy: '朝の挨拶をする\n持ち物を整理する',
      concreteApproaches: '笑顔で接する',
      planning: {
        procedureSteps: [],
      } as any,
    });

    const { steps, source } = bridgePlanningSheetToDailyProcedures(sheet);

    expect(source).toBe('sheet_fallback_text' as BridgeSource);
    // policyItems (2) + approachItems (1) = 3 steps
    expect(steps).toHaveLength(3);
    expect(steps[0].activity).toBe('支援方針');
    expect(steps[0].instruction).toBe('朝の挨拶をする');
    expect(steps[1].instruction).toBe('持ち物を整理する');
    expect(steps[2].activity).toBe('具体的対応');
    expect(steps[2].instruction).toBe('笑顔で接する');
  });

  it('sets source as empty if both structured and text data are missing', () => {
    const sheet = makeSheet({
      supportPolicy: '',
      concreteApproaches: '',
      planning: {
        procedureSteps: [],
      } as any,
    });

    const { steps, source } = bridgePlanningSheetToDailyProcedures(sheet);
    expect(source).toBe('empty');
    expect(steps).toEqual([]);
  });

  it('handles environmentalAdjustments in fallback mode', () => {
    const sheet = makeSheet({
      supportPolicy: '方針のみ',
      environmentalAdjustments: '静かな環境を整える',
      planning: {
        procedureSteps: [],
      } as any,
    });

    const { steps, source } = bridgePlanningSheetToDailyProcedures(sheet);

    expect(source).toBe('sheet_fallback_text');
    expect(steps).toHaveLength(2);
    expect(steps[1].activity).toBe('環境調整（留意点）');
    expect(steps[1].instruction).toContain('静かな環境を整える');
  });

  it('assigns planningSheetId correctly in both modes', () => {
    // Mode 1: Structured
    const structuredSheet = makeSheet({
      id: 'structured-id',
      planning: {
        procedureSteps: [{ order: 1, instruction: 'A', timing: '', staff: '' }],
      } as any,
    });
    const result1 = bridgePlanningSheetToDailyProcedures(structuredSheet);
    expect(result1.steps[0].planningSheetId).toBe('structured-id');
    expect(result1.source).toBe('sheet_structured');

    // Mode 2: Fallback
    const fallbackSheet = makeSheet({
      id: 'fallback-id',
      supportPolicy: 'B',
      planning: { procedureSteps: [] } as any,
    });
    const result2 = bridgePlanningSheetToDailyProcedures(fallbackSheet);
    expect(result2.steps[0].planningSheetId).toBe('fallback-id');
    expect(result2.source).toBe('sheet_fallback_text');
  });
});
