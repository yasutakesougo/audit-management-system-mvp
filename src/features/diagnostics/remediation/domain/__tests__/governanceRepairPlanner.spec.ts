import { describe, expect, it } from 'vitest';
import { planGovernanceRepairs } from '../governanceRepairPlanner';
import { HealthCheckResult } from '../../../health/types';

describe('GovernanceRepairPlanner', () => {
  it('detects "auto_heal" results and converts them to RepairPlans', () => {
    const results: HealthCheckResult[] = [
      {
        key: 'schema.fields.test',
        label: 'テストリスト構造',
        status: 'warn',
        category: 'schema',
        summary: '大文字小文字の乖離があります',
        evidence: {
          listKey: 'test_list',
          drifted: [{ expected: 'FullName', actual: 'fullname', driftType: 'case_mismatch' }]
        },
        governance: { action: 'auto_heal', riskLevel: 'low', confidence: 1, reason: 'Case mismatch is safe' },
        nextActions: []
      }
    ];

    const plans = planGovernanceRepairs(results);
    expect(plans).toHaveLength(1);
    expect(plans[0].intent).toBe('schema_update');
    expect(plans[0].safeToAutoExecute).toBe(true);
    expect(plans[0].targetField).toBe('FullName');
  });

  it('ignores results with "propose" or "notify" actions', () => {
    const results: HealthCheckResult[] = [
      {
        key: 'schema.fields.propose',
        label: '提案項目',
        status: 'warn',
        category: 'schema',
        summary: '手動確認が必要です',
        governance: { action: 'propose', riskLevel: 'medium', confidence: 0.8, reason: 'Manual review required' },
        evidence: {},
        nextActions: []
      },
      {
        key: 'schema.fields.notify',
        label: '通知項目',
        status: 'fail',
        category: 'schema',
        summary: '重要項目の不整合',
        governance: { action: 'notify', riskLevel: 'high', confidence: 0.5, reason: 'High risk field' },
        evidence: {},
        nextActions: []
      }
    ];

    const plans = planGovernanceRepairs(results);
    expect(plans).toHaveLength(0);
  });

  it('marks safeToAutoExecute=false if riskLevel is not low (guard)', () => {
    const results: HealthCheckResult[] = [
      {
        key: 'risky.auto_heal',
        label: '高リスク自動修復（理論上）',
        status: 'warn',
        category: 'schema',
        summary: '何か怪しい',
        governance: { action: 'auto_heal', riskLevel: 'medium', confidence: 0.9, reason: 'Risky auto-heal' },
        evidence: {},
        nextActions: []
      }
    ];

    const plans = planGovernanceRepairs(results);
    expect(plans[0].safeToAutoExecute).toBe(false);
  });
});
