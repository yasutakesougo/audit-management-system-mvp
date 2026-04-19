import { describe, it, expect } from 'vitest';
import { buildRemediationPlans, type IndexPressureInput } from '../planner';
import type { IndexDiffResult, SpIndexedField } from '../../indexAdvisor/spIndexLogic';
import type { IndexFieldSpec } from '../../indexAdvisor/spIndexKnownConfig';

// ── Helpers ──────────────────────────────────────────────────────────────────

let idSeq = 0;
const deterministicId = () => `test-${++idSeq}`;
const FIXED_NOW = '2026-04-18T00:00:00.000Z';

function makeInput(
  listKey: string,
  deletionCandidates: SpIndexedField[],
  additionCandidates: IndexFieldSpec[],
  currentIndexCount: number,
): IndexPressureInput {
  const diff: IndexDiffResult = {
    currentIndexed: deletionCandidates,
    deletionCandidates,
    additionCandidates,
  };
  return { listKey, diff, currentIndexCount };
}

function resetIdSeq() {
  idSeq = 0;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('remediation/planner: buildRemediationPlans', () => {
  const opts = { now: FIXED_NOW, source: 'realtime' as const, idGenerator: deterministicId };

  beforeEach(() => resetIdSeq());

  it('should generate delete_index plans from deletion candidates', () => {
    const input = makeInput(
      'TestList',
      [
        {
          internalName: 'ZombieField1',
          displayName: 'Zombie 1',
          typeAsString: 'Text',
          deletionReason: 'ゾンビ列（連番サフィックス）の可能性が高い',
        },
      ],
      [],
      18,
    );

    const plans = buildRemediationPlans([input], opts);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      id: 'test-1',
      target: { type: 'index', listKey: 'TestList', fieldName: 'ZombieField1' },
      action: 'delete_index',
      source: 'realtime',
      createdAt: FIXED_NOW,
    });
  });

  it('should classify Note type deletion as safe with autoExecutable=true', () => {
    const input = makeInput(
      'ListA',
      [
        {
          internalName: 'NotesCol',
          displayName: 'Notes',
          typeAsString: 'Note',
          deletionReason: 'Note型はインデックス不可',
        },
      ],
      [],
      15,
    );

    const [plan] = buildRemediationPlans([input], opts);

    expect(plan.risk).toBe('safe');
    expect(plan.autoExecutable).toBe(true);
    expect(plan.requiresApproval).toBe(false);
  });

  it('should classify non-system type deletion as moderate with requiresApproval=true', () => {
    const input = makeInput(
      'ListB',
      [
        {
          internalName: 'UserEmail',
          displayName: 'User Email',
          typeAsString: 'Text',
          deletionReason: '必須セット外',
        },
      ],
      [],
      10,
    );

    const [plan] = buildRemediationPlans([input], opts);

    expect(plan.risk).toBe('moderate');
    expect(plan.autoExecutable).toBe(false);
    expect(plan.requiresApproval).toBe(true);
  });

  it('risk and autoExecutable are independent — safe zombie still safe, moderate text not auto', () => {
    const input = makeInput(
      'ListC',
      [
        // zombie → safe → autoExecutable
        {
          internalName: 'Field123',
          displayName: 'Field 123',
          typeAsString: 'Text',
          deletionReason: 'ゾンビ列',
        },
        // normal text → moderate → not autoExecutable
        {
          internalName: 'CustomField',
          displayName: 'Custom',
          typeAsString: 'Text',
          deletionReason: '必須セット外',
        },
      ],
      [],
      12,
    );

    const plans = buildRemediationPlans([input], opts);

    expect(plans[0].risk).toBe('safe');
    expect(plans[0].autoExecutable).toBe(true);
    expect(plans[1].risk).toBe('moderate');
    expect(plans[1].autoExecutable).toBe(false);
  });

  it('should generate create_index plans from addition candidates', () => {
    const input = makeInput(
      'Schedules',
      [],
      [
        {
          internalName: 'StaffCode',
          displayName: '職員コード',
          reason: '$filter=StaffCode eq X',
        },
      ],
      10,
    );

    const plans = buildRemediationPlans([input], opts);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      action: 'create_index',
      risk: 'safe',
      target: { type: 'index', listKey: 'Schedules', fieldName: 'StaffCode' },
    });
  });

  it('should set autoExecutable=false for create_index when pressure is high', () => {
    const input = makeInput(
      'HighPressureList',
      [],
      [{ internalName: 'NewField', displayName: 'New', reason: 'needed' }],
      16, // 16/20 = 80% > 70% threshold
    );

    const [plan] = buildRemediationPlans([input], opts);

    expect(plan.action).toBe('create_index');
    expect(plan.risk).toBe('safe');
    expect(plan.autoExecutable).toBe(false);
    expect(plan.requiresApproval).toBe(true);
  });

  it('should produce non-empty reason for all plans', () => {
    const input = makeInput(
      'ListD',
      [
        {
          internalName: 'OldField',
          displayName: 'Old',
          typeAsString: 'Computed',
          deletionReason: 'Computed型はインデックス非推奨',
        },
      ],
      [{ internalName: 'NewReq', displayName: 'New Required', reason: 'filter needed' }],
      12,
    );

    const plans = buildRemediationPlans([input], opts);

    for (const plan of plans) {
      expect(plan.reason).toBeTruthy();
      expect(plan.reason.length).toBeGreaterThan(10);
    }
  });

  it('should return empty array when no candidates exist', () => {
    const input = makeInput('EmptyList', [], [], 5);
    const plans = buildRemediationPlans([input], opts);
    expect(plans).toEqual([]);
  });

  it('should handle multiple lists in a single call', () => {
    const inputs: IndexPressureInput[] = [
      makeInput(
        'List1',
        [{ internalName: 'F1', displayName: 'F1', typeAsString: 'Note', deletionReason: 'Note' }],
        [],
        18,
      ),
      makeInput(
        'List2',
        [],
        [{ internalName: 'F2', displayName: 'F2', reason: 'needed' }],
        5,
      ),
    ];

    const plans = buildRemediationPlans(inputs, opts);

    expect(plans).toHaveLength(2);
    expect(plans[0].target.listKey).toBe('List1');
    expect(plans[1].target.listKey).toBe('List2');
  });
});
