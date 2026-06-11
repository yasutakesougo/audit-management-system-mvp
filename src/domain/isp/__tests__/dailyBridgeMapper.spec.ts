import { describe, expect, it } from 'vitest';
import { mapPlanningToDailyBridge } from '../dailyBridgeMapper';
import { supportPlanningSheetSchema } from '../schema/ispPlanningSheetSchema';

const baseSheet = supportPlanningSheetSchema.parse({
  id: 'sheet-001',
  createdAt: '2026-06-10T00:00:00.000Z',
  createdBy: 'tester',
  updatedAt: '2026-06-10T00:30:00.000Z',
  updatedBy: 'tester',
  version: 1,
  status: 'draft',
  isCurrent: true,
  userId: 'U-001',
  ispId: 'ISP-001',
  title: '在宅支援計画',
  observationFacts: '観察記録',
  supportIssues: '課題あり',
  supportPolicy: '短時間対応',
  concreteApproaches: '段階的支援',
  interpretationHypothesis: '支援の一貫性を高める',
  appliedFrom: '2026-06-01T00:00:00.000Z',
  supportStartDate: '2026-06-01',
  regulatoryBasisSnapshot: {
    supportLevel: null,
    behaviorScore: null,
    serviceType: null,
    eligibilityCheckedAt: null,
  },
});

describe('mapPlanningToDailyBridge', () => {
  it('procedure, caution, environmental, focus の各要素をまとめて変換する', () => {
    const result = mapPlanningToDailyBridge(
      {
        ...baseSheet,
        environmentalAdjustments: '音環境を静かに',
        planning: {
          procedureSteps: [
            { order: 1, instruction: '服薬確認', staff: 'A', timing: '朝' },
          ],
          crisisThresholds: {
            escalationLevel: 'level-3',
            deescalationSteps: ['一時退室', '深呼吸'],
            emergencyContacts: ['Aさん'],
          },
          environmentalAdjustments: '音環境を静かに',
        },
      },
      '2026-06-11',
    );

    expect(result.items).toHaveLength(4);
    expect(result.summary.procedureCount).toBe(1);
    expect(result.summary.cautionCount).toBe(1);
    expect(result.targetDate).toBe('2026-06-11');
    expect(result.items.map((item) => item.type)).toEqual(
      ['procedure', 'caution', 'environmental', 'focus'],
    );
    expect(result.items[0].provenance.sourceSection).toBe('planning.procedureSteps');
    expect(result.items[1].goalSummary).toBe('医療・安全のリスク');
    expect(result.summary.latestUpdateAt).toBe('2026-06-10T00:30:00.000Z');
  });

  it('interpretationHypothesis のみがある場合に focus 配備を生成し summary に反映される', () => {
    const result = mapPlanningToDailyBridge(
      {
        ...baseSheet,
        interpretationHypothesis: '行動の再評価を重視する',
        planning: {
          procedureSteps: [],
          crisisThresholds: null,
          environmentalAdjustments: '',
        },
      },
      '2026-06-12',
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('focus');
    expect(result.summary).toMatchObject({
      focusPointCount: 1,
      procedureCount: 0,
      cautionCount: 0,
      latestUpdateAt: '2026-06-10T00:30:00.000Z',
    });
  });
});
