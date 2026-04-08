import { describe, it, expect } from 'vitest';
import { createIndexRepairPlan } from '../spIndexRepairPlanner';
import { type IndexFieldSpec } from '../spIndexKnownConfig';
import { type SpIndexedField } from '../spIndexLogic';

describe('spIndexRepairPlanner: createIndexRepairPlan', () => {
  const listName = 'TestList';

  it('should generate a correct plan for additions and deletions', () => {
    const additions: IndexFieldSpec[] = [
      { internalName: 'FieldA', displayName: 'Field A', reason: 'Req A' },
    ];
    const deletions: SpIndexedField[] = [
      { internalName: 'FieldB', displayName: 'Field B', typeAsString: 'Note', deletionReason: 'Note type' },
    ];

    const plan = createIndexRepairPlan(listName, additions, deletions);

    expect(plan.summary.toCreate).toBe(1);
    expect(plan.summary.toDelete).toBe(1);
    expect(plan.actions.length).toBe(2);

    expect(plan.actions[0]).toMatchObject({
      type: 'create',
      internalName: 'FieldA',
      reason: 'Req A',
    });
    expect(plan.actions[0].expectedBenefit).toContain('5,000件上限エラー');

    expect(plan.actions[1]).toMatchObject({
      type: 'delete',
      internalName: 'FieldB',
      reason: 'Note type',
    });
    expect(plan.actions[1].risk).toContain('Power Automate');
  });

  it('should return an empty plan when no candidates are provided', () => {
    const plan = createIndexRepairPlan(listName, [], []);
    expect(plan.actions).toEqual([]);
    expect(plan.summary.total).toBe(0);
  });
});
