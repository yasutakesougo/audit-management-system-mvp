import { describe, expect, it } from 'vitest';
import { runGovernanceRepairs } from '../governanceRepairRunner';
import { RepairPlan } from '../repairTypes';

describe('GovernanceRepairRunner (Dry-run)', () => {
  const mockPlans: RepairPlan[] = [
    {
      id: 'test-1',
      listKey: 'test_list',
      listTitle: 'Test',
      action: 'auto_heal',
      intent: 'schema_update',
      payload: {},
      safeToAutoExecute: true,
      reason: 'safe',
      auditMessage: 'audit'
    }
  ];

  it('performs a dry-run without increasing executedCount', async () => {
    const result = await runGovernanceRepairs(mockPlans, 'dry_run');
    expect(result.mode).toBe('dry_run');
    expect(result.executedCount).toBe(0);
    expect(result.results[0].auditLog).toContain('[Dry-Run]');
  });

  it('blocks execution in live mode if safeToAutoExecute is false', async () => {
    const riskyPlans: RepairPlan[] = [
      { ...mockPlans[0], safeToAutoExecute: false, id: 'risky-1' }
    ];
    const result = await runGovernanceRepairs(riskyPlans, 'live');
    expect(result.executedCount).toBe(0);
    expect(result.blockedCount).toBe(1);
    expect(result.results[0].success).toBe(false);
  });
});
