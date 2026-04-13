import { describe, expect, it } from 'vitest';
import { buildSupportPlanDiff } from '../diffEngine';
import type { SupportPlanExportModel } from '../../types/export';

function createModel(partial?: Partial<SupportPlanExportModel>): SupportPlanExportModel {
  const base: SupportPlanExportModel = {
    coreIsp: {
      serviceUserName: '山田太郎',
      supportLevel: '区分4',
      planPeriod: '2026/04/01 - 2027/03/31',
      attendingDays: '週5日',
      userRole: '洗濯物たたみ',
      assessmentSummary: '落ち着いて過ごせる環境が必要',
      decisionSupport: '選択肢を2つ提示する',
      monitoringPlan: '月1回確認',
      riskManagement: '',
      rightsAdvocacy: '本人の尊厳を守る',
    },
    goals: {
      longGoals: ['安定して通所する'],
      shortGoals: ['朝の準備を自分で進める'],
      supportMeasures: ['朝の見通し提示'],
    },
    ibd: {
      enabled: false,
      envAdjustment: '',
      pbsStrategy: '',
    },
    compliance: {
      isExportable: true,
      issues: [],
      passCount: 0,
      warnCount: 0,
      blockCount: 0,
      ibdIncluded: false,
    },
    meta: {
      schemaVersion: '2026-04-v1',
      exportedAt: '2026-04-13T09:00:00.000Z',
      sourceDraftId: 'draft-1',
      userName: '管理者',
    },
  };

  if (!partial) return base;

  return {
    ...base,
    ...partial,
    coreIsp: { ...base.coreIsp, ...(partial.coreIsp || {}) },
    goals: { ...base.goals, ...(partial.goals || {}) },
    ibd: { ...base.ibd, ...(partial.ibd || {}) },
    compliance: { ...base.compliance, ...(partial.compliance || {}) },
    meta: { ...base.meta, ...(partial.meta || {}) },
  };
}

describe('buildSupportPlanDiff', () => {
  it('detects structural goal addition and critical safety updates', () => {
    const before = createModel();

    const after = createModel({
      coreIsp: {
        ...before.coreIsp,
        riskManagement: 'パニック時は静かな部屋へ移動し職員が付き添う',
      },
      goals: {
        ...before.goals,
        longGoals: ['安定して通所する', '不安時に援助を求められる'],
      },
    });

    const result = buildSupportPlanDiff(before, after);

    expect(result.summary.hasStructuralChange).toBe(true);
    expect(result.summary.hasCriticalSafetyUpdate).toBe(true);
    expect(result.summary.totalChanges).toBe(2);

    expect(result.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'long',
          kind: 'added',
          label: '不安時に援助を求められる',
        }),
      ]),
    );

    expect(result.safety).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'new_risk',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('detects goal removal', () => {
    const before = createModel({
      goals: {
        longGoals: ['目標1', '目標2'],
        shortGoals: [],
        supportMeasures: [],
      },
    });

    const after = createModel({
      goals: {
        longGoals: ['目標1'],
        shortGoals: [],
        supportMeasures: [],
      },
    });

    const result = buildSupportPlanDiff(before, after);

    expect(result.goals).toEqual([
      expect.objectContaining({
        type: 'long',
        kind: 'removed',
        label: '目標2',
      }),
    ]);
  });

  it('detects risk mitigation updates with warn severity', () => {
    const before = createModel({
      coreIsp: {
        ...createModel().coreIsp,
        riskManagement: '旧対策',
      },
    });

    const after = createModel({
      coreIsp: {
        ...before.coreIsp,
        riskManagement: '新対策',
      },
    });

    const result = buildSupportPlanDiff(before, after);

    expect(result.safety).toEqual([
      expect.objectContaining({
        kind: 'mitigation_updated',
        severity: 'warn',
      }),
    ]);
  });

  it('ignores changes in whitespace or empty goals', () => {
    const before = createModel({
      goals: {
        longGoals: ['安定して通所する'],
        shortGoals: [],
        supportMeasures: [],
      },
    });

    const after = createModel({
      goals: {
        longGoals: [' 安定して通所する '],
        shortGoals: [' '],
        supportMeasures: [],
      },
    });

    const result = buildSupportPlanDiff(before, after);
    expect(result.summary.totalChanges).toBe(0);
  });
});
