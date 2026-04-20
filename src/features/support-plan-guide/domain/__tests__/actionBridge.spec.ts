import { describe, expect, it, vi } from 'vitest';
import { buildActionSuggestionsFromSupportPlan } from '../actionBridge';
import type { SupportPlanExportModel } from '../../types/export';
import type { SupportPlanTimelineSummary } from '../timeline';
import type { SupportPlanGuidance } from '../guidanceEngine';

// Mock current date to 2026/04/13
vi.setSystemTime(new Date('2026-04-13T09:00:00.000Z'));

function createMockModel(): SupportPlanExportModel {
  return {
    coreIsp: {
      serviceUserName: '山田太郎',
      supportLevel: '区分4',
      planPeriod: '2026/04/01 - 2027/03/31',
      attendingDays: '週5日',
      userRole: '洗濯物たたみ',
      assessmentSummary: '落ち着いて過ごせる環境が必要',
      decisionSupport: '選択肢を2つ提示する',
      monitoringPlan: '月1回確認',
      riskManagement: '見守りが必要',
      rightsAdvocacy: '尊厳を守る',
    },
    goals: { longGoals: [], shortGoals: [], supportMeasures: [] },
    ibd: { enabled: false, envAdjustment: '', pbsStrategy: '' },
    compliance: { isExportable: true, issues: [], passCount: 0, warnCount: 0, blockCount: 0, ibdIncluded: false },
    meta: { 
      schemaVersion: 'v1', 
      exportedAt: '2026-04-13T00:00:00Z', 
      sourceDraftId: 'd1', 
      userName: 'admin'
    }
  };
}

describe('buildActionSuggestionsFromSupportPlan', () => {
  const userId = 'user-123';

  it('returns empty actions when no issues are present', () => {
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 1,
      lastStructuralChangeAt: '2026-04-10T00:00:00Z',
      lastCriticalSafetyUpdateAt: '2026-04-10T00:00:00Z',
      criticalSafetyUpdates: 1,
      structuralChanges: 1,
      stagnantSince: null
    };
    const guidance: SupportPlanGuidance = { items: [], overallStatus: 'info' };
    const model = createMockModel();

    const result = buildActionSuggestionsFromSupportPlan(userId, summary, guidance, model);
    expect(result).toHaveLength(0);
  });

  it('generates P1 action for structural stagnation (>= 90 days)', () => {
    const stagnantDate = '2026-01-01T00:00:00Z'; // ~102 days before 2026-04-13
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 5,
      lastStructuralChangeAt: stagnantDate,
      lastCriticalSafetyUpdateAt: '2026-04-10T00:00:00Z',
      criticalSafetyUpdates: 2,
      structuralChanges: 5,
      stagnantSince: stagnantDate
    };
    const guidance: SupportPlanGuidance = { items: [], overallStatus: 'warn' };

    const result = buildActionSuggestionsFromSupportPlan(userId, summary, guidance, createMockModel());
    
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      priority: 'P1',
      type: 'plan_update',
      ruleId: 'sp-stagnant',
      targetUserId: userId
    });
    expect(result[0].evidence.currentValue).toContain('102日');
    expect(result[0].cta.params).toEqual(
      expect.objectContaining({
        tab: 'assessment',
        anchor: 'serviceUserName',
      })
    );
  });

  it('generates P0 action for safety gap (versions >= 3, updates = 0)', () => {
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 3,
      lastStructuralChangeAt: '2026-04-10T00:00:00Z',
      lastCriticalSafetyUpdateAt: null,
      criticalSafetyUpdates: 0,
      structuralChanges: 0,
      stagnantSince: null
    };
    const guidance: SupportPlanGuidance = { items: [], overallStatus: 'success' };

    const result = buildActionSuggestionsFromSupportPlan(userId, summary, guidance, createMockModel());
    
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      priority: 'P0',
      type: 'plan_update',
      ruleId: 'sp-safety-gap',
      title: expect.stringContaining('安全管理手順')
    });
    expect(result[0].cta.params).toEqual(
      expect.objectContaining({
        tab: 'risk',
        anchor: 'riskManagement',
      })
    );
  });

  it('generates P0 action for critical compliance guidance', () => {
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 1,
      lastStructuralChangeAt: '2026-04-10T00:00:00Z',
      lastCriticalSafetyUpdateAt: '2026-04-10T00:00:00Z',
      criticalSafetyUpdates: 1,
      structuralChanges: 1,
      stagnantSince: null
    };
    const guidance: SupportPlanGuidance = { 
      overallStatus: 'critical',
      items: [
        { id: '1', type: 'compliance', severity: 'critical', title: '目標未設定', message: '目標が設定されていません', actionLabel: '目標を入力' }
      ] 
    };

    const result = buildActionSuggestionsFromSupportPlan(userId, summary, guidance, createMockModel());
    
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      priority: 'P0',
      ruleId: 'sp-guidance-compliance',
      reason: '目標が設定されていません'
    });
    expect(result[0].cta.params).toEqual({ tab: 'compliance' });
  });

  it('identifies multiple issues simultaneously', () => {
    const summary: SupportPlanTimelineSummary = {
      totalVersions: 4,
      lastStructuralChangeAt: '2026-01-01T00:00:00Z',
      lastCriticalSafetyUpdateAt: null,
      criticalSafetyUpdates: 0,
      structuralChanges: 0,
      stagnantSince: '2026-01-01T00:00:00Z'
    };
    const guidance: SupportPlanGuidance = { 
      overallStatus: 'critical',
      items: [{ id: '2', type: 'safety', severity: 'critical', title: '安全対策不足', message: '安全対策が空です', actionLabel: '入力' }]
    };

    const result = buildActionSuggestionsFromSupportPlan(userId, summary, guidance, createMockModel());
    
    expect(result).toHaveLength(3); // stagnant + safety-gap + guidance
    const ruleIds = result.map(r => r.ruleId);
    expect(ruleIds).toContain('sp-stagnant');
    expect(ruleIds).toContain('sp-safety-gap');
    expect(ruleIds).toContain('sp-guidance-safety');
  });
});
