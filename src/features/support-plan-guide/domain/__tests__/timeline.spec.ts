import { describe, expect, it } from 'vitest';
import { buildSupportPlanTimeline } from '../timeline';
import type { SupportPlanExportModel } from '../../types/export';

function createModel(id: string, date: string, partial?: Partial<SupportPlanExportModel>): SupportPlanExportModel {
  return {
    coreIsp: {
      serviceUserName: '山田太郎',
      supportLevel: '区分4',
      planPeriod: '2026/04/01',
      attendingDays: '週5',
      userRole: '',
      assessmentSummary: '',
      decisionSupport: '',
      monitoringPlan: '',
      riskManagement: '',
      rightsAdvocacy: '',
      ...(partial?.coreIsp || {}),
    },
    goals: {
      longGoals: [],
      shortGoals: [],
      supportMeasures: [],
      ...(partial?.goals || {}),
    },
    ibd: { enabled: false, envAdjustment: '', pbsStrategy: '' },
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
      exportedAt: date,
      sourceDraftId: id,
      userName: '管理者',
    },
  };
}

describe('buildSupportPlanTimeline', () => {
  it('sorts entries chronologically by exportedAt', () => {
    const v1 = createModel('d1', '2026-04-01T10:00:00Z');
    const v2 = createModel('d2', '2026-04-02T10:00:00Z');
    const v3 = createModel('d3', '2026-03-31T10:00:00Z');

    const timeline = buildSupportPlanTimeline([v1, v2, v3]);

    expect(timeline.entries).toHaveLength(3);
    expect(timeline.entries[0].draftId).toBe('d3'); // 03/31
    expect(timeline.entries[1].draftId).toBe('d1'); // 04/01
    expect(timeline.entries[2].draftId).toBe('d2'); // 04/02
    
    expect(timeline.summary.totalVersions).toBe(3);
  });

  it('calculates diffs between consecutive versions', () => {
    const v1 = createModel('d1', '2026-04-01T00:00:00Z', {
      goals: { longGoals: ['目標A'], shortGoals: [], supportMeasures: [] }
    });
    const v2 = createModel('d2', '2026-04-02T00:00:00Z', {
      goals: { longGoals: ['目標A', '目標B'], shortGoals: [], supportMeasures: [] }
    });

    const timeline = buildSupportPlanTimeline([v1, v2]);

    // First entry has no previous
    expect(timeline.entries[0].diffFromPrevious).toBeNull();
    
    // Second entry has diff from v1
    const secondDiff = timeline.entries[1].diffFromPrevious;
    expect(secondDiff).not.toBeNull();
    expect(secondDiff?.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'added', label: '目標B' })
      ])
    );
    
    expect(timeline.summary.structuralChanges).toBe(1);
  });

  it('aggregates summary metrics from diffs', () => {
    const v1 = createModel('d1', '2026-04-01T00:00:00Z');
    const v2 = createModel('d2', '2026-04-02T00:00:00Z', {
      coreIsp: { ...createModel('','').coreIsp, riskManagement: '新規リスク' }
    });
    const v3 = createModel('d3', '2026-04-03T00:00:00Z', {
      coreIsp: { ...createModel('','').coreIsp, riskManagement: '新規リスク' }, // No change here vs v2
      goals: { longGoals: ['目標追加'], shortGoals: [], supportMeasures: [] }
    });

    const timeline = buildSupportPlanTimeline([v1, v2, v3]);

    expect(timeline.summary.criticalSafetyUpdates).toBe(1); // v1 -> v2 (new_risk = critical)
    expect(timeline.summary.structuralChanges).toBe(1);     // v2 -> v3 (added goal)
    expect(timeline.summary.totalVersions).toBe(3);
    
    expect(timeline.summary.lastStructuralChangeAt).toBe('2026-04-03T00:00:00Z');
    expect(timeline.summary.lastCriticalSafetyUpdateAt).toBe('2026-04-02T00:00:00Z');
    expect(timeline.summary.stagnantSince).toBe('2026-04-03T00:00:00Z');
  });

  it('detects prolonged stagnation', () => {
    // v1: Structural base
    const v1 = createModel('d1', '2026-04-01T00:00:00Z', {
      goals: { longGoals: ['A'], shortGoals: [], supportMeasures: [] }
    });
    // v2: No change vs v1
    const v2 = createModel('d2', '2026-04-02T00:00:00Z', {
      goals: { longGoals: ['A'], shortGoals: [], supportMeasures: [] }
    });
    // v3: No change vs v2
    const v3 = createModel('d3', '2026-04-03T00:00:00Z', {
      goals: { longGoals: ['A'], shortGoals: [], supportMeasures: [] }
    });

    const timeline = buildSupportPlanTimeline([v1, v2, v3]);

    expect(timeline.summary.structuralChanges).toBe(0);
    // Stagnant since the very first baseline version because no changes occurred
    expect(timeline.summary.stagnantSince).toBe('2026-04-01T00:00:00Z');
  });
});
