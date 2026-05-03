import { describe, expect, it } from 'vitest';
import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';
import { bridgePlanningSheetToDailyProcedures, type BridgeSource } from '../planningToRecordBridge';

// ─── Mock Data Helpers ───

function makeSheet(overrides: Partial<SupportPlanningSheet> = {}): SupportPlanningSheet {
  return {
    id: 'sheet-001',
    userId: 'user-001',
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
    updatedAt: '2024-01-01T00:00:00Z',
    updatedBy: 'system',
    status: 'active',
    version: 1,
    isCurrent: true,
    ispId: 'isp-001',
    title: 'テスト計画書',
    targetScene: '',
    targetDomain: '',
    supportPolicy: '',
    concreteApproaches: '',
    environmentalAdjustments: '',
    observationFacts: '事実',
    interpretationHypothesis: '分析',
    supportIssues: '課題',
    intake: {
      presentingProblem: '課題',
      medicalFlags: [],
      sensoryTriggers: [],
      targetBehaviorsDraft: [],
      behaviorItemsTotal: null,
      incidentSummaryLast30d: '',
      communicationModes: [],
      consentScope: [],
      consentDate: null,
    },
    assessment: {
      targetBehaviors: [],
      abcEvents: [],
      hypotheses: [],
      riskLevel: 'low',
      healthFactors: [],
      teamConsensusNote: '',
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
  } as any;
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
    // 17行モデルでは、行自体は17行に固定される
    // 09:00 の手順は 9:30頃(rowNo 1) もしくは AM日中活動等にマッピングされる
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const step1 = steps.find(s => s.instruction.includes('構造化手順1'));
    expect(step1).toBeDefined();
    // 17行モデルでは activity はマスタの名称（例: 通所・朝の準備）になる
    expect(step1?.activity).not.toBe('構造化手順1');
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
    // 17行モデルでは、テキストフォールバックは AM日中活動などの既存行に集約される
    expect(steps.length).toBeLessThanOrEqual(2);
    const amRow = steps.find(s => s.activity === 'AM日中活動');
    expect(amRow).toBeDefined();
    expect(amRow?.instruction).toContain('朝の挨拶をする');
    expect(amRow?.instructionDetail).toContain('笑顔で接する');
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
    // 17行原紙モデルでは独立した「環境調整」行は生成されず、AM日中活動等に集約される
    const envStep = steps.find(s => s.activity === '環境調整（留意点）');
    expect(envStep).toBeUndefined();
    expect(steps.length).toBeGreaterThanOrEqual(1);
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
