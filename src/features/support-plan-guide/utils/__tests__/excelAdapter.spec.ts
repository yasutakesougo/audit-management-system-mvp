import { describe, it, expect } from 'vitest';
import { mapToExcelPayload } from '../excelAdapter';
import type { SupportPlanExportModel } from '../../types/export';

describe('Excel Adapter Mapping', () => {
  const baseModel: SupportPlanExportModel = {
    coreIsp: {
      serviceUserName: '安武 惣吾',
      supportLevel: '区分4',
      planPeriod: '2026/04 - 2026/09',
      attendingDays: '週5日',
      userRole: 'リーダー',
      assessmentSummary: 'Assessment text',
      decisionSupport: 'Decision support',
      monitoringPlan: 'Monthly',
      riskManagement: 'Safety first',
      rightsAdvocacy: '身体拘束は行いません',
    },
    goals: {
      longGoals: ['Goal A', 'Goal B'],
      shortGoals: ['Step 1'],
      supportMeasures: ['Measure 1'],
    },
    ibd: {
      enabled: false,
      envAdjustment: '',
      pbsStrategy: '',
    },
    compliance: {
      isExportable: true,
      issues: [],
      passCount: 1,
      warnCount: 0,
      blockCount: 0,
      ibdIncluded: false,
    },
    meta: {
      schemaVersion: '2026-04-v1',
      exportedAt: '2026-04-12T00:00:00Z',
      sourceDraftId: 'd-1',
      userName: '安武 惣吾',
    },
  };

  it('should map core ISP fields correctly', () => {
    const payload = mapToExcelPayload(baseModel);
    const ispSheet = payload.sheets.find(s => s.name === '個別支援計画書');
    
    expect(ispSheet).toBeDefined();
    const nameRow = ispSheet?.rows.find(r => r.concept === '利用者氏名');
    expect(nameRow?.value).toBe('安武 惣吾');
    
    const longGoal1 = ispSheet?.rows.find(r => r.concept === '長期目標_1');
    expect(longGoal1?.value).toBe('Goal A');
  });

  it('should NOT include IBD sheet if disabled', () => {
    const payload = mapToExcelPayload(baseModel);
    expect(payload.sheets.find(s => s.name.includes('強度'))).toBeUndefined();
  });

  it('should include IBD sheet if enabled', () => {
    const ibdModel = {
      ...baseModel,
      ibd: { enabled: true, envAdjustment: 'Adj', pbsStrategy: 'PBS' }
    };
    const payload = mapToExcelPayload(ibdModel);
    expect(payload.sheets.length).toBe(2);
    expect(payload.sheets.find(s => s.name.includes('強度'))).toBeDefined();
  });
});
