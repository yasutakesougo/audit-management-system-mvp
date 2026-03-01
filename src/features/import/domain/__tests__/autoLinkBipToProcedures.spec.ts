import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { createEmptyStrategies } from '@/features/analysis/domain/interventionTypes';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { describe, expect, it } from 'vitest';
import { autoLinkBipToProcedures } from '../autoLinkBipToProcedures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProc(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'proc-1',
    time: '09:00',
    activity: '朝の活動',
    instruction: '',
    isKey: false,
    linkedInterventionIds: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<BehaviorInterventionPlan> = {}): BehaviorInterventionPlan {
  return {
    id: 'plan-1',
    userId: 'I001',
    targetBehavior: '対象行動',
    targetBehaviorNodeId: 'node-1',
    triggerFactors: [],
    strategies: createEmptyStrategies(),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('autoLinkBipToProcedures', () => {
  it('returns procedures unchanged when plans is empty', () => {
    const procs = [makeProc()];
    const result = autoLinkBipToProcedures(procs, []);
    expect(result).toBe(procs); // same reference (identity shortcut)
  });

  it('links via synonym match: はさみ ↔ 紙切り', () => {
    const procs = [makeProc({ activity: '昼休み - 紙切り' })];
    const plans = [
      makePlan({
        id: 'bip-scissors',
        targetBehavior: 'はさみへのこだわり',
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    expect(result[0].linkedInterventionIds).toContain('bip-scissors');
  });

  it('links via synonym match: 食事 ↔ 給食', () => {
    const procs = [makeProc({ activity: '給食の時間' })];
    const plans = [
      makePlan({
        id: 'bip-meal',
        strategies: { ...createEmptyStrategies(), prevention: '食事中の誤嚥に注意' },
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    expect(result[0].linkedInterventionIds).toContain('bip-meal');
  });

  it('links via direct keyword match in activity', () => {
    const procs = [makeProc({ activity: '午後 - 工作' })];
    const plans = [
      makePlan({
        id: 'bip-craft',
        strategies: { ...createEmptyStrategies(), prevention: '工作中は素材の共有でトラブル注意' },
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    expect(result[0].linkedInterventionIds).toContain('bip-craft');
  });

  it('does NOT link unrelated items', () => {
    const procs = [makeProc({ activity: '音楽の時間', instruction: 'リズム遊び' })];
    const plans = [
      makePlan({
        id: 'bip-bath',
        targetBehavior: '入浴時の不安',
        strategies: { ...createEmptyStrategies(), prevention: 'お風呂の前に見通しを持たせる' },
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    expect(result[0].linkedInterventionIds).toEqual([]);
  });

  it('links multiple plans to one procedure', () => {
    const procs = [makeProc({ activity: '給食 - 配膳' })];
    const plans = [
      makePlan({
        id: 'bip-meal',
        targetBehavior: '食事中の他害',
      }),
      makePlan({
        id: 'bip-violence',
        targetBehavior: '他害行為',
        strategies: { ...createEmptyStrategies(), prevention: '配膳時にトラブルが起こりやすい' },
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    expect(result[0].linkedInterventionIds).toContain('bip-meal');
    expect(result[0].linkedInterventionIds).toContain('bip-violence');
  });

  it('preserves existing linkedInterventionIds', () => {
    const procs = [
      makeProc({
        activity: '紙切り遊び',
        linkedInterventionIds: ['existing-1'],
      }),
    ];
    const plans = [
      makePlan({
        id: 'bip-scissors',
        targetBehavior: 'はさみへのこだわり',
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    expect(result[0].linkedInterventionIds).toContain('existing-1');
    expect(result[0].linkedInterventionIds).toContain('bip-scissors');
  });

  it('deduplicates linked IDs', () => {
    const procs = [
      makeProc({
        activity: '紙切り遊び',
        linkedInterventionIds: ['bip-scissors'],
      }),
    ];
    const plans = [
      makePlan({
        id: 'bip-scissors',
        targetBehavior: 'はさみへのこだわり',
      }),
    ];

    const result = autoLinkBipToProcedures(procs, plans);
    const ids = result[0].linkedInterventionIds!;
    expect(ids.filter((id) => id === 'bip-scissors')).toHaveLength(1);
  });

  it('does not mutate original procedures', () => {
    const original = makeProc({ activity: '紙切り遊び' });
    const procs = [original];
    const plans = [
      makePlan({ id: 'bip-1', targetBehavior: 'はさみ' }),
    ];

    autoLinkBipToProcedures(procs, plans);
    expect(original.linkedInterventionIds).toEqual([]);
  });
});
